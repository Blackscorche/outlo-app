import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import subscriptionService from '../services/subscriptionService';
import { supabase } from '../integrations/supabase/client';

interface SubscriptionData {
  subscription: any;
  quotas: any;
  isPremium: boolean;
  isInvisibleMode: boolean;
  canSendConnectionRequest: boolean;
  canUseFirstImpression: boolean;
  connectionRequestsRemaining: number;
  firstImpressionsRemaining: number;
  refreshSubscription: () => Promise<void>;
  validateSubscription: (forceIAPCheck?: boolean) => Promise<void>;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionData | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subscription, setSubscription] = useState<any>(null);
  const [quotas, setQuotas] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadSubscriptionData = useCallback(async (forceValidation = false, forceIAPCheck = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let subData, quotaData;

      if (forceValidation || forceIAPCheck) {
        // Use validation method that checks expiry and IAP status
        console.log('🔄 Force validating subscription...');
        subData = await subscriptionService.validateAndSyncSubscription(user.id, forceIAPCheck);
        quotaData = await subscriptionService.getUserQuotas(user.id);
      } else {
        // Normal load
        [subData, quotaData] = await Promise.all([
          subscriptionService.getSubscriptionStatus(user.id),
          subscriptionService.getUserQuotas(user.id),
        ]);
      }

      setSubscription(subData || { tier: 'basic', status: 'active' });
      setQuotas(quotaData || {
        connection_requests_remaining: 1,
        connection_requests_purchased: 0,
        first_impressions_remaining: 0,
        first_impressions_purchased: 0,
      });
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptionData();

    // Set up realtime subscription for user_subscriptions table changes
    const subscriptionChannel = supabase
      .channel('subscription_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions'
        },
        async (payload) => {
          console.log('Subscription change detected:', payload);
          // Refresh subscription data when changes are detected
          await loadSubscriptionData();
        }
      )
      .subscribe();

    // Set up realtime subscription for user_quotas table changes
    const quotasChannel = supabase
      .channel('quotas_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_quotas'
        },
        async (payload) => {
          console.log('Quotas change detected:', payload);
          // Refresh subscription data when changes are detected
          await loadSubscriptionData();
        }
      )
      .subscribe();

    // Set up periodic refresh every 30 seconds to catch any missed updates
    const intervalId = setInterval(() => {
      loadSubscriptionData();
    }, 30000);

    return () => {
      supabase.removeChannel(subscriptionChannel);
      supabase.removeChannel(quotasChannel);
      clearInterval(intervalId);
    };
  }, [loadSubscriptionData]);

  const isPremium = subscription?.tier === 'premium' && subscription?.status !== 'cancelled';
  
  const isInvisibleMode = isPremium || 
    (quotas?.invisible_mode_expires_at && new Date(quotas.invisible_mode_expires_at) > new Date());
  
  const connectionRequestsRemaining = (quotas?.connection_requests_remaining || 0) + 
    (quotas?.connection_requests_purchased || 0);
    
  const firstImpressionsRemaining = (quotas?.first_impressions_remaining || 0) + 
    (quotas?.first_impressions_purchased || 0);
  
  const canSendConnectionRequest = connectionRequestsRemaining > 0;
  const canUseFirstImpression = firstImpressionsRemaining > 0;

  const refreshSubscription = async () => {
    setLoading(true);
    await loadSubscriptionData();
  };

  const validateSubscription = async (forceIAPCheck = false) => {
    setLoading(true);
    await loadSubscriptionData(true, forceIAPCheck); // Force validation with optional IAP check
  };

  const value: SubscriptionData = {
    subscription,
    quotas,
    isPremium,
    isInvisibleMode,
    canSendConnectionRequest,
    canUseFirstImpression,
    connectionRequestsRemaining,
    firstImpressionsRemaining,
    refreshSubscription,
    validateSubscription,
    loading,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionData => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: 'basic' | 'premium' | 'vip';
  subscription_end: string | null;
}

export const useSubscription = () => {
  const { user, session } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    subscribed: false,
    subscription_tier: 'basic',
    subscription_end: null,
  });
  const [loading, setLoading] = useState(true);

  const checkSubscription = async () => {
    if (!user || !session) {
      console.log('No user or session available');
      setSubscriptionData({
        subscribed: false,
        subscription_tier: 'basic',
        subscription_end: null,
      });
      setLoading(false);
      return;
    }

    try {
      console.log('Checking subscription status for user:', user.email);
      
      // First try to check directly from the subscribers table
      const { data: directSubscriberData, error: directError } = await supabase
        .from('subscribers')
        .select('*')
        .eq('email', user.email)
        .single();

      if (!directError && directSubscriberData) {
        console.log('Direct subscription data found:', directSubscriberData);
        setSubscriptionData({
          subscribed: directSubscriberData.subscribed,
          subscription_tier: directSubscriberData.subscription_tier as 'basic' | 'premium' | 'vip',
          subscription_end: directSubscriberData.subscription_end,
        });
        setLoading(false);
        return;
      }

      // Fallback to edge function if direct query fails
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error checking subscription:', error);
        
        // If there's an error, try to refresh the session and retry once
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('Session refresh failed:', refreshError);
          return;
        }
        
        if (refreshData.session) {
          console.log('Session refreshed, retrying subscription check');
          const { data: retryData, error: retryError } = await supabase.functions.invoke('check-subscription', {
            headers: {
              Authorization: `Bearer ${refreshData.session.access_token}`,
            },
          });
          
          if (retryError) {
            console.error('Retry failed:', retryError);
            return;
          }
          
          console.log('Subscription data received on retry:', retryData);
          setSubscriptionData(retryData);
        }
        return;
      }

      console.log('Subscription data received:', data);
      setSubscriptionData(data);
    } catch (error) {
      console.error('Error in checkSubscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && session) {
      // Use setTimeout to defer subscription check and not block initial render
      const timeoutId = setTimeout(checkSubscription, 50);
      return () => clearTimeout(timeoutId);
    } else {
      setLoading(false);
    }
  }, [user, session]);

  const createCheckout = async (planId: string) => {
    if (!user || !session) {
      throw new Error('User must be authenticated');
    }

    try {
      console.log('Creating checkout session for plan:', planId);
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error creating checkout:', error);
        throw error;
      }

      console.log('Checkout session created:', data);
      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error in createCheckout:', error);
      throw error;
    }
  };

  const openCustomerPortal = async () => {
    if (!user || !session) {
      throw new Error('User must be authenticated');
    }

    try {
      console.log('Opening customer portal...');
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error opening customer portal:', error);
        throw error;
      }

      console.log('Customer portal session created:', data);
      // Open customer portal in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error in openCustomerPortal:', error);
      throw error;
    }
  };

  return {
    ...subscriptionData,
    loading,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
};

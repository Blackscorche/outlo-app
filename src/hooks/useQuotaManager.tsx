import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import subscriptionService from '../services/subscriptionService';
import { supabase } from '../integrations/supabase/client';

export interface QuotaDetails {
  connectionRequests: { remaining: number; purchased: number; total: number };
  firstImpressions: { remaining: number; purchased: number; total: number };
  invisibleMode: { active: boolean; expiresAt?: string; source: 'premium' | 'purchased' | 'none' };
}

export const useQuotaManager = () => {
  const [loading, setLoading] = useState(false);

  // Use a connection request
  const useConnectionRequest = useCallback(async (showAlert = true): Promise<boolean> => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (showAlert) Alert.alert('Error', 'Please log in to continue.');
        return false;
      }

      const result = await subscriptionService.useConnectionRequest(user.id);
      
      if (!result.success) {
        if (showAlert) {
          Alert.alert(
            'No Connection Requests Left',
            'You have no connection requests remaining. Purchase more or upgrade to Premium for monthly allowance.',
            [
              { text: 'OK', style: 'default' },
              { text: 'Get More', style: 'default', onPress: () => {
                // Navigate to subscription screen - implement navigation logic here
                console.log('Navigate to subscription screen');
              }}
            ]
          );
        }
        return false;
      }

      if (showAlert) {
        Alert.alert('Success', `Connection request sent! ${result.remaining} remaining.`);
      }

      return true;
    } catch (error) {
      console.error('❌ Error using connection request:', error);
      if (showAlert) Alert.alert('Error', 'Failed to send connection request. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Use a first impression
  const useFirstImpression = useCallback(async (showAlert = true): Promise<boolean> => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (showAlert) Alert.alert('Error', 'Please log in to continue.');
        return false;
      }

      const result = await subscriptionService.useFirstImpression(user.id);
      
      if (!result.success) {
        if (showAlert) {
          Alert.alert(
            'No First Impressions Left',
            'You have no first impressions remaining. Purchase more or upgrade to Premium for monthly allowance.',
            [
              { text: 'OK', style: 'default' },
              { text: 'Get More', style: 'default', onPress: () => {
                // Navigate to subscription screen - implement navigation logic here
                console.log('Navigate to subscription screen');
              }}
            ]
          );
        }
        return false;
      }

      if (showAlert) {
        Alert.alert('Success', `First impression sent! ${result.remaining} remaining.`);
      }

      return true;
    } catch (error) {
      console.error('❌ Error using first impression:', error);
      if (showAlert) Alert.alert('Error', 'Failed to send first impression. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if can use connection request
  const canUseConnectionRequest = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const quotas = await subscriptionService.getDetailedQuotas(user.id);
      return quotas.connectionRequests.total > 0;
    } catch (error) {
      console.error('❌ Error checking connection request availability:', error);
      return false;
    }
  }, []);

  // Check if can use first impression
  const canUseFirstImpression = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const quotas = await subscriptionService.getDetailedQuotas(user.id);
      return quotas.firstImpressions.total > 0;
    } catch (error) {
      console.error('❌ Error checking first impression availability:', error);
      return false;
    }
  }, []);

  // Check if has invisible mode
  const hasInvisibleMode = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const result = await subscriptionService.hasInvisibleMode(user.id);
      return result.active;
    } catch (error) {
      console.error('❌ Error checking invisible mode:', error);
      return false;
    }
  }, []);

  // Get detailed quota information
  const getQuotaDetails = useCallback(async (): Promise<QuotaDetails | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      return await subscriptionService.getDetailedQuotas(user.id);
    } catch (error) {
      console.error('❌ Error getting quota details:', error);
      return null;
    }
  }, []);

  return {
    loading,
    useConnectionRequest,
    useFirstImpression,
    canUseConnectionRequest,
    canUseFirstImpression,
    hasInvisibleMode,
    getQuotaDetails,
  };
};

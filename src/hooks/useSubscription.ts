import { Alert } from 'react-native';
import subscriptionService from '../services/subscriptionService';
import { supabase } from '../integrations/supabase/client';

// Re-export from SubscriptionContext for backward compatibility
export { useSubscription } from '../contexts/SubscriptionContext';

export const checkConnectionQuota = async (userId: string, showAlert = true): Promise<boolean> => {
  try {
    const quotas = await subscriptionService.getUserQuotas(userId);
    const remaining = (quotas?.connection_requests_remaining || 0) + 
      (quotas?.connection_requests_purchased || 0);
    
    if (remaining <= 0) {
      if (showAlert) {
        Alert.alert(
          'No Connection Requests',
          'You have no connection requests remaining. Upgrade to Premium or purchase extras to send more requests.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'View Plans', onPress: () => {
              // Navigation will be handled by the calling screen
              return false;
            }},
          ]
        );
      }
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error checking connection quota:', error);
    return false;
  }
};

export const checkFirstImpressionQuota = async (userId: string, showAlert = true): Promise<boolean> => {
  try {
    const quotas = await subscriptionService.getUserQuotas(userId);
    const remaining = (quotas?.first_impressions_remaining || 0) + 
      (quotas?.first_impressions_purchased || 0);
    
    if (remaining <= 0) {
      if (showAlert) {
        Alert.alert(
          'No First Impressions',
          'You have no first impressions remaining. Upgrade to Premium or purchase extras to send first impressions.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'View Plans', onPress: () => {
              // Navigation will be handled by the calling screen
              return false;
            }},
          ]
        );
      }
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error checking first impression quota:', error);
    return false;
  }
};

export const useConnectionQuota = async (userId: string): Promise<boolean> => {
  try {
    const quotas = await subscriptionService.getUserQuotas(userId);
    const subscription = await subscriptionService.getSubscriptionStatus(userId);
    
    // Determine which quota to use
    if (quotas.connection_requests_purchased > 0) {
      // Use purchased quota first
      await supabase
        .from('user_quotas')
        .update({ 
          connection_requests_purchased: quotas.connection_requests_purchased - 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else if (quotas.connection_requests_remaining > 0) {
      // Use subscription quota
      await supabase
        .from('user_quotas')
        .update({ 
          connection_requests_remaining: quotas.connection_requests_remaining - 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error using connection quota:', error);
    return false;
  }
};

export const useFirstImpressionQuota = async (userId: string): Promise<boolean> => {
  try {
    const quotas = await subscriptionService.getUserQuotas(userId);
    
    // Determine which quota to use
    if (quotas.first_impressions_purchased > 0) {
      // Use purchased quota first
      await supabase
        .from('user_quotas')
        .update({ 
          first_impressions_purchased: quotas.first_impressions_purchased - 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else if (quotas.first_impressions_remaining > 0) {
      // Use subscription quota
      await supabase
        .from('user_quotas')
        .update({ 
          first_impressions_remaining: quotas.first_impressions_remaining - 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    } else {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error using first impression quota:', error);
    return false;
  }
};
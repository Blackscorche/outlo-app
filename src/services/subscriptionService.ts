// CLEAN Subscription Service - Only Database Updates
import { supabase } from '../integrations/supabase/client';
import { Alert, Linking, Platform } from 'react-native';

export type SubscriptionTier = 'basic' | 'premium';
export type BillingPeriod = 'monthly' | 'yearly';

export interface UserSubscription {
  tier: SubscriptionTier;
  status: string;
  billingPeriod?: BillingPeriod;
  currentPeriodEnd?: string;
  productId?: string;
}

export interface UserQuotas {
  connection_requests_remaining: number;
  connection_requests_purchased: number;
  first_impressions_remaining: number;
  first_impressions_purchased: number;
  invisible_mode_expires_at?: string;
}

// Legacy exports for compatibility - remove these later
export const SUBSCRIPTION_PLANS = {
  basic: { tier: 'basic', price: 0, features: { connectionRequests: 1, firstImpressions: 0, invisibleMode: false } },
  premium_monthly: { tier: 'premium', price: 1499, features: { connectionRequests: 10, firstImpressions: 3, invisibleMode: true } },
  premium_yearly: { tier: 'premium', price: 14400, features: { connectionRequests: 10, firstImpressions: 3, invisibleMode: true } },
};

export const EXTRA_PURCHASES = {
  connection_request: { price: 100, quantity: 1 },
  first_impression: { price: 199, quantity: 1 },
  invisible_mode: { price: 499, duration: 30 },
};

class SubscriptionService {
  // Check and sync subscription status with Google Play delay handling
  async validateAndSyncSubscription(userId: string, forceIAPCheck = false): Promise<UserSubscription> {
    try {

      // Step 1: Check database subscription
      const dbSubscription = await this.getUserSubscription(userId);

      // Step 2: Check if subscription has expired (most reliable check)
      if (dbSubscription.current_period_end) {
        const expiryDate = new Date(dbSubscription.current_period_end);
        const now = new Date();
        
        if (now > expiryDate && dbSubscription.status === 'active') {
          await this.downgradeToBasic(userId, 'expired');
          return { tier: 'basic', status: 'expired' };
        }
      }

      // Step 3: Handle Google Play delays - only do aggressive IAP checking if forced or enough time has passed
      if (dbSubscription.tier === 'premium' && dbSubscription.status === 'active') {
        // Check if we should verify with IAP (accounting for Google Play delays)
        let shouldVerifyIAP = forceIAPCheck;
        
        if (!shouldVerifyIAP && dbSubscription.current_period_end) {
          const expiryDate = new Date(dbSubscription.current_period_end);
          const now = new Date();
          const timeSinceExpiry = now.getTime() - expiryDate.getTime();
          const gracePeriodMs = 24 * 60 * 60 * 1000; // 24 hours grace period
          
          // Only check IAP if we're past the grace period
          shouldVerifyIAP = timeSinceExpiry > gracePeriodMs;
        }

        if (shouldVerifyIAP) {
          const iapValid = await this.verifyWithIAP(userId, dbSubscription.productId || '');
          if (!iapValid) {
            await this.downgradeToBasic(userId, 'cancelled');
            return { tier: 'basic', status: 'cancelled' };
          }
        } else {
        }
      }

     
      return dbSubscription;

    } catch (error) {
      console.error("❌ Error validating subscription:", error);
      return { tier: 'basic', status: 'error' };
    }
  }

  // Verify subscription with IAP store
  private async verifyWithIAP(userId: string, productId: string): Promise<boolean> {
    try {
      // Import IAP service dynamically to avoid circular dependency
      const { useLoveMapIAP } = await import('./iapService');
      
      // This would be called from a component that has IAP context
      // For now, we'll return true and rely on app state checks
      // TODO: Implement proper IAP receipt validation
      return true;
    } catch (error) {
      console.error("❌ Error verifying with IAP:", error);
      return false;
    }
  }

  // Downgrade user to basic plan
 async downgradeToBasic(userId: string, reason: string): Promise<void> {
    try {

      // Update subscription
      const { error: subError } = await supabase
        .from('user_subscriptions' as any)
        .upsert({
          user_id: userId,
          tier: 'basic',
          status: reason === 'expired' ? 'expired' : 'cancelled',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (subError) throw subError;

      // Update quotas to basic
      const { error: quotaError } = await supabase
        .from('user_quotas' as any)
        .upsert({
          user_id: userId,
          connection_requests_remaining: 1,
          first_impressions_remaining: 0,
          connection_requests_purchased: 0,
          first_impressions_purchased: 0,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (quotaError) throw quotaError;

      console.log(`✅ User downgraded to basic, reason: ${reason}`);
    } catch (error) {
      console.error("❌ Error downgrading to basic:", error);
      throw error;
    }
  }

    // Get user's current subscription from database
  async getUserSubscription(userId: string): Promise<UserSubscription> {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions' as any)
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        return { tier: 'basic', status: 'inactive' };
      }

      return {
        tier: (data as any).tier as SubscriptionTier,
        status: (data as any).status,
        billingPeriod: (data as any).billing_period as BillingPeriod,
        currentPeriodEnd: (data as any).current_period_end,
        productId: (data as any).product_id,
        ...((data as any) || {})
      };
    } catch (error) {
      console.error("Error getting subscription:", error);
      return { tier: 'basic', status: 'inactive' };
    }
  }

  // Alias for compatibility with SubscriptionContext
  async getSubscriptionStatus(userId: string): Promise<UserSubscription> {
    return this.getUserSubscription(userId);
  }

  // Get user's current quotas from database
  async getUserQuotas(userId: string): Promise<UserQuotas> {
    try {
      const { data, error } = await supabase
        .from('user_quotas' as any)
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        return {
          connection_requests_remaining: 1,
          connection_requests_purchased: 0,
          first_impressions_remaining: 0,
          first_impressions_purchased: 0,
        };
      }

      return data as any;
    } catch (error) {
      console.error("Error getting quotas:", error);
      return {
        connection_requests_remaining: 0,
        connection_requests_purchased: 0,
        first_impressions_remaining: 0,
        first_impressions_purchased: 0,
      };
    }
  }

  // Process IAP purchase - Update database only
  async processIAPPurchase(userId: string, purchase: any): Promise<void> {
    console.log("🚀 ~ SubscriptionService ~ processIAPPurchase ~ userId:", userId,purchase)
    try {

      // Ensure user records exist first
      await this.ensureUserRecordsExist(userId);

      if (this.isSubscription(purchase.productId)) {
        await this.activateSubscription(userId, purchase.productId, purchase);
      } else {
        await this.addConsumable(userId, purchase.productId);
      }

      console.log("✅ Purchase processed successfully");
    } catch (error) {
      console.error("❌ Error processing purchase:", error);
      throw error;
    }
  }

  // Ensure user has subscription and quota records
  private async ensureUserRecordsExist(userId: string): Promise<void> {
    try {
      // Check if subscription record exists
      const { data: subExists } = await supabase
        .from('user_subscriptions' as any)
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (!subExists) {
        await supabase
          .from('user_subscriptions' as any)
          .insert({
            user_id: userId,
            tier: 'basic',
            status: 'inactive',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }

      // Check if quotas record exists
      const { data: quotaExists } = await supabase
        .from('user_quotas' as any)
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (!quotaExists) {
        await supabase
          .from('user_quotas' as any)
          .insert({
            user_id: userId,
            connection_requests_remaining: 1,
            connection_requests_purchased: 0,
            first_impressions_remaining: 0,
            first_impressions_purchased: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }

    } catch (error) {
      console.error("❌ Error ensuring user records:", error);
      // Don't throw - we'll try upsert anyway
    }
  }

  // Activate subscription in database
  private async activateSubscription(userId: string, productId: string, purchase: any): Promise<void> {
    console.log("🚀 ~ SubscriptionService ~ activateSubscription ~ purchase:", purchase)
    try{
    const billingPeriod: BillingPeriod = productId.includes('yearly') ? 'yearly' : 'monthly';
    const daysToAdd = billingPeriod === 'yearly' ? 365 : 30;
    
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + daysToAdd);

    // Update subscription using upsert with proper WHERE clause
    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions' as any)
      .upsert({
        user_id: userId,
        tier: 'premium',
        billing_period: billingPeriod,
        status: 'active',
        product_id: productId,
        iap_transaction_id: purchase.transactionId,
        payment_method: Platform.OS === 'ios' ? 'apple' : 'google',
        current_period_start: new Date().toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (subError) {
      console.error("❌ Subscription upsert error:", subError);
      throw subError;
    }


    // Update quotas using upsert with proper WHERE clause
    const { data: quotaData, error: quotaError } = await supabase
      .from('user_quotas' as any)
      .upsert({
        user_id: userId,
        connection_requests_remaining: 10,
        first_impressions_remaining: 3,
        connection_requests_purchased: 0, // Reset purchased ones
        first_impressions_purchased: 0,   // Reset purchased ones
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (quotaError) {
      console.error("❌ Quotas upsert error:", quotaError);
      throw quotaError;
    }
    }
    catch(error){
      console.error("Error in activateSubscription:", error); 
    }
  }

  // Add consumable to user's quotas
  private async addConsumable(userId: string, productId: string): Promise<void> {
    try {
      const quotas = await this.getUserQuotas(userId);
      const updates: any = { 
        user_id: userId, // Always include user_id for upsert
        updated_at: new Date().toISOString(),
        // Preserve existing values
        connection_requests_remaining: quotas.connection_requests_remaining || 0,
        first_impressions_remaining: quotas.first_impressions_remaining || 0,
        connection_requests_purchased: quotas.connection_requests_purchased || 0,
        first_impressions_purchased: quotas.first_impressions_purchased || 0,
      };

      switch (productId) {
        case 'lovemap_connection_request':
          updates.connection_requests_purchased = (quotas.connection_requests_purchased || 0) + 1;
          break;
        case 'lovemap_first_impression':
          updates.first_impressions_purchased = (quotas.first_impressions_purchased || 0) + 1;
          break;
        case 'lovemap_invisible_mode':
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          updates.invisible_mode_expires_at = expiresAt.toISOString();
          break;
      }

      const { data, error } = await supabase
        .from('user_quotas' as any)
        .upsert(updates, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error("❌ Consumable upsert error:", error);
        throw error;
      }

    } catch (error) {
      console.error("❌ Error in addConsumable:", error);
      throw error;
    }
  }

  // Use a connection request (deduct from available balance)
  async useConnectionRequest(userId: string): Promise<{ success: boolean; remaining: number }> {
    try {
      const quotas = await this.getUserQuotas(userId);
      
      // Calculate total available (remaining + purchased)
      const totalAvailable = (quotas.connection_requests_remaining || 0) + (quotas.connection_requests_purchased || 0);
      
      if (totalAvailable <= 0) {
        return { success: false, remaining: 0 };
      }

      // Deduct from purchased first, then remaining
      let newPurchased = quotas.connection_requests_purchased || 0;
      let newRemaining = quotas.connection_requests_remaining || 0;

      if (newPurchased > 0) {
        newPurchased -= 1;
      } else if (newRemaining > 0) {
        newRemaining -= 1;
      }

      const { error } = await supabase
        .from('user_quotas' as any)
        .upsert({
          user_id: userId,
          connection_requests_remaining: newRemaining,
          connection_requests_purchased: newPurchased,
          first_impressions_remaining: quotas.first_impressions_remaining || 0,
          first_impressions_purchased: quotas.first_impressions_purchased || 0,
          invisible_mode_expires_at: quotas.invisible_mode_expires_at,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      const remaining = newPurchased + newRemaining;
      
      return { success: true, remaining };
    } catch (error) {
      console.error("❌ Error using connection request:", error);
      return { success: false, remaining: 0 };
    }
  }

  // Use a first impression (deduct from available balance)
  async useFirstImpression(userId: string): Promise<{ success: boolean; remaining: number }> {
    try {
      const quotas = await this.getUserQuotas(userId);
      
      // Calculate total available (remaining + purchased)
      const totalAvailable = (quotas.first_impressions_remaining || 0) + (quotas.first_impressions_purchased || 0);
      
      if (totalAvailable <= 0) {
        return { success: false, remaining: 0 };
      }

      // Deduct from purchased first, then remaining
      let newPurchased = quotas.first_impressions_purchased || 0;
      let newRemaining = quotas.first_impressions_remaining || 0;

      if (newPurchased > 0) {
        newPurchased -= 1;
      } else if (newRemaining > 0) {
        newRemaining -= 1;
      }

      const { error } = await supabase
        .from('user_quotas' as any)
        .upsert({
          user_id: userId,
          connection_requests_remaining: quotas.connection_requests_remaining || 0,
          connection_requests_purchased: quotas.connection_requests_purchased || 0,
          first_impressions_remaining: newRemaining,
          first_impressions_purchased: newPurchased,
          invisible_mode_expires_at: quotas.invisible_mode_expires_at,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      const remaining = newPurchased + newRemaining;
      
      return { success: true, remaining };
    } catch (error) {
      console.error("❌ Error using first impression:", error);
      return { success: false, remaining: 0 };
    }
  }

  // Check if user has invisible mode active
  async hasInvisibleMode(userId: string): Promise<{ active: boolean; expiresAt?: string }> {
    try {
      // Check if premium subscriber
      const subscription = await this.getUserSubscription(userId);
      if (subscription.tier === 'premium' && subscription.status === 'active') {
        return { active: true };
      }

      // Check purchased invisible mode
      const quotas = await this.getUserQuotas(userId);
      if (quotas.invisible_mode_expires_at) {
        const expiryDate = new Date(quotas.invisible_mode_expires_at);
        const now = new Date();
        
        if (now < expiryDate) {
          return { active: true, expiresAt: quotas.invisible_mode_expires_at };
        }
      }

      return { active: false };
    } catch (error) {
      console.error("❌ Error checking invisible mode:", error);
      return { active: false };
    }
  }

  // Get comprehensive user quotas with calculated totals
  async getDetailedQuotas(userId: string): Promise<{
    connectionRequests: { remaining: number; purchased: number; total: number };
    firstImpressions: { remaining: number; purchased: number; total: number };
    invisibleMode: { active: boolean; expiresAt?: string; source: 'premium' | 'purchased' | 'none' };
  }> {
    try {
      const [quotas, subscription, invisibleStatus] = await Promise.all([
        this.getUserQuotas(userId),
        this.getUserSubscription(userId),
        this.hasInvisibleMode(userId)
      ]);

      // Connection requests
      const connectionRequestsRemaining = quotas.connection_requests_remaining || 0;
      const connectionRequestsPurchased = quotas.connection_requests_purchased || 0;
      const connectionRequestsTotal = connectionRequestsRemaining + connectionRequestsPurchased;

      // First impressions  
      const firstImpressionsRemaining = quotas.first_impressions_remaining || 0;
      const firstImpressionsPurchased = quotas.first_impressions_purchased || 0;
      const firstImpressionsTotal = firstImpressionsRemaining + firstImpressionsPurchased;

      // Invisible mode source
      let invisibleSource: 'premium' | 'purchased' | 'none' = 'none';
      if (subscription.tier === 'premium' && subscription.status === 'active') {
        invisibleSource = 'premium';
      } else if (invisibleStatus.active && invisibleStatus.expiresAt) {
        invisibleSource = 'purchased';
      }

      return {
        connectionRequests: {
          remaining: connectionRequestsRemaining,
          purchased: connectionRequestsPurchased,
          total: connectionRequestsTotal
        },
        firstImpressions: {
          remaining: firstImpressionsRemaining,
          purchased: firstImpressionsPurchased,
          total: firstImpressionsTotal
        },
        invisibleMode: {
          active: invisibleStatus.active,
          expiresAt: invisibleStatus.expiresAt,
          source: invisibleSource
        }
      };
    } catch (error) {
      console.error("❌ Error getting detailed quotas:", error);
      // Return safe defaults
      return {
        connectionRequests: { remaining: 0, purchased: 0, total: 0 },
        firstImpressions: { remaining: 0, purchased: 0, total: 0 },
        invisibleMode: { active: false, source: 'none' }
      };
    }
  }
  async cancelSubscription(userId: string, productId: string): Promise<boolean> {
    try {
      const isIAP = this.isSubscription(productId);
      
      if (isIAP) {
        // For IAP subscriptions, user must cancel through device settings
      Alert.alert(
        'Cancel Subscription',
        Platform.OS === 'ios'
          ? 'Go to Settings > Subscriptions, select LoveMap, then tap Cancel.'
          : 'Go to Google Play Store > Menu > Subscriptions, select LoveMap, then tap Cancel.',
        [
          { text: 'Close', style: 'cancel' },
          { 
            text: 'Take Me There', 
            onPress: () => {
              Alert.alert(
                'Confirm',
                'We’ll mark your subscription as cancelled in our system and send you to your device settings to finish the cancellation.',
                [
                  { text: 'Back', style: 'cancel' },
                  {
                    text: 'Continue',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await supabase
                          .from('user_subscriptions' as any)
                          .update({
                            status: 'cancelled',
                            updated_at: new Date().toISOString(),
                          })
                          .eq('user_id', userId);

                        if (Platform.OS === 'ios') {
                          Linking.openURL('App-Prefs:APPLE_ID&path=SUBSCRIPTIONS');
                        } else {
                          Linking.openURL('https://play.google.com/store/account/subscriptions');
                        }
                        
                      } catch (error) {
                        console.error('❌ Error updating subscription status:', error);
                        Alert.alert('Error', 'Could not update your subscription. Please try again.');
                      }
                    }
                  }
                ]
              );
            }
          }
        ]
      );
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error with cancellation:", error);
      return false;
    }
  }

  // Handle subscription state changes (when user cancels through device)
  async handleSubscriptionStateChange(userId: string, newState: any): Promise<void> {
    try {
      if (!newState) {
        // Subscription cancelled - downgrade to basic
        await supabase
          .from('user_subscriptions' as any)
          .update({
            tier: 'basic',
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        // Reset quotas to basic
        await supabase
          .from('user_quotas' as any)
          .update({
            connection_requests_remaining: 1,
            first_impressions_remaining: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

      }
    } catch (error) {
      console.error("Error handling state change:", error);
    }
  }

  // Legacy methods for compatibility - these do nothing now
  async createSubscriptionCheckout(): Promise<any> {
    throw new Error("Stripe removed - use IAP only");
  }

  async createReferral(userId: string, code: string): Promise<any> {
    return { referral_code: `LM${userId.substring(0, 8).toUpperCase()}` };
  }

  // Helper method
  private isSubscription(productId: string): boolean {
    return productId.includes('monthly') || productId.includes('yearly') || productId.includes('premium');
  }
}

export default new SubscriptionService();
// CLEAN Subscription Service - Only Database Updates
import { supabase } from '../integrations/supabase/client';
import { Alert, Linking, Platform } from 'react-native';

export type SubscriptionTier = 'basic' | 'premium';
export type BillingPeriod = 'monthly' | 'yearly';

export interface UserSubscription {
  tier: SubscriptionTier;
  status: string;
  billing_period?: BillingPeriod;
  current_period_end?: string;
  product_id?: string;
}

export interface UserQuotas {
  connection_requests_remaining: number;
  connection_requests_purchased: number;
  first_impressions_remaining: number;
  first_impressions_purchased: number;
  invisible_mode_expires_at?: string;
}

class SubscriptionService {
  // Get user's current subscription from database
  async getUserSubscription(userId: string): Promise<UserSubscription> {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.log("No subscription found, returning basic");
        return { tier: 'basic', status: 'inactive' };
      }

      return {
        tier: data.tier,
        status: data.status,
        billing_period: data.billing_period,
        current_period_end: data.current_period_end,
        product_id: data.iap_product_id,
      };
    } catch (error) {
      console.error("Error getting subscription:", error);
      return { tier: 'basic', status: 'inactive' };
    }
  }

  // Get user's current quotas from database
  async getUserQuotas(userId: string): Promise<UserQuotas> {
    try {
      const { data, error } = await supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.log("No quotas found, creating basic quotas");
        return {
          connection_requests_remaining: 1,
          connection_requests_purchased: 0,
          first_impressions_remaining: 0,
          first_impressions_purchased: 0,
        };
      }

      return data;
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
  async processIAPPurchase(productId: string, purchase: any): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      console.log("🔄 Processing IAP purchase:", productId);

      if (this.isSubscription(productId)) {
        await this.activateSubscription(user.id, productId, purchase);
      } else {
        await this.addConsumable(user.id, productId);
      }

      console.log("✅ Purchase processed successfully");
    } catch (error) {
      console.error("❌ Error processing purchase:", error);
      throw error;
    }
  }

  // Activate subscription in database
  private async activateSubscription(userId: string, productId: string, purchase: any): Promise<void> {
    const billingPeriod: BillingPeriod = productId.includes('yearly') ? 'yearly' : 'monthly';
    const daysToAdd = billingPeriod === 'yearly' ? 365 : 30;
    
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + daysToAdd);

    // Update subscription
    await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        tier: 'premium',
        billing_period: billingPeriod,
        status: 'active',
        iap_product_id: productId,
        iap_transaction_id: purchase.transactionId,
        current_period_start: new Date().toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    // Update quotas to premium
    await supabase
      .from('user_quotas')
      .upsert({
        user_id: userId,
        connection_requests_remaining: 10,
        first_impressions_remaining: 3,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    console.log("✅ Subscription activated:", { billingPeriod, productId });
  }

  // Add consumable to user's quotas
  private async addConsumable(userId: string, productId: string): Promise<void> {
    const quotas = await this.getUserQuotas(userId);
    const updates: any = { updated_at: new Date().toISOString() };

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

    await supabase
      .from('user_quotas')
      .update(updates)
      .eq('user_id', userId);

    console.log("✅ Consumable added:", { productId, updates });
  }

  // Cancel subscription - Guide user to device settings
  async cancelSubscription(userId: string, productId: string): Promise<boolean> {
    try {
      const isIAP = this.isSubscription(productId);
      
      if (isIAP) {
        // For IAP subscriptions, user must cancel through device settings
        Alert.alert(
          'Cancel Subscription',
          'To cancel your subscription, please go to your device settings:\n\n' +
          (Platform.OS === 'ios' 
            ? '1. Open Settings app\n2. Tap your name at top\n3. Tap Subscriptions\n4. Select LoveMap\n5. Tap Cancel Subscription'
            : '1. Open Google Play Store\n2. Tap Menu → Subscriptions\n3. Select LoveMap\n4. Tap Cancel Subscription'),
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('App-Prefs:APPLE_ID&path=SUBSCRIPTIONS');
                } else {
                  Linking.openURL('https://play.google.com/store/account/subscriptions');
                }
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
          .from('user_subscriptions')
          .update({
            tier: 'basic',
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        // Reset quotas to basic
        await supabase
          .from('user_quotas')
          .update({
            connection_requests_remaining: 1,
            first_impressions_remaining: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log("✅ User downgraded to basic");
      }
    } catch (error) {
      console.error("Error handling state change:", error);
    }
  }

  // Helper method
  private isSubscription(productId: string): boolean {
    return productId.includes('monthly') || productId.includes('yearly') || productId.includes('premium');
  }
}

export default new SubscriptionService();

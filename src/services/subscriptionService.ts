import { supabase } from '../integrations/supabase/client';
import { Alert, Linking } from 'react-native';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

export type SubscriptionTier = 'basic' | 'premium';
export type BillingPeriod = 'monthly' | 'yearly';

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  billingPeriod?: BillingPeriod;
  price: number; // in cents
  features: {
    connectionRequests: number;
    firstImpressions: number;
    invisibleMode: boolean;
  };
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  basic: {
    tier: 'basic',
    price: 0,
    features: {
      connectionRequests: 1,
      firstImpressions: 0,
      invisibleMode: false,
    },
  },
  premium_monthly: {
    tier: 'premium',
    billingPeriod: 'monthly',
    price: 1499, // $14.99
    features: {
      connectionRequests: 10,
      firstImpressions: 3,
      invisibleMode: true,
    },
  },
  premium_yearly: {
    tier: 'premium',
    billingPeriod: 'yearly',
    price: 14400, // $144 (20% discount)
    features: {
      connectionRequests: 10,
      firstImpressions: 3,
      invisibleMode: true,
    },
  },
};

export const EXTRA_PURCHASES = {
  connection_request: {
    price: 100, // $1.00
    quantity: 1,
  },
  invisible_mode: {
    price: 499, // $4.99 per month
    duration: 30, // days
  },
  first_impression: {
    price: 199, // $1.99
    quantity: 1,
  },
};

class SubscriptionService {
  // Get user's current subscription
  async getUserSubscription(userId: string) {
    // Always try backend API first
    try {
      // Try to get fresh status from backend with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SUBSCRIPTION_STATUS}/${userId}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        // Ensure status field exists for premium subscriptions
        if (data.tier === 'premium' && !data.status) {
          data.status = 'active';
        }
        return data;
      }
    } catch (error) {
      // Silently fall back to local database
      console.log('Backend unavailable, using local database');
    }

    // Fallback to local database
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        // Don't throw, just return default
      }

      // Ensure status field exists for premium subscriptions
      if (data) {
        if (data.tier === 'premium' && !data.status) {
          data.status = 'active';
        }
        return data;
      }

      return {
        tier: 'basic',
        status: 'active',
        billing_period: null,
        current_period_end: null,
      };
    } catch (err) {
      // If all else fails, return basic subscription
      return {
        tier: 'basic',
        status: 'active',
        billing_period: null,
        current_period_end: null,
      };
    }
  }

  // Get user's current quotas
  async getUserQuotas(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching quotas:', error);
      }

      // Create default quotas if none exist
      if (!data) {
        const { data: newQuotas, error: createError } = await supabase
          .from('user_quotas')
          .upsert({
            user_id: userId,
            connection_requests_remaining: 1,
            first_impressions_remaining: 0,
            connection_requests_purchased: 0,
            first_impressions_purchased: 0,
          }, {
            onConflict: 'user_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating quotas:', createError);
          // Return default quotas if creation fails
          return {
            user_id: userId,
            connection_requests_remaining: 1,
            first_impressions_remaining: 0,
            connection_requests_purchased: 0,
            first_impressions_purchased: 0,
            invisible_mode_expires_at: null,
            last_reset_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }

        return newQuotas;
      }

      return data;
    } catch (err) {
      console.error('Unexpected error in getUserQuotas:', err);
      // Return default quotas
      return {
        user_id: userId,
        connection_requests_remaining: 1,
        first_impressions_remaining: 0,
        connection_requests_purchased: 0,
        first_impressions_purchased: 0,
        invisible_mode_expires_at: null,
        last_reset_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  }

  // Check if user can send connection request
  async canSendConnectionRequest(userId: string): Promise<boolean> {
    const quotas = await this.getUserQuotas(userId);
    return (quotas.connection_requests_remaining + quotas.connection_requests_purchased) > 0;
  }

  // Use a connection request
  async useConnectionRequest(userId: string): Promise<boolean> {
    const quotas = await this.getUserQuotas(userId);
    
    if (quotas.connection_requests_remaining > 0) {
      const { error } = await supabase
        .from('user_quotas')
        .update({
          connection_requests_remaining: quotas.connection_requests_remaining - 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return !error;
    } else if (quotas.connection_requests_purchased > 0) {
      const { error } = await supabase
        .from('user_quotas')
        .update({
          connection_requests_purchased: quotas.connection_requests_purchased - 1,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      return !error;
    }

    return false;
  }

  // Check if user can send first impression
  async canSendFirstImpression(userId: string): Promise<boolean> {
    const quotas = await this.getUserQuotas(userId);
    return (quotas.first_impressions_remaining + quotas.first_impressions_purchased) > 0;
  }

  // Cancel subscription
  async cancelSubscription(userId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CANCEL_SUBSCRIPTION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Cancel subscription failed:', response.status, errorData);
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return false;
    }
  }

  // Get subscription status with refresh from backend
  async getSubscriptionStatus(userId: string, forceRefresh: boolean = false) {
    if (forceRefresh) {
      // Try multiple times with increasing delays to handle webhook processing delays
      const maxRetries = 3;
      const delays = [1000, 2000, 3000]; // 1s, 2s, 3s
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, delays[i - 1]));
          }
          
          const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SUBSCRIPTION_STATUS}/${userId}`);
          if (response.ok) {
            const data = await response.json();
            
            // Ensure status field exists for premium subscriptions
            if (data.tier === 'premium' && !data.status) {
              data.status = 'active';
            }
            
            // Update local cache with fresh data
            if (data.tier || data.status) {
              // Save to local database for future use
              await supabase
                .from('user_subscriptions')
                .upsert({
                  user_id: userId,
                  tier: data.tier,
                  billing_period: data.billing_period,
                  status: data.status,
                  current_period_start: data.current_period_start,
                  current_period_end: data.current_period_end,
                  updated_at: new Date().toISOString(),
                }, { 
                  onConflict: 'user_id',
                  ignoreDuplicates: false 
                });
                
              // Also update quotas if premium (including cancelled but still active)
              if (data.tier === 'premium' && (data.status === 'active' || data.status === 'cancelled')) {
                const plan = data.billing_period === 'yearly' ? 
                  SUBSCRIPTION_PLANS.premium_yearly : 
                  SUBSCRIPTION_PLANS.premium_monthly;
                  
                await supabase
                  .from('user_quotas')
                  .upsert({
                    user_id: userId,
                    connection_requests_remaining: plan.features.connectionRequests,
                    first_impressions_remaining: plan.features.firstImpressions,
                    updated_at: new Date().toISOString(),
                  }, {
                    onConflict: 'user_id',
                    ignoreDuplicates: false
                  });
              }
              
              return data;
            }
          }
        } catch (error) {
          console.error('Error fetching subscription status:', error);
          if (i === maxRetries - 1) {
            // Last attempt failed, continue to fallback
            break;
          }
        }
      }
    }

    // Use regular method for cached/local data
    return this.getUserSubscription(userId);
  }

  // Create subscription checkout
  async createSubscriptionCheckout(userId: string, plan: 'premium_monthly' | 'premium_yearly') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CREATE_SUBSCRIPTION_CHECKOUT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          plan,
          email: user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Checkout session error:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { checkoutUrl, sessionId } = await response.json();
      
      return { url: checkoutUrl };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to payment server. Please try again later.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  }
  
  // Simulate subscription purchase for demo/development
  async simulateSubscriptionPurchase(userId: string, plan: 'premium_monthly' | 'premium_yearly') {
    const planDetails = SUBSCRIPTION_PLANS[plan];
    
    // Update user subscription
    await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        tier: 'premium',
        billing_period: planDetails.billingPeriod,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });
    
    // Update user quotas
    await supabase
      .from('user_quotas')
      .upsert({
        user_id: userId,
        connection_requests_remaining: planDetails.features.connectionRequests,
        first_impressions_remaining: planDetails.features.firstImpressions,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });
  }

  // Create Stripe checkout session for extra purchases
  async createExtraPurchaseCheckout(userId: string, productType: keyof typeof EXTRA_PURCHASES, quantity: number = 1) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CREATE_EXTRA_PURCHASE_CHECKOUT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          productType,
          quantity,
          email: user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Checkout session error:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const responseData = await response.json();
      return { url: responseData.checkoutUrl, sessionId: responseData.sessionId };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to payment server. Please try again later.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  }

  // Legacy payment intent method (kept for compatibility)
  async createExtraPurchase(userId: string, productType: keyof typeof EXTRA_PURCHASES, quantity: number = 1) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CREATE_EXTRA_PURCHASE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          productType,
          quantity,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment');
      }

      const { clientSecret, paymentIntentId } = await response.json();

      return { 
        success: false, 
        clientSecret, 
        paymentIntentId,
        message: 'Payment sheet integration needed' 
      };
    } catch (error) {
      console.error('Error processing purchase:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to payment server. Please try again later.',
        [{ text: 'OK' }]
      );
      throw error;
    }
  }
  
  // Confirm extra purchase after payment
  async confirmExtraPurchase(paymentIntentId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.CONFIRM_EXTRA_PURCHASE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm purchase');
      }

      return await response.json();
    } catch (error) {
      console.error('Error confirming purchase:', error);
      throw error;
    }
  }
  
  // Simulate extra purchase for development
  async simulateExtraPurchase(userId: string, productType: keyof typeof EXTRA_PURCHASES, quantity: number = 1) {
    const product = EXTRA_PURCHASES[productType];
    const totalAmount = product.price * quantity;

    // Record purchase in database
    const { data: purchase } = await supabase
      .from('purchase_history')
      .insert({
        user_id: userId,
        product_type: productType,
        quantity: quantity,
        amount_cents: totalAmount,
        status: 'completed',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (purchase) {
      // Apply the purchase immediately
      await this.applyExtraPurchase(userId, productType, quantity);
    }

    return { success: true };
  }
  
  // Apply extra purchase to user's account
  async applyExtraPurchase(userId: string, productType: keyof typeof EXTRA_PURCHASES, quantity: number = 1) {
    const { data: quotas } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!quotas) throw new Error('User quotas not found');

    const updates: any = { updated_at: new Date().toISOString() };

    switch (productType) {
      case 'connection_request':
        updates.connection_requests_purchased = (quotas.connection_requests_purchased || 0) + quantity;
        break;
      case 'first_impression':
        updates.first_impressions_purchased = (quotas.first_impressions_purchased || 0) + quantity;
        break;
      case 'invisible_mode':
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        updates.invisible_mode_expires_at = expiresAt.toISOString();
        break;
    }

    await supabase
      .from('user_quotas')
      .update(updates)
      .eq('user_id', userId);
  }


  // Handle referral
  async createReferral(referrerId: string, referredEmail: string) {
    // Generate unique referral code
    const referralCode = `LM${referrerId.substring(0, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        referred_email: referredEmail,
        referral_code: referralCode,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  // Claim referral reward
  async claimReferralReward(referralCode: string, newUserId: string) {
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('referral_code', referralCode)
      .single();

    if (!referral || referral.reward_claimed) {
      return false;
    }

    // Update referral
    await supabase
      .from('referrals')
      .update({
        referred_user_id: newUserId,
        reward_claimed: true,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', referral.id);

    // Add 5 connection requests to referrer
    const { data: quotas } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', referral.referrer_id)
      .single();

    if (quotas) {
      await supabase
        .from('user_quotas')
        .update({
          connection_requests_purchased: (quotas.connection_requests_purchased || 0) + 5,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', referral.referrer_id);
    }

    return true;
  }

  // Check if user has invisible mode
  async hasInvisibleMode(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    if (subscription.tier === 'premium' && (subscription.status === 'active' || subscription.status === 'cancelled')) {
      return true;
    }

    const quotas = await this.getUserQuotas(userId);
    if (quotas.invisible_mode_expires_at) {
      return new Date(quotas.invisible_mode_expires_at) > new Date();
    }

    return false;
  }
}

export default new SubscriptionService();
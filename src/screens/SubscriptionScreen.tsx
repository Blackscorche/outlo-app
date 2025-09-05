import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';
import subscriptionService, { SUBSCRIPTION_PLANS, EXTRA_PURCHASES } from '../services/subscriptionService';
import { supabase } from '../integrations/supabase/client';
import { useSubscription } from '../hooks/useSubscription';

const SubscriptionScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [cancelling, setCancelling] = useState(false);
  const { subscription, quotas, refreshSubscription } = useSubscription();

  useEffect(() => {
    loadSubscriptionData();

    // Refresh data when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      try {
        // Simply refresh data when screen comes into focus
        // Don't try to check params as it may cause errors with navigation state
        loadSubscriptionData(true); // Force refresh to get updated quotas
      } catch (error) {
        console.error('Error on screen focus:', error);
        // Still try to load data even if there's an error
        loadSubscriptionData(true);
      }
    });

    return unsubscribe;
  }, [navigation]);

  const loadSubscriptionData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    
    try {
      // Refresh the subscription context data
      await refreshSubscription();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found in loadSubscriptionData');
        setLoading(false);
        return;
      }

      // Try to get referral code
      try {
        const { data: referral } = await supabase
          .from('referrals')
          .select('referral_code')
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (referral) {
          setReferralCode(referral.referral_code);
        } else {
          // Try to create a new referral code
          try {
            const newReferral = await subscriptionService.createReferral(user.id, '');
            if (newReferral) {
              setReferralCode(newReferral.referral_code);
            }
          } catch (err) {
            // Generate a simple referral code locally if creation fails
            setReferralCode(`LM${user.id.substring(0, 8).toUpperCase()}`);
          }
        }
      } catch (err) {
        // Ignore referral errors
        console.log('Could not load referral code');
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSubscribe = async (plan: 'premium_monthly' | 'premium_yearly') => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const session = await subscriptionService.createSubscriptionCheckout(user.id, plan);
      
      // Open Stripe checkout
      if (session.url) {
        Linking.openURL(session.url);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      Alert.alert('Error', 'Failed to start subscription process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your premium subscription? You will keep your benefits until the end of the current billing period.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              const success = await subscriptionService.cancelSubscription(user.id);
              if (success) {
                Alert.alert('Success', 'Your subscription has been cancelled. You will retain premium benefits until the end of your billing period.');
                // Force refresh with a small delay to ensure backend has processed the update
                setTimeout(() => {
                  loadSubscriptionData(true);
                }, 1000);
              } else {
                Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
              }
            } catch (error) {
              console.error('Error cancelling subscription:', error);
              Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleChangeSubscription = async (newPlan: 'premium_monthly' | 'premium_yearly') => {
    const currentPlan = subscription?.billing_period === 'yearly' ? 'premium_yearly' : 'premium_monthly';
    
    if (currentPlan === newPlan) {
      Alert.alert('Info', 'You are already on this plan.');
      return;
    }

    const planNames = {
      premium_monthly: 'Premium Monthly ($14.99/month)',
      premium_yearly: 'Premium Yearly ($144/year)'
    };

    Alert.alert(
      'Change Subscription',
      `Switch to ${planNames[newPlan]}? The change will take effect at the end of your current billing period.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch Plan',
          onPress: async () => {
            try {
              setLoading(true);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              // For now, we'll use the same checkout process
              // In production, you'd want to use Stripe's subscription update API
              const session = await subscriptionService.createSubscriptionCheckout(user.id, newPlan);
              
              if (session.url) {
                Linking.openURL(session.url);
              }
            } catch (error) {
              console.error('Error changing subscription:', error);
              Alert.alert('Error', 'Failed to change subscription. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handlePurchaseExtra = async (productType: keyof typeof EXTRA_PURCHASES) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to make a purchase');
        return;
      }

      // Create Stripe checkout session for extra purchase
      const session = await subscriptionService.createExtraPurchaseCheckout(user.id, productType);
      
      if (session.url) {
        // Open Stripe checkout in browser
        await Linking.openURL(session.url);
      } else {
        Alert.alert('Error', 'Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Error purchasing extra:', error);
      Alert.alert('Error', 'Failed to complete purchase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shareReferralCode = () => {
    const message = `Join me on LoveMap! Use my referral code ${referralCode} to get started. Download the app: https://lovemap.app/download`;
    
    Alert.alert(
      'Share Referral Code',
      message,
      [
        { text: 'Copy', onPress: () => console.log('Copied to clipboard') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isPremium = subscription?.tier === 'premium';
  const isActiveSubscription = isPremium && subscription?.status !== 'cancelled';
  
  // Check if invisible mode is active
  const isInvisibleModeActive = quotas?.invisible_mode_expires_at && 
    new Date(quotas.invisible_mode_expires_at) > new Date();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.title}>Subscription</Text>
          <TouchableOpacity 
            onPress={() => loadSubscriptionData(true)} 
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="refresh" size={24} color={theme.colors.text} />
            )}
          </TouchableOpacity>
        </View>

        {/* Current Plan */}
        <View style={styles.currentPlanSection}>
          <Text style={styles.sectionTitle}>Current Plan</Text>
          <View style={[styles.planCard, isPremium && styles.premiumCard]}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{isPremium ? 'Premium' : 'Basic'}</Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                {isPremium && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                  </View>
                )}
                {subscription?.status === 'cancelled' && (
                  <View style={[styles.premiumBadge, { backgroundColor: theme.colors.error + '20' }]}>
                    <Text style={{ fontSize: theme.fontSize.xs, color: theme.colors.error }}>Cancelling</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.planPrice}>
              {isPremium ? 
                (subscription.billing_period === 'yearly' ? '$144/year' : '$14.99/month') 
                : 'Free'}
            </Text>
            {subscription?.status === 'cancelled' && subscription?.current_period_end && (
              <Text style={styles.expiryText}>
                Active until {new Date(subscription.current_period_end).toLocaleDateString()}
              </Text>
            )}
          </View>
          
          {/* Cancel Subscription Button for Premium Users */}
          {isActiveSubscription && (
            <TouchableOpacity 
              style={[styles.cancelButton, cancelling && styles.disabledButton]}
              onPress={handleCancelSubscription}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color={theme.colors.error} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color={theme.colors.error} />
                  <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Current Quotas */}
        <View style={styles.quotasSection}>
          <Text style={styles.sectionTitle}>Your Quotas</Text>
          <View style={styles.quotasList}>
            <View style={styles.quotaItem}>
              <View style={styles.quotaInfo}>
                <Ionicons name="people" size={20} color={theme.colors.primary} />
                <Text style={styles.quotaText}>Connection Requests</Text>
              </View>
              <Text style={styles.quotaValue}>
                {(quotas?.connection_requests_remaining || 0) + (quotas?.connection_requests_purchased || 0)}
              </Text>
            </View>
            <View style={styles.quotaItem}>
              <View style={styles.quotaInfo}>
                <Ionicons name="mail" size={20} color={theme.colors.primary} />
                <Text style={styles.quotaText}>First Impressions</Text>
              </View>
              <Text style={styles.quotaValue}>
                {(quotas?.first_impressions_remaining || 0) + (quotas?.first_impressions_purchased || 0)}
              </Text>
            </View>
            <View style={styles.quotaItem}>
              <View style={styles.quotaInfo}>
                <Ionicons name="eye-off" size={20} color={theme.colors.primary} />
                <Text style={styles.quotaText}>Invisible Mode</Text>
              </View>
              <Text style={styles.quotaValue}>
                {quotas?.invisible_mode_expires_at ? 
                  `Until ${new Date(quotas.invisible_mode_expires_at).toLocaleDateString()}` 
                  : (isPremium ? 'Active' : 'Not Active')}
              </Text>
            </View>
          </View>
        </View>

        {/* Switch Plan Option for Premium Monthly Users */}
        {isActiveSubscription && subscription?.billing_period === 'monthly' && (
          <View style={styles.plansSection}>
            <Text style={styles.sectionTitle}>Save with Yearly Plan</Text>
            <TouchableOpacity 
              style={[styles.planOption, styles.recommendedPlan]}
              onPress={() => handleChangeSubscription('premium_yearly')}
            >
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>SAVE 20%</Text>
              </View>
              <View style={styles.planDetails}>
                <Text style={styles.planOptionName}>Premium Yearly</Text>
                <Text style={styles.planOptionPrice}>$144/year ($12/month)</Text>
                <View style={styles.planFeatures}>
                  <Text style={styles.featureItem}>• All Premium features</Text>
                  <Text style={styles.featureItem}>• Save $36 per year</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Switch Plan Option for Premium Yearly Users */}
        {isActiveSubscription && subscription?.billing_period === 'yearly' && (
          <View style={styles.plansSection}>
            <Text style={styles.sectionTitle}>Switch to Monthly</Text>
            <TouchableOpacity 
              style={styles.planOption}
              onPress={() => handleChangeSubscription('premium_monthly')}
            >
              <View style={styles.planDetails}>
                <Text style={styles.planOptionName}>Premium Monthly</Text>
                <Text style={styles.planOptionPrice}>$14.99/month</Text>
                <View style={styles.planFeatures}>
                  <Text style={styles.featureItem}>• All Premium features</Text>
                  <Text style={styles.featureItem}>• Pay monthly</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Upgrade Plans - Show for Basic users or cancelled subscriptions */}
        {(!isPremium || subscription?.status === 'cancelled') && (
          <View style={styles.plansSection}>
            <Text style={styles.sectionTitle}>Upgrade to Premium</Text>
            
            <TouchableOpacity 
              style={styles.planOption}
              onPress={() => handleSubscribe('premium_monthly')}
            >
              <View style={styles.planDetails}>
                <Text style={styles.planOptionName}>Premium Monthly</Text>
                <Text style={styles.planOptionPrice}>$14.99/month</Text>
                <View style={styles.planFeatures}>
                  <Text style={styles.featureItem}>• 10 connection requests/month</Text>
                  <Text style={styles.featureItem}>• 3 first impressions/month</Text>
                  <Text style={styles.featureItem}>• Invisible mode</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.planOption, styles.recommendedPlan]}
              onPress={() => handleSubscribe('premium_yearly')}
            >
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>SAVE 20%</Text>
              </View>
              <View style={styles.planDetails}>
                <Text style={styles.planOptionName}>Premium Yearly</Text>
                <Text style={styles.planOptionPrice}>$144/year ($12/month)</Text>
                <View style={styles.planFeatures}>
                  <Text style={styles.featureItem}>• All Premium features</Text>
                  <Text style={styles.featureItem}>• Save $36 per year</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Buy Extras */}
        <View style={styles.extrasSection}>
          <Text style={styles.sectionTitle}>Buy Extras</Text>
          
          <View style={[styles.extraItem, loading && styles.disabledItem]}>
            <View style={styles.extraInfo}>
              <Ionicons name="person-add" size={24} color={theme.colors.primary} />
              <View style={styles.extraDetails}>
                <Text style={styles.extraName}>Connection Request</Text>
                <Text style={styles.extraPrice}>$1.00 each</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.buyButton, loading && styles.disabledButton]} 
              onPress={() => handlePurchaseExtra('connection_request')}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buyButtonText}>Buy</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.extraItem, (loading || isPremium || isInvisibleModeActive) && styles.disabledItem]}>
            <View style={styles.extraInfo}>
              <Ionicons name="eye-off" size={24} color={theme.colors.primary} />
              <View style={styles.extraDetails}>
                <Text style={styles.extraName}>Invisible Mode</Text>
                <Text style={styles.extraPrice}>$4.99/month</Text>
                {isInvisibleModeActive && !isPremium && (
                  <Text style={styles.activeUntilText}>
                    Active until {new Date(quotas.invisible_mode_expires_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
            {isPremium ? (
              <Text style={styles.includedText}>Included</Text>
            ) : isInvisibleModeActive ? (
              <Text style={styles.activeText}>Active</Text>
            ) : (
              <TouchableOpacity 
                style={[styles.buyButton, loading && styles.disabledButton]} 
                onPress={() => handlePurchaseExtra('invisible_mode')}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buyButtonText}>Buy</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.extraItem, loading && styles.disabledItem]}>
            <View style={styles.extraInfo}>
              <Ionicons name="mail" size={24} color={theme.colors.primary} />
              <View style={styles.extraDetails}>
                <Text style={styles.extraName}>First Impression</Text>
                <Text style={styles.extraPrice}>$1.99 each</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.buyButton, loading && styles.disabledButton]} 
              onPress={() => handlePurchaseExtra('first_impression')}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buyButtonText}>Buy</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Referral Program */}
        <View style={styles.referralSection}>
          <Text style={styles.sectionTitle}>Referral Program</Text>
          <Text style={styles.referralText}>
            Invite friends and get 5 free connection requests for each friend who joins!
          </Text>
          <View style={styles.referralCodeContainer}>
            <Text style={styles.referralCode}>{referralCode}</Text>
            <TouchableOpacity 
              style={styles.shareButton}
              onPress={shareReferralCode}
            >
              <Ionicons name="share-outline" size={20} color="white" />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  currentPlanSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  planCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  premiumCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  planName: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  premiumBadge: {
    backgroundColor: theme.colors.primary + '20',
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  planPrice: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  cancelButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledItem: {
    opacity: 0.6,
  },
  expiryText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  quotasSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  quotasList: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  quotaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  quotaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  quotaText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  quotaValue: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  plansSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  planOption: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recommendedPlan: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    position: 'relative',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  recommendedText: {
    color: 'white',
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  planDetails: {
    flex: 1,
  },
  planOptionName: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  planOptionPrice: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  planFeatures: {
    gap: 4,
  },
  featureItem: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  extrasSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  extraItem: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  extraInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  extraDetails: {
    flex: 1,
  },
  extraName: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
  },
  extraPrice: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  buyButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  buyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  includedText: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  activeText: {
    color: theme.colors.success,
    fontWeight: '600',
  },
  activeUntilText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.success,
    marginTop: 2,
  },
  referralSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xxxl,
  },
  referralText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  referralCodeContainer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  referralCode: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
    letterSpacing: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  shareButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default SubscriptionScreen;
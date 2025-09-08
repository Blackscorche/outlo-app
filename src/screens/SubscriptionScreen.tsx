import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';
import subscriptionService from '../services/subscriptionService';
import { supabase } from '../integrations/supabase/client';
import { useSubscription } from '../hooks/useSubscription';
import { useIAP } from '../components/IAPProvider';
import { useQuotaManager } from '../hooks/useQuotaManager';
import { QuotaDebugPanel } from '../components/QuotaDebugPanel';

const SubscriptionScreen = ({ navigation }: { navigation: any }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { subscription, quotas, refreshSubscription, validateSubscription } = useSubscription();
  const iap = useIAP();
  const quotaManager = useQuotaManager();

  useEffect(() => {
    loadSubscriptionData();
    // Refresh when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadSubscriptionData(true);
    });

    // Listen for app state changes (when user returns from device settings)
    const handleAppStateChange = (nextAppState: any) => {
      if (nextAppState === 'active') {
        console.log('📱 App became active, checking for subscription changes...');
        loadSubscriptionData(true); // Force refresh when returning to app
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      unsubscribe();
      appStateSubscription?.remove();
    };
  }, [navigation]);

  // Load products when IAP connects
  useEffect(() => {
    if (iap.connected) {
      console.log('🔄 Loading IAP products...');
      iap.loadProducts();
      iap.getPurchaseHistory()
    }
    
    // Debug info
    if (__DEV__) {
      console.log('=== IAP Status ===');
      console.log('Connected:', iap.connected);
      console.log('Products loaded:', iap.products);
      console.log('Subscriptions loaded:', iap.subscriptions.length);
      console.log("avaial purchasesdad", iap.products, iap.availablePurchases);
      console.log("🔍 Checking subscription status with IAP data");
      console.log("Available purchases:", iap.availablePurchases?.length || 0);
      console.log("Subscription tier:", subscription?.tier);
      console.log("Subscription status:", subscription?.status);
    }
    (async () => {
      console.log("active subscriptions", await iap.hasActiveSubscriptions());

      // Don't auto-downgrade based solely on empty availablePurchases
      // Google Play can take hours/days to update after cancellation
      
      // Only downgrade if:
      // 1. No availablePurchases AND subscription is past expiry date
      // 2. OR subscription is marked as cancelled and past grace period
      
      if (iap.availablePurchases.length === 0 && subscription?.tier === 'premium') {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if subscription is actually expired
        let shouldDowngrade = false;
        let reason = '';

        if (subscription.current_period_end) {
          const expiryDate = new Date(subscription.current_period_end);
          const now = new Date();
          const timeSinceExpiry = now.getTime() - expiryDate.getTime();
          const oneDayInMs = 24 * 60 * 60 * 1000;

          if (now > expiryDate && timeSinceExpiry > oneDayInMs) {
            shouldDowngrade = true;
            reason = 'expired';
          } else if (subscription.status === 'cancelled' && timeSinceExpiry > oneDayInMs) {
            shouldDowngrade = true;
            reason = 'cancelled';
          }
        } else if (subscription.status === 'cancelled') {
          // No expiry date but marked as cancelled - likely safe to downgrade
          shouldDowngrade = true;
          reason = 'cancelled';
        }
        if (shouldDowngrade) {
          await subscriptionService.downgradeToBasic(user.id, reason);
          await refreshSubscription(); // Refresh UI
        } else {
          console.log("⏳ Keeping subscription active - within grace period or not expired");
        }
      }
    })();   
  }, [iap.connected, iap.products.length, iap.subscriptions.length]);

  const loadSubscriptionData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    
    try {
      await refreshSubscription();
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSubscribe = async (productId: string) => {
    try {
      if (!iap.connected) {
        Alert.alert('Error', 'Store connection not available. Please try again.');
        return;
      }

      const product = iap.subscriptions.find(s => s.id === productId);
      if (!product) {
        Alert.alert('Error', 'Subscription not found. Please try again.');
        return;
      }

      console.log(`🛒 Attempting to purchase: ${productId}`);
      setLoading(true);

      await iap.purchaseSubscription(productId, async () => {
        // await loadSubscriptionData();
      });

    } catch (error: any) {
      console.error('❌ Purchase error:', error);
      Alert.alert('Purchase Failed', error?.message || 'Failed to process subscription.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseExtra = async (productId: string) => {
    try {
      if (!iap.connected) {
        Alert.alert('Error', 'Store connection not available. Please try again.');
        return;
      }

      const product = iap.products.find(p => p.id === productId);
      if (!product) {
        Alert.alert('Error', 'Product not found. Please try again.');
        return;
      }

      // Show purchase confirmation with product details
      const productName = productId.includes('connection') ? 'Connection Request' :
                         productId.includes('impression') ? 'First Impression' :
                         productId.includes('invisible') ? 'Invisible Mode (30 days)' : 'Product';
      
      const productPrice = iap.getFormattedPrice(productId);

      Alert.alert(
        `Purchase ${productName}`,
        `Are you sure you want to purchase ${productName} for ${productPrice}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Purchase',
            style: 'default',
            onPress: async () => {
              try {
                console.log(`🛒 Attempting to purchase: ${productId}`);
                setLoading(true);
                
                await iap.purchaseConsumable(productId, async () => {
                  Alert.alert("please wait")
                  // await loadSubscriptionData();
                });
                
                // Show success message based on product type
                let successMessage = '';
                if (productId.includes('connection')) {
                  successMessage = 'Connection request purchased! You can now send an additional connection request.';
                } else if (productId.includes('impression')) {
                  successMessage = 'First impression purchased! You can now send an additional first impression message.';
                } else if (productId.includes('invisible')) {
                  successMessage = 'Invisible mode activated! You can now browse profiles invisibly for 30 days.';
                }

                Alert.alert('Purchase Successful! 🎉', successMessage);

                // Refresh quotas to show updated counts
                
              } catch (error: any) {
                console.error('❌ Purchase error:', error);
                Alert.alert('Purchase Failed', error?.message || 'Failed to complete purchase.');
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
      
    } catch (error: any) {
      console.error('❌ Purchase preparation error:', error);
      Alert.alert('Error', 'Failed to prepare purchase. Please try again.');
    }
  };

  const handleRestorePurchases = async () => {
    try {
      if (!iap.connected) {
        Alert.alert('Error', 'Store connection not available. Please try again.');
        return;
      }

      setLoading(true);
      await iap.restorePurchases();
      
      // Refresh subscription data after restore
      await refreshSubscription();
      
    } catch (error: any) {
      console.error('❌ Restore error:', error);
      Alert.alert('Restore Failed', error?.message || 'Failed to restore purchases.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPurchases = async () => {
    try {
      if (!iap.connected) {
        Alert.alert('Error', 'Store connection not available. Please try again.');
        return;
      }

      setLoading(true);
      console.log('🔄 Syncing purchases...');
      
      // Process any pending purchases
      await iap.processPendingPurchases();
      
      // Validate subscription status (with grace period)
      await refreshSubscription();
      
      // Also force validate with IAP
      const validationResult = await iap.checkSubscriptionStatusWithIAP();
      console.log('📊 Validation result:', validationResult);
      
      Alert.alert('Success', 'Purchases synced and subscription validated!');
      
    } catch (error: any) {
      console.error('❌ Sync error:', error);
      Alert.alert('Sync Failed', error?.message || 'Failed to sync purchases.');
    } finally {
      setLoading(false);
    }
  };

  const handleForceCheck = async () => {
    Alert.alert(
      'Force Check Subscription',
      'This will immediately check your subscription status with Google Play, ignoring the 24-hour grace period. Use this if you just cancelled your subscription and want to see the change immediately.\n\nNote: Google Play can take several hours to update after cancellation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Force Check',
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              console.log('🚨 Force checking subscription status...');
              
              // Force validation with IAP check (ignores grace period)
              await validateSubscription(true);
              
              Alert.alert('Success', 'Subscription status force-checked and updated!');
              
            } catch (error: any) {
              console.error('❌ Force check error:', error);
              Alert.alert('Check Failed', error?.message || 'Failed to check subscription.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelSubscription = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your premium subscription?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              setLoading(true);
              await subscriptionService.cancelSubscription(user.id, subscription?.product_id || '');
              
              // Refresh subscription data to reflect changes
              setTimeout(async () => {
                await refreshSubscription();
                setLoading(false);
              }, 1000); // Small delay to allow database update to complete
              
            } catch (error) {
              console.error('❌ Cancel error:', error);
              Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Get IAP product data
  const getProductData = (productId: string) => {
    const product = iap.getProduct(productId);
    const price = iap.getFormattedPrice(productId);
    
    if (!product) {
      // console.warn(`❌ Product not found: ${productId}`);
      return { name: 'Loading...', price: '$0.00' };
    }

    const name = productId.includes('monthly') ? 'Premium Monthly' : 
                 productId.includes('yearly') ? 'Premium Yearly' :
                 productId.includes('connection') ? 'Connection Request' :
                 productId.includes('impression') ? 'First Impression' :
                 productId.includes('invisible') ? 'Invisible Mode' : 'Product';
    
    return { name, price, product };
  };

  // if (loading) {
  //   return (
  //     <SafeAreaView style={styles.container}>
  //       <View style={styles.loadingContainer}>
  //         <ActivityIndicator size="large" color={theme.colors.primary} />
  //       </View>
  //     </SafeAreaView>
  //   );
  // }

  const isPremium = subscription?.tier === 'premium';
  const isActiveSubscription = isPremium && subscription?.status !== 'cancelled';
  const isInvisibleModeActive = quotas?.invisible_mode_expires_at && 
    new Date(quotas.invisible_mode_expires_at) > new Date();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.title}>Subscription</Text>
          <TouchableOpacity onPress={() => loadSubscriptionData(true)} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="refresh" size={24} color={theme.colors.text} />
            )}
          </TouchableOpacity>
        </View>

        {/* Current Plan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Plan</Text>
          <View style={[styles.planCard, isPremium && styles.premiumCard]}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{isPremium ? 'Premium' : 'Basic'}</Text>
              {isPremium && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                </View>
              )}
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
          
          {isActiveSubscription && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSubscription}>
              <Ionicons name="close-circle-outline" size={20} color={theme.colors.error} />
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Current Quotas */}
        <View style={styles.section}>
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
                {isPremium ? 'Active' : 
                 isInvisibleModeActive ? `Until ${new Date(quotas.invisible_mode_expires_at).toLocaleDateString()}` : 
                 'Not Active'}
              </Text>
            </View>
          </View>
        </View>

        {/* Upgrade Plans */}
        {(!isPremium || subscription?.status === 'cancelled') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upgrade to Premium</Text>
            
            {/* Monthly Plan */}
            {(() => {
              const monthlyData = getProductData('lovemap_premium_monthly');
              return (
                <TouchableOpacity 
                  style={styles.planOption}
                  onPress={() => handleSubscribe('lovemap_premium_monthly')}
                  disabled={!iap.connected || loading}
                >
                  <View style={styles.planDetails}>
                    <Text style={styles.planOptionName}>{monthlyData.name}</Text>
                    <Text style={styles.planOptionPrice}>{monthlyData.price}/month</Text>
                    <View style={styles.planFeatures}>
                      <Text style={styles.featureItem}>• 10 connection requests/month</Text>
                      <Text style={styles.featureItem}>• 3 first impressions/month</Text>
                      <Text style={styles.featureItem}>• Invisible mode</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={theme.colors.primary} />
                </TouchableOpacity>
              );
            })()}

            {/* Yearly Plan */}
            {(() => {
              const yearlyData = getProductData('lovemap_premium_yearly');
              return (
                <TouchableOpacity 
                  style={[styles.planOption, styles.recommendedPlan]}
                  onPress={() => handleSubscribe('lovemap_premium_yearly')}
                  disabled={!iap.connected || loading}
                >
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>SAVE 20%</Text>
                  </View>
                  <View style={styles.planDetails}>
                    <Text style={styles.planOptionName}>{yearlyData.name}</Text>
                    <Text style={styles.planOptionPrice}>{yearlyData.price}/year</Text>
                    <View style={styles.planFeatures}>
                      <Text style={styles.featureItem}>• All Premium features</Text>
                      <Text style={styles.featureItem}>• Save money annually</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={theme.colors.primary} />
                </TouchableOpacity>
              );
            })()}
          </View>
        )}

        {/* Buy Extras */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buy Extras</Text>
          
          {/* Connection Request */}
          {(() => {
            const data = getProductData('lovemap_connection_request');
            return (
              <View style={styles.extraItem}>
                <View style={styles.extraInfo}>
                  <Ionicons name="person-add" size={24} color={theme.colors.primary} />
                  <View style={styles.extraDetails}>
                    <Text style={styles.extraName}>{data.name}</Text>
                    <Text style={styles.extraPrice}>{data.price} each</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.buyButton, (!iap.connected || loading) && styles.disabledButton]} 
                  onPress={() => handlePurchaseExtra('lovemap_connection_request')}
                  disabled={loading || !iap.connected}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.buyButtonText}>Buy</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* Invisible Mode */}
          {(() => {
            const data = getProductData('lovemap_invisible_mode');
            return (
              <View style={[styles.extraItem, (isPremium || isInvisibleModeActive) && styles.disabledItem]}>
                <View style={styles.extraInfo}>
                  <Ionicons name="eye-off" size={24} color={theme.colors.primary} />
                  <View style={styles.extraDetails}>
                    <Text style={styles.extraName}>{data.name}</Text>
                    <Text style={styles.extraPrice}>{data.price}/month</Text>
                  </View>
                </View>
                {isPremium ? (
                  <Text style={styles.includedText}>Included</Text>
                ) : isInvisibleModeActive ? (
                  <Text style={styles.activeText}>Active</Text>
                ) : (
                  <TouchableOpacity 
                    style={[styles.buyButton, (!iap.connected || loading) && styles.disabledButton]} 
                    onPress={() => handlePurchaseExtra('lovemap_invisible_mode')}
                    disabled={loading || !iap.connected}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.buyButtonText}>Buy</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}

          {/* First Impression */}
          {(() => {
            const data = getProductData('lovemap_first_impression');
            return (
              <View style={styles.extraItem}>
                <View style={styles.extraInfo}>
                  <Ionicons name="mail" size={24} color={theme.colors.primary} />
                  <View style={styles.extraDetails}>
                    <Text style={styles.extraName}>{data.name}</Text>
                    <Text style={styles.extraPrice}>{data.price} each</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.buyButton, (!iap.connected || loading) && styles.disabledButton]} 
                  onPress={() => handlePurchaseExtra('lovemap_first_impression')}
                  disabled={loading || !iap.connected}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.buyButtonText}>Buy</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>

        {/* Restore Purchases */}
        {/* <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.syncButton, (!iap.connected || loading) && styles.disabledButton]}
            onPress={handleSyncPurchases}
            disabled={loading || !iap.connected}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="sync" size={20} color="#fff" />
                <Text style={styles.syncButtonText}>Sync Purchases</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.syncDescription}>
            Sync your purchases with the database to activate your subscription.
          </Text>

          <TouchableOpacity 
            style={[styles.forceCheckButton, (!iap.connected || loading) && styles.disabledButton]}
            onPress={handleForceCheck}
            disabled={loading || !iap.connected}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.error} />
            ) : (
              <>
                <Ionicons name="warning-outline" size={20} color={theme.colors.error} />
                <Text style={styles.forceCheckButtonText}>Force Check Status</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.forceCheckDescription}>
            Immediately check subscription status with Google Play (ignores 24h grace period).
          </Text>


          <TouchableOpacity 
            style={[styles.restoreButton, (!iap.connected || loading) && styles.disabledButton]}
            onPress={handleRestorePurchases}
            disabled={loading || !iap.connected}
          >
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.restoreDescription}>
            Already purchased? Restore your previous purchases here.
          </Text>
        </View> */}

        {/* Debug Panel (Development Only) */}
        <QuotaDebugPanel />
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
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
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
  expiryText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
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
  disabledButton: {
    opacity: 0.5,
  },
  disabledItem: {
    opacity: 0.6,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: 'transparent',
    alignSelf: 'center',
    marginTop: theme.spacing.md,
  },
  restoreButtonText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: theme.fontSize.base,
  },
  restoreDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignSelf: 'center',
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: theme.fontSize.base,
  },
  syncDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  forceCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.error,
    backgroundColor: 'transparent',
    alignSelf: 'center',
  },
  forceCheckButtonText: {
    color: theme.colors.error,
    fontWeight: '600',
    fontSize: theme.fontSize.base,
  },
  forceCheckDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
});

export default SubscriptionScreen;

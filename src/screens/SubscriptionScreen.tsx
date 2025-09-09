import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../styles/theme";
import { commonStyles } from "../styles/common";
import subscriptionService from "../services/subscriptionService";
import { supabase } from "../integrations/supabase/client";
import { useSubscription } from "../hooks/useSubscription";
import { QuotaDebugPanel } from "../components/QuotaDebugPanel";
import { usePurchaseModals } from "../hooks/usePurchaseModals";
import {
  PurchaseLoadingModal,
  PurchaseSuccessModal,
  PurchaseErrorModal,
  InfoModal,
} from "../components/PurchaseModals";
import { useLoveMapIAP } from "../services/iapService";

const SubscriptionScreen = ({ navigation }: { navigation: any }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [hideActiveSubscription, setHideActiveSubscription] = useState(false);
  const { subscription, quotas, refreshSubscription } =
    useSubscription();
  // Purchase modal management
  const {
    modalState,
    showLoading,
    showSuccess,
    showError,
    showInfo,
    hideModals,
  } = usePurchaseModals();
  // Use new IAP service with modal callbacks
  const iap = useLoveMapIAP({
    showLoading,
    showSuccess,
    showError,
    showInfo,
    hideModals,
  });
console.log(iap.availablePurchases,subscription,"iap.availablePurchasess")

  useEffect(() => {
    loadSubscriptionData();
    // Refresh when screen comes into focus
    const unsubscribe = navigation.addListener("focus", () => {
      loadSubscriptionData(true);
    });

    // Listen for app state changes (when user returns from device settings)
    const handleAppStateChange = async(nextAppState: any) => {
      console.log("🚀 ~ handleAppStateChange ~ nextAppState:", nextAppState)
      if (nextAppState === "active") {
       await loadSubscriptionData(true); // Force refresh when returning to app
       await iap.getAvailablePurchases();
      }
    };

    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      unsubscribe();
      appStateSubscription?.remove();
    };
  }, [navigation]);

  // Load products when IAP connects
  useEffect(() => {
    if (iap.connected && !initialLoading) {
      setInitialLoading(true);
      console.log("🔄 Loading IAP products...");
      iap.loadProducts();
      iap.getPurchaseHistory(() => {
        console.log("initial loading end here");
        setTimeout(() => {
          setInitialLoading(false);
        }, 3000);
      });
    }
    // Debug info
  }, [iap.connected]);

  // Create a stable dependency that tracks actual purchase changes (no memo needed)
  const purchaseIds = !iap.availablePurchases 
    ? '' 
    : iap.availablePurchases
        .map(purchase => purchase.productId)
        .sort()
        .join(',');

  // Create subscription product tracker (no memo needed)
  const hasActiveIAPSubscription = !iap.availablePurchases 
    ? false 
    : iap.availablePurchases.some(purchase => 
        ['lovemap_premium_monthly', 'lovemap_premium_yearly'].includes(purchase.productId)
      );

  console.log("🔄 purchaseIds recalculated:", purchaseIds);
  console.log("🔄 hasActiveIAPSubscription:", hasActiveIAPSubscription);

  useEffect(() => {
    async function handleSubscriptionState() {
      if (initialLoading) return;
      
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.log("❌ No authenticated user");
        return;
      }

      // Validate subscription data and dates
      if (!subscription?.current_period_end) {
        console.log("⚠️ No subscription period end date");
        return;
      }

      const expiryDate = new Date(subscription.current_period_end);
      const now = new Date();
      
      // Validate dates
      if (isNaN(expiryDate.getTime())) {
        console.log("❌ Invalid expiry date:", subscription.current_period_end);
        return;
      }

      console.log("📅 Date comparison:", {
        now: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        isExpired: now > expiryDate
      });

      const timeSinceExpiry = now.getTime() - expiryDate.getTime();
      const oneDayInMs = 24 * 60 * 60 * 1000;
      const isWithinGracePeriod = timeSinceExpiry <= oneDayInMs;

      console.log("⏰ Timing analysis:", {
        timeSinceExpiry: Math.round(timeSinceExpiry / (1000 * 60 * 60)) + " hours",
        isWithinGracePeriod,
        hasActiveIAPSubscription,
        isSubscriptionStillActive: now <= expiryDate
      });

      // Skip logic if availablePurchases is still loading (initial empty array)
      if (!iap.connected || initialLoading) {
        console.log("⏳ IAP not ready yet, skipping subscription sync");
        return;
      }

      // Case 1: User cancelled subscription but DB still shows active premium
      // This happens immediately when user cancels, even if subscription is still in active period
      if (
        subscription?.tier === "premium" &&
        subscription?.status === "active" &&
        !hasActiveIAPSubscription &&
        now <= expiryDate // Still in active period but no IAP subscription
      ) {
        console.log("🔄 Marking subscription as cancelled: User cancelled but still in active period");
        // Mark as cancelled but keep premium benefits until expiry
        const { error } = await supabase
          .from('user_subscriptions' as any)
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
          
        if (error) {
          console.error("❌ Error updating subscription status:", error);
        }
        await refreshSubscription();
        return;
      }

      // Case 2: User has premium in DB but no IAP subscription AND expired
      // Only downgrade if subscription is expired AND past grace period
      if (
        subscription?.tier === "premium" &&
        (subscription?.status === "active" || subscription?.status === "cancelled") &&
        !hasActiveIAPSubscription &&
        now > expiryDate &&
        !isWithinGracePeriod
      ) {
        console.log("⬇️ Downgrading: No IAP subscription found after grace period");
        await subscriptionService.downgradeToBasic(user.id, "expired");
        await refreshSubscription();
        return;
      }

      // Case 3: User has IAP subscription but DB shows cancelled/basic
      // Upgrade immediately regardless of timing
      if (
        hasActiveIAPSubscription &&
        (subscription?.tier !== "premium" || subscription?.status !== "active")
      ) {
        console.log("⬆️ Upgrading: Active IAP subscription found");
        // Find the actual purchase to process
        const activeSubscriptionPurchase = iap.availablePurchases.find(purchase => 
          ['lovemap_premium_monthly', 'lovemap_premium_yearly'].includes(purchase.productId)
        );
        
        if (activeSubscriptionPurchase) {
          await subscriptionService.processIAPPurchase(user.id, activeSubscriptionPurchase);
          await loadSubscriptionData();
        }
        return;
      }

      console.log("✅ Subscription state is consistent - no action needed");
    }
    
    handleSubscriptionState();
  }, [purchaseIds, initialLoading, subscription?.tier, subscription?.status, subscription?.current_period_end, hasActiveIAPSubscription]);

  const loadSubscriptionData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      await refreshSubscription();
    } catch (error) {
      console.error("Error loading subscription data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSubscribe = async (productId: string) => {
    try {
      if (!iap.connected) {
        console.log("❌ IAP not connected");
        showError(
          "Store Error",
          "Store connection not available. Please try again."
        );
        return;
      }

      const product = iap.subscriptions.find((s) => s.id === productId);
      if (!product) {
        console.log("❌ Product not found:", productId);
        showError("Product Error", "Subscription not found. Please try again.");
        return;
      }

      // Get product details for enhanced modals
      const productName = productId.includes("monthly")
        ? "Premium Monthly"
        : "Premium Yearly";
      const productPrice = iap.getFormattedPrice(productId);

      // Check if user is switching subscriptions
      const isSwitch = isPremium && (
        (productId.includes("monthly") && subscription?.billing_period === "yearly") ||
        (productId.includes("yearly") && subscription?.billing_period === "monthly")
      );

      if (isSwitch) {
        // Show subscription switch confirmation
        const currentPlan = subscription?.billing_period === "yearly" ? "Yearly" : "Monthly";
        const newPlan = productId.includes("monthly") ? "Monthly" : "Yearly";
        
        showInfo(
          "Switch Subscription Plan",
          `You're currently on Premium ${currentPlan}. Switching to Premium ${newPlan} will:\n\n• Start your new ${newPlan} subscription immediately\n• Your current ${currentPlan} subscription will continue until ${new Date(subscription?.current_period_end || '').toLocaleDateString()}\n• No double billing - you'll only pay for the new plan going forward\n\nProceed with switching to ${productName}?`,
          "info",
          async () => {
            try {
              hideModals();
              // Show enhanced loading modal
              showLoading("Switching your subscription...", productPrice, productName);

              await iap.purchaseSubscription(productId, async () => {
                console.log("✅ Subscription switch success callback triggered");
                // Purchase callback - reload data
                await loadSubscriptionData(true);
                await iap.getAvailablePurchases();
              });
            } catch (error: any) {
              console.error("❌ Purchase error in subscription switch:", error);
              showError(
                "Switch Failed",
                error?.message || "Failed to switch subscription."
              );
            }
          }
        );
      } else {
        // Regular subscription purchase
        showLoading("Processing your subscription...", productPrice, productName);

        await iap.purchaseSubscription(productId, async () => {
          console.log("✅ Purchase success callback triggered");
          // Purchase callback - reload data
          await loadSubscriptionData(true);
          await iap.getAvailablePurchases();
        });
      }
    } catch (error: any) {
      console.error("❌ Purchase error in handleSubscribe:", error);
      showError(
        "Purchase Failed",
        error?.message || "Failed to process subscription."
      );
    }
  };

  const handlePurchaseExtra = async (productId: string) => {
    try {
      if (!iap.connected) {
        showError(
          "Store Error",
          "Store connection not available. Please try again."
        );
        return;
      }

      const product = iap.products.find((p) => p.id === productId);
      if (!product) {
        showError("Product Error", "Product not found. Please try again.");
        return;
      }

      // Show purchase confirmation with product details
      const productName = productId.includes("connection")
        ? "Connection Request"
        : productId.includes("impression")
        ? "First Impression"
        : productId.includes("invisible")
        ? "Invisible Mode (30 days)"
        : "Product";

      const productPrice = iap.getFormattedPrice(productId);

      console.log(
        "📋 Showing confirmation modal for:",
        productName,
        productPrice
      );

      showInfo(
        `Purchase ${productName}`,
        `Are you sure you want to purchase ${productName} for ${productPrice}?`,
        "info",
        async () => {
          try {
            console.log(`✅ User confirmed purchase: ${productId}`);
            hideModals(); // Hide confirmation modal

            // Store product info for modals
            const modalProductName = productName;
            const modalPrice = productPrice;

            // The loading state will be shown automatically by the IAP service
            // But we'll override with our enhanced version
            showLoading(
              "Processing your purchase...",
              modalPrice,
              modalProductName
            );

            await iap.purchaseConsumable(productId, async () => {
              // Purchase callback - reload data
              await loadSubscriptionData(true);
              await iap.getAvailablePurchases();
            });
          } catch (error: any) {
            console.error("❌ Purchase execution error:", error);
            showError(
              "Purchase Failed",
              error?.message || "Failed to complete purchase."
            );
          }
        }
      );
    } catch (error: any) {
      console.error("❌ Purchase preparation error:", error);
      showError(
        "Purchase Error",
        "Failed to prepare purchase. Please try again."
      );
    }
  };

  const handleCancelSubscription = async () => {
    showInfo(
      "Cancel Subscription",
      Platform.OS === "ios"
        ? "To cancel your subscription, go to Settings > Subscriptions, select LoveMap, then tap Cancel."
        : "To cancel your subscription, go to Google Play Store > Menu > Subscriptions, select LoveMap, then tap Cancel.",
      "warning",
      async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;

          hideModals();

          // Show second confirmation
          showInfo(
            "Confirm Cancellation",
            "We'll mark your subscription as cancelled in our system and take you to your device settings to finish the cancellation.",
            "warning",
            async () => {
              try {
                hideModals();
                showLoading("Processing cancellation...");
                setHideActiveSubscription(true);
                // Update subscription status in database
                // await supabase
                //   .from('user_subscriptions' as any)
                //   .update({
                //     status: 'cancelled',
                //     updated_at: new Date().toISOString(),
                //   })
                //   .eq('user_id', user.id);

                // Open device settings
                const { Linking } = await import("react-native");
                if (Platform.OS === "ios") {
                  await Linking.openURL(
                    "App-Prefs:APPLE_ID&path=SUBSCRIPTIONS"
                  );
                } else {
                  await Linking.openURL(
                    "https://play.google.com/store/account/subscriptions"
                  );
                }

                // Refresh subscription data
                await refreshSubscription();
                hideModals();

                showInfo(
                  "Cancellation Initiated",
                  "Your subscription has been marked as cancelled. Please complete the cancellation in your device settings.",
                  "warning"
                );
              } catch (error) {
                console.error("❌ Cancel error:", error);
                showError(
                  "Cancellation Error",
                  "Failed to cancel subscription. Please try again."
                );
              }
            }
          );
        } catch (error) {
          console.error("❌ Cancel error:", error);
          showError(
            "Cancellation Error",
            "Failed to cancel subscription. Please try again."
          );
        }
      }
    );
  };

  // Get IAP product data
  const getProductData = (productId: string) => {
    const product = iap.getProduct(productId);
    const price = iap.getFormattedPrice(productId);

    if (!product) {
      // console.warn(`❌ Product not found: ${productId}`);
      return { name: "Loading...", price: "$0.00" };
    }

    const name = productId.includes("monthly")
      ? "Premium Monthly"
      : productId.includes("yearly")
      ? "Premium Yearly"
      : productId.includes("connection")
      ? "Connection Request"
      : productId.includes("impression")
      ? "First Impression"
      : productId.includes("invisible")
      ? "Invisible Mode"
      : "Product";

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

  // User is premium if they have premium tier AND either:
  // 1. Active IAP subscription, OR
  // 2. Cancelled but still within active period (grace period)
  const isPremium = (() => {
    if (subscription?.tier !== "premium") return false;
    
    // If they have active IAP, they're definitely premium
    if (hasActiveIAPSubscription) return true;
    
    // If cancelled but still within active period, still premium
    if (subscription?.status === "cancelled" && subscription?.current_period_end) {
      const expiryDate = new Date(subscription.current_period_end);
      const now = new Date();
      return now <= expiryDate; // Still in active period
    }
    
    return false;
  })();

  console.log("🔄 isPremium recalculated:", isPremium);

  // Show cancel button only if subscription is truly active (not cancelled)
  const isActiveSubscription = isPremium && subscription?.status === "active";
  const isInvisibleModeActive =
    quotas?.invisible_mode_expires_at &&
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
          <TouchableOpacity
            style={{ width: 25 }}
            onPress={async () => { await loadSubscriptionData(true);await iap.getAvailablePurchases()}}
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
        {initialLoading ? (
          <ActivityIndicator />
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Plan</Text>
            <View style={[styles.planCard, isPremium && styles.premiumCard]}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>
                  {isPremium ? "Premium" : "Basic"}
                </Text>
                {isPremium && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                  </View>
                )}
              </View>
              <Text style={styles.planPrice}>
                {isPremium
                  ? subscription.billing_period === "yearly"
                    ? `${iap.getFormattedPrice("lovemap_premium_yearly")}/year`
                    : `${iap.getFormattedPrice(
                        "lovemap_premium_monthly"
                      )}/month`
                  : "Free"}
              </Text>
              {subscription?.status === "cancelled" &&
                subscription?.current_period_end && (
                  <Text style={styles.expiryText}>
                    Active until{" "}
                    {new Date(
                      subscription.current_period_end
                    ).toLocaleDateString()}
                  </Text>
                )}
            </View>

            {isActiveSubscription && !hideActiveSubscription && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelSubscription}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color={theme.colors.error}
                />
                <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Current Quotas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Quotas</Text>
          <View style={styles.quotasList}>
            <View style={styles.quotaItem}>
              <View style={styles.quotaInfo}>
                <Ionicons
                  name="people"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.quotaText}>Connection Requests</Text>
              </View>
              <Text style={styles.quotaValue}>
                {(quotas?.connection_requests_remaining || 0) +
                  (quotas?.connection_requests_purchased || 0)}
              </Text>
            </View>
            <View style={styles.quotaItem}>
              <View style={styles.quotaInfo}>
                <Ionicons name="mail" size={20} color={theme.colors.primary} />
                <Text style={styles.quotaText}>First Impressions</Text>
              </View>
              <Text style={styles.quotaValue}>
                {(quotas?.first_impressions_remaining || 0) +
                  (quotas?.first_impressions_purchased || 0)}
              </Text>
            </View>
            <View style={styles.quotaItem}>
              <View style={styles.quotaInfo}>
                <Ionicons
                  name="eye-off"
                  size={20}
                  color={theme.colors.primary}
                />
                <Text style={styles.quotaText}>Invisible Mode</Text>
              </View>
              <Text style={styles.quotaValue}>
                {isPremium
                  ? "Active"
                  : isInvisibleModeActive
                  ? `Until ${new Date(
                      quotas.invisible_mode_expires_at
                    ).toLocaleDateString()}`
                  : "Not Active"}
              </Text>
            </View>
          </View>
        </View>

        {/* Subscription Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isPremium ? "Switch Subscription" : "Upgrade to Premium"}
          </Text>

            {/* Monthly Plan */}
            {(() => {
              const monthlyData = getProductData("lovemap_premium_monthly");
              const isCurrentPlan = isPremium && subscription?.billing_period === "monthly";
              const isCancelledButActive = isCurrentPlan && subscription?.status === "cancelled";
              
              return (
                <TouchableOpacity
                  style={[
                    styles.planOption, 
                    isCurrentPlan && styles.currentPlan,
                  ]}
                  onPress={() => {
                    if (isCurrentPlan && !isCancelledButActive) {
                      // Already subscribed to this plan and it's active
                      return;
                    }
                    handleSubscribe("lovemap_premium_monthly");
                  }}
                  disabled={!iap.connected || loading || (isCurrentPlan && !isCancelledButActive)}
                >
                  {isCurrentPlan && (
                    <View style={styles.currentPlanBadge}>
                      <Text style={styles.currentPlanText}>
                        {isCancelledButActive ? "ENDS" : "CURRENT"}
                      </Text>
                      {isCancelledButActive && (
                        <Text style={styles.expiryText}>
                          {new Date(subscription?.current_period_end || '').toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </Text>
                      )}
                    </View>
                  )}
                  <View style={styles.planDetails}>
                    <Text style={styles.planOptionName}>
                      {monthlyData.name}
                    </Text>
                    <Text style={styles.planOptionPrice}>
                      {monthlyData.price}/month
                    </Text>
                    <View style={styles.planFeatures}>
                      <Text style={styles.featureItem}>
                        • 10 connection requests/month
                      </Text>
                      <Text style={styles.featureItem}>
                        • 3 first impressions/month
                      </Text>
                      <Text style={styles.featureItem}>• Invisible mode</Text>
                    </View>
                  </View>
                  {isCurrentPlan && !isCancelledButActive ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.colors.success}
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={24}
                      color={theme.colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })()}

            {/* Yearly Plan */}
            {(() => {
              const yearlyData = getProductData("lovemap_premium_yearly");
              const isCurrentPlan = isPremium && subscription?.billing_period === "yearly";
              const isCancelledButActive = isCurrentPlan && subscription?.status === "cancelled";
              const monthlyUser = isPremium && subscription?.billing_period === "monthly";
              
              return (
                <TouchableOpacity
                  style={[
                    styles.planOption, 
                    !isCurrentPlan && styles.recommendedPlan,
                    isCurrentPlan && styles.currentPlan,
                  ]}
                  onPress={() => {
                    if (isCurrentPlan && !isCancelledButActive) {
                      // Already subscribed to this plan and it's active
                      return;
                    }
                    handleSubscribe("lovemap_premium_yearly");
                  }}
                  disabled={!iap.connected || loading || (isCurrentPlan && !isCancelledButActive)}
                >
                  {isCurrentPlan ? (
                    <View style={styles.currentPlanBadge}>
                      <Text style={styles.currentPlanText}>
                        {isCancelledButActive ? "ENDS" : "CURRENT"}
                      </Text>
                      {isCancelledButActive && (
                        <Text style={styles.expiryText}>
                          {new Date(subscription?.current_period_end || '').toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </Text>
                      )}
                    </View>
                  ) : monthlyUser ? (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>SWITCH & SAVE</Text>
                    </View>
                  ) : (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>SAVE 20%</Text>
                    </View>
                  )}
                  <View style={styles.planDetails}>
                    <Text style={styles.planOptionName}>
                      {yearlyData.name}
                    </Text>
                    <Text style={styles.planOptionPrice}>
                      {yearlyData.price}/year
                    </Text>
                    <View style={styles.planFeatures}>
                      <Text style={styles.featureItem}>
                        • All Premium features
                      </Text>
                      <Text style={styles.featureItem}>
                        • Save money annually
                      </Text>
                    </View>
                  </View>
                  {isCurrentPlan && !isCancelledButActive ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={theme.colors.success}
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={24}
                      color={theme.colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })()}
          </View>

        {/* Buy Extras */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buy Extras</Text>

          {/* Connection Request */}
          {(() => {
            const data = getProductData("lovemap_connection_request");
            return (
              <View style={styles.extraItem}>
                <View style={styles.extraInfo}>
                  <Ionicons
                    name="person-add"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <View style={styles.extraDetails}>
                    <Text style={styles.extraName}>{data.name}</Text>
                    <Text style={styles.extraPrice}>{data.price} each</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.buyButton,
                    (!iap.connected || loading) && styles.disabledButton,
                  ]}
                  onPress={() =>
                    handlePurchaseExtra("lovemap_connection_request")
                  }
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
            const data = getProductData("lovemap_invisible_mode");
            return (
              <View
                style={[
                  styles.extraItem,
                  (isPremium || isInvisibleModeActive) && styles.disabledItem,
                ]}
              >
                <View style={styles.extraInfo}>
                  <Ionicons
                    name="eye-off"
                    size={24}
                    color={theme.colors.primary}
                  />
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
                    style={[
                      styles.buyButton,
                      (!iap.connected || loading) && styles.disabledButton,
                    ]}
                    onPress={() =>
                      handlePurchaseExtra("lovemap_invisible_mode")
                    }
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
            const data = getProductData("lovemap_first_impression");
            return (
              <View style={styles.extraItem}>
                <View style={styles.extraInfo}>
                  <Ionicons
                    name="mail"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <View style={styles.extraDetails}>
                    <Text style={styles.extraName}>{data.name}</Text>
                    <Text style={styles.extraPrice}>{data.price} each</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.buyButton,
                    (!iap.connected || loading) && styles.disabledButton,
                  ]}
                  onPress={() =>
                    handlePurchaseExtra("lovemap_first_impression")
                  }
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
        {/* Debug Panel (Development Only) */}
        <QuotaDebugPanel />

        {/* Modal Test Buttons (Development Only) */}
        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧪 Modal Tests (DEV)</Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[
                  styles.buyButton,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => {
                  console.log("🧪 Testing enhanced modals with price");
                  showLoading(
                    "Testing enhanced loading modal...",
                    "$9.99",
                    "Premium Monthly"
                  );
                  setTimeout(() => {
                    showSuccess(
                      "Test Success! 🎉",
                      "Enhanced modal system is working perfectly!",
                      "$9.99",
                      "Premium Monthly"
                    );
                  }, 2000);
                }}
              >
                <Text style={styles.buyButtonText}>Test Enhanced Modals</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.buyButton,
                  { backgroundColor: theme.colors.warning },
                ]}
                onPress={() => {
                  console.log("🧪 Testing info modal");
                  showInfo(
                    "Test Confirmation",
                    "Do you want to test the modal system?",
                    "info",
                    () => {
                      showSuccess(
                        "Confirmed!",
                        "You confirmed the test modal."
                      );
                    }
                  );
                }}
              >
                <Text style={styles.buyButtonText}>Test Confirmation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.buyButton,
                  { backgroundColor: theme.colors.error },
                ]}
                onPress={() => {
                  console.log("🧪 Testing error modal");
                  showError(
                    "Test Error",
                    "This is a test error message with retry option.",
                    () => {
                      showSuccess("Retried!", "You clicked the retry button.");
                    }
                  );
                }}
              >
                <Text style={styles.buyButtonText}>Test Error</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Purchase Modals */}
      <PurchaseLoadingModal
        visible={modalState.loading}
        message={modalState.loadingMessage}
        price={modalState.price}
        productName={modalState.productName}
      />

      <PurchaseSuccessModal
        visible={modalState.success}
        title={modalState.successTitle}
        message={modalState.successMessage}
        price={modalState.price}
        productName={modalState.productName}
        onClose={hideModals}
      />

      <PurchaseErrorModal
        visible={modalState.error}
        title={modalState.errorTitle}
        message={modalState.errorMessage}
        onClose={hideModals}
        onRetry={modalState.onRetry}
      />

      <InfoModal
        visible={modalState.info}
        title={modalState.infoTitle || ""}
        message={modalState.infoMessage || ""}
        type={modalState.infoType}
        onClose={hideModals}
        onConfirm={modalState.onConfirm}
      />
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
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  planName: {
    fontSize: theme.fontSize.xl,
    fontWeight: "700",
    color: theme.colors.text,
  },
  premiumBadge: {
    backgroundColor: theme.colors.primary + "20",
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  planPrice: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "600",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  quotaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  quotaText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  quotaValue: {
    fontSize: theme.fontSize.base,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  planOption: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recommendedPlan: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    position: "relative",
  },
  recommendedBadge: {
    position: "absolute",
    top: -10,
    right: 20,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  recommendedText: {
    color: "white",
    fontSize: theme.fontSize.xs,
    fontWeight: "700",
  },
  planDetails: {
    flex: 1,
  },
  planOptionName: {
    fontSize: theme.fontSize.lg,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  extraInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    flex: 1,
  },
  extraDetails: {
    flex: 1,
  },
  extraName: {
    fontSize: theme.fontSize.base,
    fontWeight: "600",
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
    color: "white",
    fontWeight: "600",
    fontSize: theme.fontSize.sm,
  },
  includedText: {
    color: theme.colors.textSecondary,
    fontStyle: "italic",
  },
  activeText: {
    color: theme.colors.success,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledItem: {
    opacity: 0.6,
  },
  restoreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: "transparent",
    alignSelf: "center",
    marginTop: theme.spacing.md,
  },
  restoreButtonText: {
    color: theme.colors.primary,
    fontWeight: "600",
    fontSize: theme.fontSize.base,
  },
  restoreDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.sm,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignSelf: "center",
  },
  syncButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: theme.fontSize.base,
  },
  syncDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  forceCheckButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.error,
    backgroundColor: "transparent",
    alignSelf: "center",
  },
  forceCheckButtonText: {
    color: theme.colors.error,
    fontWeight: "600",
    fontSize: theme.fontSize.base,
  },
  forceCheckDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  currentPlan: {
    borderColor: theme.colors.success,
    borderWidth: 2,
  },
  currentPlanBadge: {
    position: "absolute",
    top: -10,
    right: 20,
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  currentPlanText: {
    color: "white",
    fontSize: theme.fontSize.xs,
    fontWeight: "700",
  },
});

export default SubscriptionScreen;

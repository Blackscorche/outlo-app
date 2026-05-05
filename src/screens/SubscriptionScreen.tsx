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
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
import { useTheme } from '../contexts/ThemeContext';

const PRIVACY_URL =
  "https://outlo.app/privacy-policy";

const TERMS_URL =
  "https://outlo.app/terms-of-service";

const openExternalLink = async (url: string) => {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Error", "Unable to open link");
  }
};

const SubscriptionScreen = ({ navigation }: { navigation: any }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [hideActiveSubscription, setHideActiveSubscription] = useState(false);
  const { subscription, quotas, refreshSubscription } = useSubscription();
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
  console.log("...", iap.products, iap.subscriptions);

  const { theme } = useTheme();
  const styles = makeStyles(theme);

  useEffect(() => {
    loadSubscriptionData();
    // Refresh when screen comes into focus
    const unsubscribe = navigation.addListener("focus", () => {
      loadSubscriptionData(true);
    });

    // Listen for app state changes (when user returns from device settings)
    const handleAppStateChange = async (nextAppState: any) => {
      if (nextAppState === "active") {
        await loadSubscriptionData(true); // Force refresh when returning to app
        await iap.getAvailablePurchases();
      }
    };

    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
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
      iap.loadProducts();
      iap.getPurchaseHistory(() => {
        setTimeout(() => {
          setInitialLoading(false);
        }, 3000);
      });
    }
    // Debug info
  }, [iap.connected]);

  // Create a stable dependency that tracks actual purchase changes (no memo needed)
  const purchaseIds = !iap.availablePurchases
    ? ""
    : iap.availablePurchases
      .map((purchase) => purchase.productId)
      .sort()
      .join(",");

  // Create subscription product tracker (no memo needed)
  const hasActiveIAPSubscription = !iap.availablePurchases
    ? false
    : iap.availablePurchases.some((purchase) =>
      ["lovemap_premium_monthly", "lovemap_premium_yearly"].includes(
        purchase.productId,
      ),
    );

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

      const timeSinceExpiry = now.getTime() - expiryDate.getTime();
      const oneDayInMs = 24 * 60 * 60 * 1000;
      const isWithinGracePeriod = timeSinceExpiry <= oneDayInMs;

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
        // Mark as cancelled but keep premium benefits until expiry
        const { error } = await supabase
          .from("user_subscriptions" as any)
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

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
        (subscription?.status === "active" ||
          subscription?.status === "cancelled") &&
        !hasActiveIAPSubscription &&
        now > expiryDate &&
        !isWithinGracePeriod
      ) {
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
        // Find the actual purchase to process
        const activeSubscriptionPurchase = iap.availablePurchases.find(
          (purchase) =>
            ["lovemap_premium_monthly", "lovemap_premium_yearly"].includes(
              purchase.productId,
            ),
        );

        if (activeSubscriptionPurchase) {
          await subscriptionService.processIAPPurchase(
            user.id,
            activeSubscriptionPurchase,
          );
          await loadSubscriptionData();
        }
        return;
      }
    }

    handleSubscriptionState();
  }, [
    purchaseIds,
    initialLoading,
    subscription?.tier,
    subscription?.status,
    subscription?.current_period_end,
    hasActiveIAPSubscription,
  ]);

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
    if (productId.includes("premium") && iap.subscriptions.length === 0) {
      showError(
        "Subscriptions Unavailable",
        "Subscription products are not available right now. Please try again later.",
      );
      return;
    }
    try {
      if (!iap.connected) {
        console.log("❌ IAP not connected");
        showError(
          "Store Error",
          "Store connection not available. Please try again.",
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
      const isSwitch =
        isPremium &&
        ((productId.includes("monthly") &&
          subscription?.billing_period === "yearly") ||
          (productId.includes("yearly") &&
            subscription?.billing_period === "monthly"));

      if (isSwitch) {
        // Show subscription switch confirmation
        const currentPlan =
          subscription?.billing_period === "yearly" ? "Yearly" : "Monthly";
        const newPlan = productId.includes("monthly") ? "Monthly" : "Yearly";

        showInfo(
          "Switch Subscription Plan",
          `You're currently on Premium ${currentPlan}. Switching to Premium ${newPlan} will:\n\n${productId.includes("yearly") ? "• You'll be charged immediately for the yearly plan\n• You'll get a prorated refund for unused time on your monthly plan\n• Your new yearly subscription starts right away\n• Benefits still renew monthly (10 requests, 3 impressions each month)" : "• Your monthly subscription will start at your next renewal date\n• You'll continue with your current yearly plan until then\n• No immediate charge - billing happens at renewal"}\n\nProceed with switching to ${productName}?`,
          "info",
          async () => {
            try {
              hideModals();
              // Show enhanced loading modal
              showLoading(
                "Switching your subscription...",
                productPrice,
                productName,
              );

              await iap.purchaseSubscription(productId);
            } catch (error: any) {
              console.error("❌ Purchase error in subscription switch:", error);
              showError(
                "Switch Failed",
                error?.message || "Failed to switch subscription.",
              );
            }
          },
        );
      } else {
        // Regular subscription purchase
        showLoading(
          "Processing your subscription...",
          productPrice,
          productName,
        );

        await iap.purchaseSubscription(productId);
      }
    } catch (error: any) {
      console.error("❌ Purchase error in handleSubscribe:", error);
      showError(
        "Purchase Failed",
        error?.message || "Failed to process subscription.",
      );
    }
  };

  const handlePurchaseExtra = async (productId: string) => {
    try {
      if (!iap.connected) {
        showError(
          "Store Error",
          "Store connection not available. Please try again.",
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
        ? "Partner Request"
        : productId.includes("impression")
          ? "First Impression"
          : productId.includes("invisible")
            ? "Invisible Mode (30 days)"
            : "Product";

      const productPrice = iap.getFormattedPrice(productId);

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
              modalProductName,
            );

            await iap.purchaseConsumable(productId);
          } catch (error: any) {
            console.error("❌ Purchase execution error:", error);
            showError(
              "Purchase Failed",
              error?.message || "Failed to complete purchase.",
            );
          }
        },
      );
    } catch (error: any) {
      console.error("❌ Purchase preparation error:", error);
      showError(
        "Purchase Error",
        "Failed to prepare purchase. Please try again.",
      );
    }
  };

  const handleCancelSubscription = async () => {
    // First: Show confirmation modal asking for explicit confirmation
    showInfo(
      "Cancel Subscription?",
      "Are you sure you want to cancel your Premium subscription? You'll lose access to Premium features after your current billing period ends.",
      "warning",
      async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;

          hideModals();
          // Second: Show instructions modal with callback to open settings
          showInfo(
            "Cancel Subscription (Sandbox)",
            Platform.OS === "ios"
              ? "To cancel your Sandbox subscription:\n\n1. Open Settings\n2. Scroll to the bottom\n3. Tap on 'Outlo' app\n4. Sign in with your Sandbox test account (if prompted)\n5. Tap 'Subscriptions'\n6. Select your subscription\n7. Tap 'Cancel Subscription'\n\nOR go to App Store app > Account > Subscriptions > Outlo > Cancel"
              : "To cancel your subscription, go to Google Play Store > Menu > Subscriptions, select Outlo, then tap Cancel.",
            "warning",
            async () => {
              try {
                hideModals();

                // Fallback: Show manual instructions with Sandbox-specific details
                showInfo(
                  "Manual Cancellation (Sandbox)",
                  Platform.OS === "ios"
                    ? "Since you're using Sandbox:\n\n1. Go to Settings app\n2. Scroll down to bottom\n3. Tap 'Outlo' (or find it in app settings)\n4. Look for 'Subscriptions' or 'Account' section\n5. Find your Sandbox subscription\n6. Tap 'Cancel Subscription'\n\nNote: Sandbox subscriptions appear in a different location than production ones."
                    : "Please open Google Play Store > Subscriptions > Outlo > Cancel",
                  "warning",
                );
              } catch (error) {
                console.error("❌ Cancel error:", error);
                hideModals();
                showError(
                  "Cancellation Error",
                  "Failed to open subscription management. Please try again.",
                );
              }
            },
          );
        } catch (error) {
          console.error("❌ Cancel error:", error);
          hideModals();
          showError(
            "Cancellation Error",
            "Failed to process cancellation request. Please try again.",
          );
        }
      },
    );
  };

  const handleRestorePurchases = async () => {
    try {
      if (!iap.connected) {
        showError(
          "Store Error",
          "Store connection not available. Please try again.",
        );
        return;
      }

      showLoading("Restoring your purchases...");

      const purchases = await iap.getAvailablePurchases();
      await refreshSubscription();
      hideModals();

      const restoredItems = Array.isArray(purchases) ? purchases : [];

      const hasRestorablePurchase = restoredItems.some((purchase) =>
        [
          "lovemap_premium_monthly",
          "lovemap_premium_yearly",
          "lovemap_connection_request",
          "lovemap_first_impression",
          "lovemap_invisible_mode",
        ].includes(purchase.productId),
      );

      if (hasRestorablePurchase) {
        showSuccess(
          "Purchases Restored",
          "Your previous purchases have been restored successfully.",
        );
      } else {
        showInfo(
          "No Purchases Found",
          "We couldn't find any previous purchases to restore.",
          "info",
        );
      }
    } catch (error: any) {
      console.error("❌ Restore purchases error:", error);
      hideModals();
      showError(
        "Restore Failed",
        error?.message ||
        "We couldn't restore purchases right now. Please try again.",
      );
    }
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
          ? "Partner Request"
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
    if (
      subscription?.status === "cancelled" &&
      subscription?.current_period_end
    ) {
      const expiryDate = new Date(subscription.current_period_end);
      const now = new Date();
      return now <= expiryDate; // Still in active period
    }

    return false;
  })();

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
            onPress={async () => {
              await loadSubscriptionData(true);
              await iap.getAvailablePurchases();
            }}
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
                      "lovemap_premium_monthly",
                    )}/month`
                  : "Free"}
              </Text>
              {subscription?.status === "cancelled" &&
                subscription?.current_period_end && (
                  <Text style={styles.expiryText}>
                    Active until{" "}
                    {new Date(
                      subscription.current_period_end,
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
                <Text style={styles.quotaText}>Partner Requests</Text>
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
                      quotas.invisible_mode_expires_at,
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
            const isCurrentPlan =
              isPremium && subscription?.billing_period === "monthly";
            const isCancelledButActive =
              isCurrentPlan && subscription?.status === "cancelled";

            return (
              <TouchableOpacity
                style={[styles.planOption, isCurrentPlan && styles.currentPlan]}
                onPress={() => {
                  if (isCurrentPlan && !isCancelledButActive) {
                    // Already subscribed to this plan and it's active
                    return;
                  }
                  handleSubscribe("lovemap_premium_monthly");
                }}
                disabled={
                  !iap.connected ||
                  loading ||
                  (isCurrentPlan && !isCancelledButActive)
                }
              >
                {isCurrentPlan && (
                  <View
                    style={
                      isCancelledButActive
                        ? styles.activeUntilBadge
                        : styles.currentPlanBadge
                    }
                  >
                    <Text
                      style={
                        isCancelledButActive
                          ? styles.activeUntilText
                          : styles.currentPlanText
                      }
                    >
                      {isCancelledButActive ? "ACTIVE UNTIL" : "CURRENT"}
                    </Text>
                    {isCancelledButActive && (
                      <Text style={styles.activeUntilDate}>
                        {new Date(
                          subscription?.current_period_end || "",
                        ).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                )}
                <View style={styles.planDetails}>
                  <Text style={styles.planOptionName}>{monthlyData.name}</Text>
                  <Text style={styles.planOptionPrice}>
                    {monthlyData.price}/month
                  </Text>
                  <Text style={styles.planDuration}>
                    Length: 1 month • Auto-renews monthly
                  </Text>
                  <View style={styles.planFeatures}>
                    <Text style={styles.featureItem}>
                      • 10 partner requests/month
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
            const isCurrentPlan =
              isPremium && subscription?.billing_period === "yearly";
            const isCancelledButActive =
              isCurrentPlan && subscription?.status === "cancelled";
            const monthlyUser =
              isPremium && subscription?.billing_period === "monthly";

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
                disabled={
                  !iap.connected ||
                  loading ||
                  (isCurrentPlan && !isCancelledButActive)
                }
              >
                {isCurrentPlan ? (
                  <View
                    style={
                      isCancelledButActive
                        ? styles.activeUntilBadge
                        : styles.currentPlanBadge
                    }
                  >
                    <Text
                      style={
                        isCancelledButActive
                          ? styles.activeUntilText
                          : styles.currentPlanText
                      }
                    >
                      {isCancelledButActive ? "ACTIVE UNTIL" : "CURRENT"}
                    </Text>
                    {isCancelledButActive && (
                      <Text style={styles.activeUntilDate}>
                        {new Date(
                          subscription?.current_period_end || "",
                        ).toLocaleDateString()}
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
                  <Text style={styles.planOptionName}>{yearlyData.name}</Text>
                  <Text style={styles.planOptionPrice}>
                    {yearlyData.price}/year
                  </Text>
                  <Text style={styles.planDuration}>
                    Length: 12 months • Auto-renews yearly
                  </Text>
                  <View style={styles.planFeatures}>
                    <Text style={styles.featureItem}>
                      • All Premium features
                    </Text>
                    <Text style={styles.featureItem}>
                      • Benefits renewed every month
                    </Text>
                    <Text style={styles.featureItem}>
                      • Save money with yearly billing
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

          {/* Partner Request */}
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

        {/* Apple Required: Subscription Details Box - Moved to bottom */}
        <View style={styles.subscriptionInfoBox}>
          <Text style={styles.subscriptionInfoTitle}>
            📋 Auto-Renewable Subscription Details
          </Text>

          <View style={styles.subscriptionInfoDivider} />

          {/* Monthly Subscription Details */}
          <View style={styles.subscriptionDetailBlock}>
            <Text style={styles.subscriptionDetailTitle}>
              Premium Monthly Subscription
            </Text>
            <View style={styles.subscriptionInfoItem}>
              <Ionicons
                name="time-outline"
                size={14}
                color={theme.colors.primary}
              />
              <Text style={styles.subscriptionInfoText}>
                <Text style={styles.subscriptionBold}>Duration:</Text> 1 month
                (30 days)
              </Text>
            </View>
            <View style={styles.subscriptionInfoItem}>
              <Ionicons
                name="pricetag-outline"
                size={14}
                color={theme.colors.primary}
              />
              <Text style={styles.subscriptionInfoText}>
                <Text style={styles.subscriptionBold}>Price:</Text>{" "}
                {iap.getFormattedPrice("lovemap_premium_monthly")} per month
              </Text>
            </View>
            <View style={styles.subscriptionInfoItem}>
              <Ionicons
                name="star-outline"
                size={14}
                color={theme.colors.primary}
              />
              <Text style={styles.subscriptionInfoText}>
                <Text style={styles.subscriptionBold}>Content/Services:</Text>{" "}
                10 partner requests + 3 first impressions monthly + unlimited
                invisible mode access
              </Text>
            </View>
            <View style={styles.subscriptionInfoItem}>
              <Ionicons
                name="sync-outline"
                size={14}
                color={theme.colors.primary}
              />
              <Text style={styles.subscriptionInfoText}>
                <Text style={styles.subscriptionBold}>Renewal:</Text>{" "}
                Automatically renews every month unless cancelled 24 hours
                before period ends
              </Text>
            </View>
          </View>

          <View style={styles.subscriptionInfoDivider} />

          {/* Yearly Subscription Details */}
          <View style={styles.subscriptionDetailBlock}>
            <Text style={styles.subscriptionDetailTitle}>
              Premium Yearly Subscription
            </Text>
            <View style={styles.subscriptionInfoItem}>
              <Ionicons
                name="time-outline"
                size={14}
                color={theme.colors.primary}
              />
              <Text style={styles.subscriptionInfoText}>
                <Text style={styles.subscriptionBold}>Duration:</Text> 12 months
                (365 days)
              </Text>
            </View>
            <View style={styles.subscriptionInfoItem}>
              <Ionicons
                name="pricetag-outline"
                size={14}
                color={theme.colors.primary}
              />
              <Text style={styles.subscriptionInfoText}>
                <Text style={styles.subscriptionBold}>Price:</Text>{" "}
                {iap.getFormattedPrice("lovemap_premium_yearly")} per year (save
                20%)
              </Text>
            </View>
            <View style={styles.subscriptionInfoItem}>
              <Ionicons
                name="star-outline"
                size={14}
                color={theme.colors.primary}
              />
              <Text style={styles.subscriptionInfoText}>
                <Text style={styles.subscriptionBold}>Content/Services:</Text>{" "}
                10 partner requests + 3 first impressions monthly + unlimited
                invisible mode access
              </Text>
            </View>
            <View style={styles.subscriptionInfoItem}>
              <Ionicons
                name="sync-outline"
                size={14}
                color={theme.colors.primary}
              />
              <Text style={styles.subscriptionInfoText}>
                <Text style={styles.subscriptionBold}>Renewal:</Text>{" "}
                Automatically renews every year unless cancelled 24 hours before
                period ends
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.legalSection}>
          <Text style={styles.legalText}>
            Payment will be charged to your Apple ID account at confirmation of
            purchase.
          </Text>
          <Text style={styles.legalText}>
            Subscription automatically renews unless auto-renew is turned off at
            least 24 hours before the end of the current period.
          </Text>
          <Text style={styles.legalText}>
            Your account will be charged for renewal within 24 hours prior to
            the end of the current period.
          </Text>
          <Text style={styles.legalText}>
            You can manage and cancel your subscription in your App Store
            account settings.
          </Text>

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestorePurchases}
          >
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </TouchableOpacity>

          <View style={styles.legalLinksRow}>
            <TouchableOpacity onPress={() => openExternalLink(PRIVACY_URL)}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>

            <Text style={styles.legalSeparator}>•</Text>

            <TouchableOpacity onPress={() => openExternalLink(TERMS_URL)}>
              <Text style={styles.legalLink}>Terms of Use</Text>
            </TouchableOpacity>
          </View>
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
                  showLoading(
                    "Testing enhanced loading modal...",
                    "$9.99",
                    "Premium Monthly",
                  );
                  setTimeout(() => {
                    showSuccess(
                      "Test Success! 🎉",
                      "Enhanced modal system is working perfectly!",
                      "$9.99",
                      "Premium Monthly",
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
                  showInfo(
                    "Test Confirmation",
                    "Do you want to test the modal system?",
                    "info",
                    () => {
                      showSuccess(
                        "Confirmed!",
                        "You confirmed the test modal.",
                      );
                    },
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
                  showError(
                    "Test Error",
                    "This is a test error message with retry option.",
                    () => {
                      showSuccess("Retried!", "You clicked the retry button.");
                    },
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

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
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
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  section: {
    paddingHorizontal: t.spacing.lg,
    marginBottom: t.spacing.xl,
  },
  sectionTitle: {
    fontSize: t.fontSize.lg,
    fontWeight: "600",
    color: t.colors.text,
    marginBottom: t.spacing.md,
  },
  planCard: {
    backgroundColor: t.colors.surface,
    padding: t.spacing.lg,
    borderRadius: t.borderRadius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  premiumCard: {
    borderColor: t.colors.primary,
    borderWidth: 2,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: t.spacing.sm,
  },
  planName: {
    fontSize: t.fontSize.xl,
    fontWeight: "700",
    color: t.colors.text,
  },
  premiumBadge: {
    backgroundColor: t.colors.primary + "20",
    padding: t.spacing.xs,
    borderRadius: t.borderRadius.sm,
  },
  planPrice: {
    fontSize: t.fontSize.base,
    color: t.colors.textSecondary,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: t.spacing.xs,
    marginTop: t.spacing.md,
    padding: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
    borderWidth: 1,
    borderColor: t.colors.error,
  },
  cancelButtonText: {
    fontSize: t.fontSize.sm,
    color: t.colors.error,
    fontWeight: "600",
  },
  expiryText: {
    fontSize: t.fontSize.sm,
    color: t.colors.error,
    marginTop: t.spacing.xs,
  },
  quotasList: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
    padding: t.spacing.md,
  },
  quotaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: t.spacing.sm,
  },
  quotaInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.sm,
  },
  quotaText: {
    fontSize: t.fontSize.base,
    color: t.colors.text,
  },
  quotaValue: {
    fontSize: t.fontSize.base,
    fontWeight: "600",
    color: t.colors.primary,
  },
  planOption: {
    backgroundColor: t.colors.surface,
    padding: t.spacing.lg,
    borderRadius: t.borderRadius.lg,
    marginBottom: t.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recommendedPlan: {
    borderWidth: 2,
    borderColor: t.colors.primary,
    position: "relative",
  },
  recommendedBadge: {
    position: "absolute",
    top: -10,
    right: 20,
    backgroundColor: t.colors.primary,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 4,
    borderRadius: t.borderRadius.sm,
  },
  recommendedText: {
    color: "white",
    fontSize: t.fontSize.xs,
    fontWeight: "700",
  },
  planDetails: {
    flex: 1,
  },
  planOptionName: {
    fontSize: t.fontSize.lg,
    fontWeight: "600",
    color: t.colors.text,
    marginBottom: 4,
  },
  planOptionPrice: {
    fontSize: t.fontSize.base,
    color: t.colors.primary,
    marginBottom: t.spacing.sm,
  },
  planDuration: {
    fontSize: t.fontSize.xs,
    color: t.colors.textSecondary,
    marginBottom: t.spacing.sm,
    fontStyle: "italic",
  },
  planFeatures: {
    gap: 4,
  },
  featureItem: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
  },
  extraItem: {
    backgroundColor: t.colors.surface,
    padding: t.spacing.lg,
    borderRadius: t.borderRadius.lg,
    marginBottom: t.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  extraInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.md,
    flex: 1,
  },
  extraDetails: {
    flex: 1,
  },
  extraName: {
    fontSize: t.fontSize.base,
    fontWeight: "600",
    color: t.colors.text,
  },
  extraPrice: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
  },
  buyButton: {
    backgroundColor: t.colors.primary,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
    borderRadius: t.borderRadius.md,
  },
  buyButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: t.fontSize.sm,
  },
  includedText: {
    color: t.colors.textSecondary,
    fontStyle: "italic",
  },
  activeText: {
    color: t.colors.success,
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
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.primary,
    backgroundColor: "transparent",
    alignSelf: "center",
    marginTop: t.spacing.md,
  },
  restoreButtonText: {
    color: t.colors.primary,
    fontWeight: "600",
    fontSize: t.fontSize.base,
  },
  restoreDescription: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    textAlign: "center",
    marginTop: t.spacing.sm,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.md,
    backgroundColor: t.colors.primary,
    alignSelf: "center",
  },
  syncButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: t.fontSize.base,
  },
  syncDescription: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    textAlign: "center",
    marginTop: t.spacing.sm,
    marginBottom: t.spacing.lg,
  },
  forceCheckButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.error,
    backgroundColor: "transparent",
    alignSelf: "center",
  },
  forceCheckButtonText: {
    color: t.colors.error,
    fontWeight: "600",
    fontSize: t.fontSize.base,
  },
  forceCheckDescription: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    textAlign: "center",
    marginTop: t.spacing.sm,
    marginBottom: t.spacing.lg,
  },
  currentPlan: {
    borderColor: t.colors.success,
    borderWidth: 2,
  },
  currentPlanBadge: {
    position: "absolute",
    top: -10,
    right: 20,
    backgroundColor: t.colors.success,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 4,
    borderRadius: t.borderRadius.sm,
  },
  currentPlanText: {
    color: "white",
    fontSize: t.fontSize.xs,
    fontWeight: "700",
  },
  activeUntilBadge: {
    position: "absolute",
    top: -12,
    right: 20,
    backgroundColor: t.colors.success,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 6,
    borderRadius: t.borderRadius.md,
    minWidth: 85,
    shadowColor: t.colors.success,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  activeUntilText: {
    color: "white",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  activeUntilDate: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
    opacity: 0.9,
  },
  legalLinks: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
    padding: t.spacing.sm,
  },
  legalLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.md,
    gap: t.spacing.sm,
  },
  legalLinkText: {
    flex: 1,
    fontSize: t.fontSize.base,
    color: t.colors.text,
    fontWeight: "500",
  },
  subscriptionDisclaimer: {
    fontSize: t.fontSize.xs,
    color: t.colors.textSecondary,
    marginTop: t.spacing.md,
    lineHeight: 18,
  },
  subscriptionInfoBox: {
    backgroundColor: t.colors.primary + "15",
    borderRadius: t.borderRadius.md,
    padding: t.spacing.md,
    marginBottom: t.spacing.lg,
    marginHorizontal: t.spacing.md,
  },
  subscriptionInfoTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: t.colors.text,
    marginBottom: t.spacing.sm,
  },
  subscriptionInfoDivider: {
    height: 1,
    backgroundColor: t.colors.primary + "20",
    marginVertical: t.spacing.sm,
  },
  subscriptionDetailBlock: {
    marginBottom: t.spacing.xs,
  },
  subscriptionDetailTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: t.colors.primary,
    marginBottom: 6,
  },
  subscriptionBold: {
    fontWeight: "600",
    color: t.colors.text,
  },
  subscriptionInfoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 4,
    gap: 6,
  },
  subscriptionInfoText: {
    flex: 1,
    fontSize: 11,
    color: t.colors.text,
    lineHeight: 16,
  },
  legalSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 6,
  },
  legalLinksRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  legalLink: {
    fontSize: 13,
    fontWeight: "600",
    color: t.colors.primary,
  },
  legalSeparator: {
    marginHorizontal: 8,
    color: "#9CA3AF",
  },
});

export default SubscriptionScreen;

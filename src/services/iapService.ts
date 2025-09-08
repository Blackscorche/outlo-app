// CLEAN IAP Service - No more confusion!
import { Product, Purchase, useIAP, PurchaseError } from "react-native-iap";
import { Platform } from "react-native";
import { supabase } from "../integrations/supabase/client";
import { Alert } from "react-native";
import { useSubscription } from "../contexts/SubscriptionContext";

// Product IDs - these match Google Play Console
export const IAP_PRODUCTS = {
  subscriptions: ["lovemap_premium_monthly", "lovemap_premium_yearly"],
  consumables: [
    "lovemap_connection_request",
    "lovemap_first_impression", 
    "lovemap_invisible_mode",
  ],
  // All products combined for loading
  all: [
    "lovemap_premium_monthly", 
    "lovemap_premium_yearly",
    "lovemap_connection_request",
    "lovemap_first_impression", 
    "lovemap_invisible_mode",
  ],
};

export const useLoveMapIAP = () => {
    const { refreshSubscription } = useSubscription();
  
  const {
    connected,
    products,
    subscriptions,
    currentPurchase,
    currentPurchaseError,
    availablePurchases,
    fetchProducts,
    requestPurchase,
    getAvailablePurchases,
    finishTransaction,
    hasActiveSubscriptions
  } = useIAP({

    onPurchaseSuccess: async (purchase: Purchase) => {
      console.log("🎉 Purchase successful:", purchase.productId);

      try {
        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("❌ No authenticated user for purchase");
          return;
        }

        // 2. Process with subscription service (updates database)
        const { default: subscriptionService } = await import("./subscriptionService");
        await subscriptionService.processIAPPurchase(user.id, purchase);
await refreshSubscription();
        // 3. Acknowledge purchase to prevent refunds
        await finishTransaction({
          purchase,
          isConsumable: !isSubscriptionProduct(purchase.productId),
        });

        // 4. Show success
        Alert.alert("Success!", "Purchase completed successfully!");

        console.log("✅ Purchase processed and acknowledged");

      } catch (error) {
        console.error("❌ Error processing purchase:", error);
        
        // Still acknowledge to prevent stuck state
        try {
          await finishTransaction({
            purchase,
            isConsumable: !isSubscriptionProduct(purchase.productId),
          });
        } catch (finishError) {
          console.error("Error finishing transaction:", finishError);
        }
        
        Alert.alert("Error", "Failed to process purchase. Contact support.");
      }
    },

    onPurchaseError: (error: PurchaseError) => {
      if (error.code !== "E_USER_CANCELLED") {
        console.error("❌ Purchase failed:", error);
        Alert.alert("Purchase Failed", error.message);
      }
    },
  });

  // Load products when connected
// Load products when connected - FIXED VERSION
const loadProducts = async () => {
  if (!connected) {
    console.log("IAP not connected yet");
    return;
  }

  try {
    console.log("🔄 Loading products...");
    
    // Load consumables first and wait for them
    console.log("Loading consumables:", IAP_PRODUCTS.consumables);
    const consumableResult = await fetchProducts({
      skus: IAP_PRODUCTS.consumables,
      type: "inapp",
    });
    console.log("Consumables result:", consumableResult);

    // Load subscriptions and wait for them
    console.log("Loading subscriptions:", IAP_PRODUCTS.subscriptions);
    const subscriptionResult = await fetchProducts({
      skus: IAP_PRODUCTS.subscriptions,
      type: "subs",
    });
    console.log("Subscriptions result:", subscriptionResult);

    // Add a small delay to ensure products are loaded
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("✅ Products loaded:", {
      consumables: products.length,
      subscriptions: subscriptions.length,
      allProducts: [...products, ...subscriptions].map(p => ({ id: p.id, price: p.price }))
    });

    // Process any pending purchases after loading products
    // await processPendingPurchases();
    
  } catch (error) {
    console.error("❌ Error loading products:", error);
  }
};

  // Process any pending/unacknowledged purchases (standard approach)
  const processPendingPurchases = async () => {
    try {
      console.log("🔄 Checking for pending purchases...");
      
      // Get available purchases
      await getAvailablePurchases();
      
      if (availablePurchases.length === 0) {
        console.log("✅ No pending purchases");
        return;
      }

      console.log(`📦 Found ${availablePurchases.length} pending purchases`);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("❌ No authenticated user to process purchases");
        return;
      }

      // Process each pending purchase
      const { default: subscriptionService } = await import("./subscriptionService");
      
      for (const purchase of availablePurchases) {
        try {
          console.log(`🔄 Processing pending purchase: ${purchase.productId}`);
          
          // Process with subscription service
          await subscriptionService.processIAPPurchase(user.id, purchase);
          
          // Acknowledge the purchase
          await finishTransaction({
            purchase,
            isConsumable: !isSubscriptionProduct(purchase.productId),
          });
          
          console.log(`✅ Processed pending purchase: ${purchase.productId}`);
          
        } catch (error) {
          console.error(`❌ Error processing purchase ${purchase.productId}:`, error);
        }
      }
      
      Alert.alert("Purchases Restored", "Your previous purchases have been restored!");
      
    } catch (error) {
      console.error("❌ Error processing pending purchases:", error);
    }
  };

  // Purchase any product
  const purchaseProduct = async (productId: string, callBack: () => void) => {
    if (!connected) {
      Alert.alert("Error", "Store not connected");
      return;
    }

    try {
      const isSubscription = isSubscriptionProduct(productId);
      console.log(`🛒 Purchasing ${productId} (subscription: ${isSubscription})`);

      if (isSubscription && Platform.OS === "android") {
        const subscription = subscriptions.find(s => s.id === productId);
        if (!subscription) throw new Error(`Subscription not found: ${productId}`);

        const offerToken = getOfferToken(productId);
        if (!offerToken) throw new Error(`No offer token for: ${productId}`);

        await requestPurchase({
          request: {
            ios: { sku: productId },
            android: {
              skus: [productId],
              subscriptionOffers: [{ sku: productId, offerToken }]
            },
          },
          type: "subs",
        }).then(() => { callBack(); });
      } else {
        await requestPurchase({
          request: {
            ios: { sku: productId },
            android: { skus: [productId] },
          },
          type: isSubscription ? "subs" : "inapp",
        }).then(() => { callBack(); });
      }
    } catch (error) {
      console.error("❌ Purchase failed:", error);
      Alert.alert("Purchase Failed", error instanceof Error ? error.message : "Unknown error");
    }
  };

  // Get offer token for Android subscriptions
  const getOfferToken = (productId: string): string | undefined => {
    if (Platform.OS !== "android") return undefined;
    
    const subscription = subscriptions.find(sub => sub.id === productId);
    if (subscription && (subscription as any).subscriptionOfferDetailsAndroid) {
      return (subscription as any).subscriptionOfferDetailsAndroid[0]?.offerToken;
    }
    return undefined;
  };

  // Get purchase history (mainly for debugging)
  const getPurchaseHistory = async () => {
    if (!connected) return [];

    try {
      console.log("🔄 Getting purchase history...");
      
      // This fetches all purchases (including acknowledged ones on iOS)
      await getAvailablePurchases()
      
      
      console.log("📦 Purchase history:", availablePurchases.map((p: any) => ({
        productId: p.productId,
        transactionId: p.transactionId,
        purchaseTime: new Date(p.transactionDate).toLocaleString(),
        acknowledged: p.isAcknowledgedAndroid,
      })));
      
      return availablePurchases;
    } catch (error) {
      console.error("❌ Error getting purchase history:", error);
      return [];
    }
  };

  // Restore purchases (standard approach)
  const restorePurchases = async () => {
    if (!connected) return [];

    try {
      console.log("🔄 Restoring purchases...");
      
      // Process pending purchases which will restore subscriptions
      await processPendingPurchases();
      
      return availablePurchases;
    } catch (error) {
      console.error("❌ Error restoring:", error);
      Alert.alert("Restore Failed", "Could not restore purchases.");
      return [];
    }
  };

  // Get product info
  const getProduct = (productId: string): Product | undefined => {
    return [...products, ...subscriptions].find(p => p.id === productId);
  };

  // Get formatted price
  const getFormattedPrice = (productId: string): string => {
    const product = getProduct(productId);
    if (!product) return "$0.00";

    if ("displayPrice" in product && product.displayPrice) {
      return product.displayPrice as string;
    }

    // Android subscription pricing
    if ((product as any).subscriptionOfferDetailsAndroid) {
      const offer = (product as any).subscriptionOfferDetailsAndroid[0];
      if (offer?.pricingPhases?.[0]?.formattedPrice) {
        return offer.pricingPhases[0].formattedPrice;
      }
    }

    return "$0.00";
  };

  // Enhanced subscription status check with better Google Play handling
  const checkSubscriptionStatusWithIAP = async (): Promise<{
    hasActiveSubscription: boolean;
    shouldUpdate: boolean;
    reason?: string;
  }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { hasActiveSubscription: false, shouldUpdate: false };

      // Get database subscription
      const { default: subscriptionService } = await import("./subscriptionService");
      const dbSubscription = await subscriptionService.getUserSubscription(user.id);
      
      console.log("📊 Database subscription:", dbSubscription);

      // Check expiry first (most reliable)
      if (dbSubscription.current_period_end) {
        const expiryDate = new Date(dbSubscription.current_period_end);
        const now = new Date();
        
        if (now > expiryDate && dbSubscription.status === 'active') {
          console.log("⏰ Subscription expired based on period_end");
          return {
            hasActiveSubscription: false,
            shouldUpdate: true,
            reason: 'subscription_expired'
          };
        }
      }

      // If premium and active, verify with availablePurchases (but account for Google delay)
      if (dbSubscription.tier === 'premium' && dbSubscription.status === 'active') {
        console.log("🔍 Verifying premium subscription with IAP...");
        
        await getAvailablePurchases();
        
        // Check if we have any active subscription purchases
        const hasActiveIAPSubscription = availablePurchases.some((purchase: any) => {
          const isSubscriptionProduct = ['lovemap_premium_monthly', 'lovemap_premium_yearly'].includes(purchase.productId);
          return isSubscriptionProduct;
        });

        // IMPORTANT: Only downgrade if subscription has been cancelled for more than 24 hours
        // This accounts for Google Play's delay in updating availablePurchases
        if (!hasActiveIAPSubscription && dbSubscription.current_period_end) {
          const periodEnd = new Date(dbSubscription.current_period_end);
          const timeSincePeriodEnd = Date.now() - periodEnd.getTime();
          const oneDayInMs = 24 * 60 * 60 * 1000;
          
          // Only consider downgrading if more than 1 day has passed since period end
          if (timeSincePeriodEnd > oneDayInMs) {
            console.log("❌ No active IAP subscription found after grace period, should downgrade");
            return {
              hasActiveSubscription: false,
              shouldUpdate: true,
              reason: 'no_active_iap_subscription_after_grace'
            };
          } else {
            console.log("⏳ Within grace period, keeping subscription active");
            return { hasActiveSubscription: true, shouldUpdate: false };
          }
        }

        if (hasActiveIAPSubscription) {
          console.log("✅ Active IAP subscription confirmed");
          return { hasActiveSubscription: true, shouldUpdate: false };
        }
      }

      // If database says basic, check if we actually have an active subscription
      if (dbSubscription.tier === 'basic' || dbSubscription.status !== 'active') {
        console.log("🔍 Checking for unreflected IAP subscriptions...");
        
        await getAvailablePurchases();
        
        const hasActiveIAPSubscription = availablePurchases.some((purchase: any) => {
          const isSubscriptionProduct = ['lovemap_premium_monthly', 'lovemap_premium_yearly'].includes(purchase.productId);
          return isSubscriptionProduct;
        });

        if (hasActiveIAPSubscription) {
          console.log("✅ Found unreflected IAP subscription, should upgrade");
          return {
            hasActiveSubscription: true,
            shouldUpdate: true,
            reason: 'unreflected_iap_subscription'
          };
        }
      }

      const hasActive = dbSubscription.tier === 'premium' && dbSubscription.status === 'active';
      return { hasActiveSubscription: hasActive, shouldUpdate: false };

    } catch (error) {
      console.error("❌ Error checking subscription status:", error);
      return { hasActiveSubscription: false, shouldUpdate: false };
    }
  };

  // Simple status check - just check database
  const checkSubscriptionStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { hasActiveSubscription: false };

      const { default: subscriptionService } = await import("./subscriptionService");
      const subscription = await subscriptionService.getUserSubscription(user.id);
      
      const hasActive = subscription.tier === 'premium' && subscription.status === 'active';
      
      console.log("📊 Subscription status:", {
        tier: subscription.tier,
        status: subscription.status,
        hasActive
      });

      return { hasActiveSubscription: hasActive };
    } catch (error) {
      console.error("❌ Error checking status:", error);
      return { hasActiveSubscription: false };
    }
  };

  return {
    // State
    connected,
    products,
    subscriptions,
    currentPurchase,
    currentPurchaseError,
    availablePurchases,
    getAvailablePurchases,

    // Actions
    loadProducts,
    purchaseProduct,
    restorePurchases,
    processPendingPurchases,
    getPurchaseHistory,
    getProduct,
    getFormattedPrice,
    checkSubscriptionStatus,
    checkSubscriptionStatusWithIAP,
    hasActiveSubscriptions,

    // Convenience methods
    purchaseSubscription: purchaseProduct,
    purchaseConsumable: purchaseProduct,
    areProductsLoaded: () => connected && (products.length > 0 || subscriptions.length > 0),
  };
};

// Helper function
const isSubscriptionProduct = (productId: string): boolean => {
  return IAP_PRODUCTS.subscriptions.includes(productId);
};

export default useLoveMapIAP;

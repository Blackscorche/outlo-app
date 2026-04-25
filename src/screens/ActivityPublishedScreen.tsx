import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BOOST_PLANS, formatPrice } from "../constants/activityCategories";
import { useBoosts } from "../hooks/useBoosts";

interface RouteParams {
  activityId: string;
  isPaid?: boolean;
}

/**
 * Shown immediately after an activity is published.
 * Celebrates the publish + offers map boost upsell (24h / 3d / 7d).
 *
 * The actual IAP purchase is wired through the boost flow in `useBoosts`.
 * For now, we trigger the IAP service inline.
 */
export default function ActivityPublishedScreen({ route, navigation }: any) {
  const { activityId, isPaid }: RouteParams = route.params || {};
  const { activateBoost } = useBoosts(activityId);
  const [busy, setBusy] = useState<string | null>(null);

  const goToActivity = () => {
    // Navigate to the activities list and let the user open it from there.
    navigation.navigate("Main", { screen: "Activities" });
  };

  const handleBoost = async (planId: "24h" | "3d" | "7d") => {
    const plan = BOOST_PLANS.find((p) => p.id === planId);
    if (!plan) return;

    try {
      setBusy(planId);
      // Lazy-load the IAP service so this screen is testable without IAP context.
      const { useLoveMapIAP } = await import("../services/iapService");
      void useLoveMapIAP; // satisfy bundler – actual purchase happens via IAPProvider context

      Alert.alert(
        "Boost Coming Soon",
        `In-app purchase for boost (${plan.label} – ${formatPrice(
          plan.priceCents,
        )}) will be wired in once the boost product IDs are registered in the App Store / Play Console.\n\nProduct ID: ${plan.productId}`,
        [{ text: "OK", onPress: goToActivity }],
      );

      // Once IAP is wired, the flow will be:
      //   const purchase = await requestPurchase({ sku: plan.productId, type: 'inapp' });
      //   await activateBoost({
      //     activityId,
      //     plan: planId,
      //     productId: plan.productId,
      //     transactionId: purchase.transactionId,
      //     purchaseToken: purchase.purchaseToken,
      //   });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Success header */}
        <View style={styles.successHero}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Your activity is live!</Text>
          <Text style={styles.successSub}>
            {isPaid
              ? "Tickets can now be purchased."
              : "People can now find and join it on the map."}
          </Text>
        </View>

        {/* Boost upsell */}
        <View style={styles.boostBlock}>
          <View style={styles.boostHeaderRow}>
            <Ionicons name="rocket" size={22} color="#F59E0B" />
            <Text style={styles.boostHeader}>Want more people to see it?</Text>
          </View>
          <Text style={styles.boostSub}>
            Boost your activity on the map to get more attendees.
          </Text>

          {BOOST_PLANS.map((plan) => {
            const isBusy = busy === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                disabled={!!busy}
                style={[styles.planCard, plan.popular && styles.planCardPopular]}
                onPress={() => handleBoost(plan.id)}
                activeOpacity={0.85}
              >
                {plan.popular && (
                  <View style={styles.popularPill}>
                    <Text style={styles.popularPillText}>POPULAR</Text>
                  </View>
                )}
                <View style={styles.planRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planLabel}>{plan.label}</Text>
                    <View style={styles.benefitsRow}>
                      {plan.benefits.map((b) => (
                        <View key={b} style={styles.benefitChip}>
                          <Ionicons name="checkmark" size={11} color="#16A34A" />
                          <Text style={styles.benefitText}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.priceCol}>
                    {isBusy ? (
                      <ActivityIndicator color="#F59E0B" />
                    ) : (
                      <>
                        <Text style={styles.planPrice}>
                          {formatPrice(plan.priceCents)}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                      </>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={goToActivity}
            disabled={!!busy}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  scroll: { padding: 16, paddingBottom: 40 },

  successHero: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 32,
    backgroundColor: "#16A34A",
    borderRadius: 20,
    marginBottom: 18,
  },
  successIcon: { marginBottom: 12 },
  successTitle: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 4 },
  successSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    paddingHorizontal: 24,
  },

  boostBlock: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  boostHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  boostHeader: { fontSize: 17, fontWeight: "800", color: "#111827" },
  boostSub: { fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 14 },

  planCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  planCardPopular: {
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  popularPill: {
    position: "absolute",
    top: -8,
    right: 12,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  popularPillText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  planRow: { flexDirection: "row", alignItems: "center" },
  planLabel: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 6 },
  benefitsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  benefitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#F0FDF4",
    borderRadius: 999,
  },
  benefitText: { fontSize: 11, color: "#15803D", fontWeight: "600" },
  priceCol: { flexDirection: "row", alignItems: "center", gap: 6 },
  planPrice: { fontSize: 17, fontWeight: "800", color: "#F59E0B" },

  skipBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  skipText: { color: "#6B7280", fontWeight: "700" },
});

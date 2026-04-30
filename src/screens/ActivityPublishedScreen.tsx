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
import { useTheme } from "../contexts/ThemeContext";

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
  const { theme } = useTheme();

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

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Success header */}
        <View style={s.successHero}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#fff" />
          </View>
          <Text style={s.successTitle}>Your activity is live!</Text>
          <Text style={s.successSub}>
            {isPaid
              ? "Tickets can now be purchased."
              : "People can now find and join it on the map."}
          </Text>
        </View>

        {/* Boost upsell */}
        <View style={s.boostBlock}>
          <View style={s.boostHeaderRow}>
            <Ionicons name="rocket" size={22} color="#F59E0B" />
            <Text style={s.boostHeader}>Want more people to see it?</Text>
          </View>
          <Text style={s.boostSub}>
            Boost your activity on the map to get more attendees.
          </Text>

          {BOOST_PLANS.map((plan) => {
            const isBusy = busy === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                disabled={!!busy}
                style={[s.planCard, plan.popular && s.planCardPopular]}
                onPress={() => handleBoost(plan.id)}
                activeOpacity={0.85}
              >
                {plan.popular && (
                  <View style={s.popularPill}>
                    <Text style={s.popularPillText}>POPULAR</Text>
                  </View>
                )}
                <View style={s.planRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.planLabel}>{plan.label}</Text>
                    <View style={s.benefitsRow}>
                      {plan.benefits.map((b) => (
                        <View key={b} style={s.benefitChip}>
                          <Ionicons name="checkmark" size={11} color="#4CAF50" />
                          <Text style={s.benefitText}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={s.priceCol}>
                    {isBusy ? (
                      <ActivityIndicator color="#F59E0B" />
                    ) : (
                      <>
                        <Text style={s.planPrice}>
                          {formatPrice(plan.priceCents)}
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                      </>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={s.skipBtn}
            onPress={goToActivity}
            disabled={!!busy}
          >
            <Text style={s.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 40 },

  successHero: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 32,
    backgroundColor: "#2E7D32",
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
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  boostHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  boostHeader: { fontSize: 17, fontWeight: "800", color: theme.colors.text },
  boostSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, marginBottom: 14 },

  planCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: theme.colors.surfaceVariant ?? theme.colors.surface,
  },
  planCardPopular: {
    borderColor: "#F59E0B",
    backgroundColor: theme.isDark ? '#2A2200' : '#FFFBEB',
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
  planLabel: { fontSize: 16, fontWeight: "800", color: theme.colors.text, marginBottom: 6 },
  benefitsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  benefitChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: theme.isDark ? 'rgba(76,175,80,0.12)' : '#F0FDF4',
    borderRadius: 999,
  },
  benefitText: { fontSize: 11, color: theme.colors.primary, fontWeight: "600" },
  priceCol: { flexDirection: "row", alignItems: "center", gap: 6 },
  planPrice: { fontSize: 17, fontWeight: "800", color: "#F59E0B" },

  skipBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  skipText: { color: theme.colors.textSecondary, fontWeight: "700" },
});

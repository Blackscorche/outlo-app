import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import {
  formatPrice,
  PLATFORM_FEE_BPS,
  getCategoryDefaultImage,
} from "../constants/activityCategories";
import { processTicketPurchase } from "../hooks/useTickets";
import { useLoveMapIAP } from "../services/iapService";
import { TICKET_PRODUCTS } from "../services/iapService";
import { useActivities, Activity } from "../hooks/useActivities";

/**
 * Ticket purchase summary screen. Shows price breakdown then processes
 * IAP purchase. On success, navigates to the success screen.
 */
export default function TicketCheckoutScreen({ route, navigation }: any) {
  const { activityId } = route.params || {};
  const { getActivityById } = useActivities();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Handle ticket purchase success
  const handleTicketPurchaseSuccess = useCallback(async (purchase: any) => {
    const success = await processTicketPurchase(
      activityId,
      purchase.productId,
      purchase.transactionId,
      purchase.purchaseToken,
      Platform.OS === "ios" ? "ios" : "android",
    );
    if (success) {
      navigation.replace("TicketSuccess", { activityId });
    }
    setBusy(false);
  }, [activityId, navigation]);

  const handleTicketPurchaseError = useCallback((error: any) => {
    setBusy(false);
    if (error?.code !== "E_USER_CANCELLED") {
      Alert.alert("Purchase Failed", error?.message || "Could not complete purchase");
    }
  }, []);

  const { purchaseProduct } = useLoveMapIAP({
    onTicketPurchaseSuccess: handleTicketPurchaseSuccess,
    onPurchaseError: handleTicketPurchaseError,
  }, activityId);

  useEffect(() => {
    (async () => {
      const a = await getActivityById(activityId);
      setActivity(a);
      setLoading(false);
    })();
  }, [activityId]);

  const grossCents = activity?.ticket_price_cents ?? 0;
  const platformFeeCents = Math.round((grossCents * PLATFORM_FEE_BPS) / 10000);

  // Resolve the IAP product ID that matches the activity's ticket price (closest tier)
  const resolvedProductId = (() => {
    if (!activity?.ticket_price_cents) return "";
    const price = activity.ticket_price_cents;
    let closest = "outlo_ticket_5";
    let minDiff = Math.abs(500 - price);
    Object.entries(TICKET_PRODUCTS).forEach(([id, config]) => {
      const diff = Math.abs(config.cents - price);
      if (diff < minDiff) { minDiff = diff; closest = id; }
    });
    return closest;
  })();

  const onPay = async () => {
    if (!activity || !resolvedProductId) return;
    try {
      setBusy(true);

      // Purchase via IAP
      purchaseProduct(resolvedProductId);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not complete purchase");
      setBusy(false);
    } finally {
      // setBusy will be set to false in handleTicketPurchaseSuccess
    }
  };

  if (loading || !activity) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </SafeAreaView>
    );
  }

  const heroSrc = activity.image_url
    ? { uri: activity.image_url }
    : getCategoryDefaultImage(activity.category);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buy Ticket</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.activityCard}>
          <Image source={heroSrc} style={styles.heroImg} />
          <View style={{ padding: 14 }}>
            <Text style={styles.title}>{activity.title}</Text>
            <View style={styles.row}>
              <Ionicons name="calendar" size={14} color="#6B7280" />
              <Text style={styles.rowText}>
                {new Date(activity.scheduled_at).toLocaleString()}
              </Text>
            </View>
            <View style={styles.row}>
              <Ionicons name="location" size={14} color="#6B7280" />
              <Text style={styles.rowText}>{activity.location_name}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryHeader}>Order summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ticket</Text>
            <Text style={styles.summaryValue}>{formatPrice(grossCents)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotal}>Total</Text>
            <Text style={styles.summaryTotalValue}>
              {formatPrice(grossCents)}
            </Text>
          </View>
          <Text style={styles.feeNote}>
            Platform fee ({PLATFORM_FEE_BPS / 100}%): {formatPrice(platformFeeCents)} —
            paid from creator payout, not added to your total.
          </Text>
        </View>

        <View style={styles.terms}>
          <Ionicons name="shield-checkmark" size={14} color="#4CAF50" />
          <Text style={styles.termsText}>
            Secure payment via App Store / Google Play. By continuing you agree to Outlo's terms
            and refund policy.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, busy && styles.payBtnDisabled]}
          onPress={onPay}
          disabled={busy || !resolvedProductId}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={16} color="#fff" />
              <Text style={styles.payBtnText}>
                Pay {formatPrice(grossCents)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#1A1A1A",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333333",
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },

  scroll: { padding: 16, paddingBottom: 30 },

  activityCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
  },
  heroImg: { width: "100%", height: 140, backgroundColor: "#333333" },
  title: { fontSize: 18, fontWeight: "800", color: "#FFFFFF", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  rowText: { fontSize: 13, color: "#B3B3B3" },

  summaryCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  summaryHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B3B3B3",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14, color: "#B3B3B3" },
  summaryValue: { fontSize: 14, color: "#FFFFFF", fontWeight: "600" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#333333",
    marginVertical: 6,
  },
  summaryTotal: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  summaryTotalValue: { fontSize: 16, fontWeight: "800", color: "#4CAF50" },
  feeNote: { fontSize: 11, color: "#666666", marginTop: 6 },

  terms: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  termsText: { fontSize: 12, color: "#B3B3B3", flex: 1 },

  footer: {
    backgroundColor: "#1A1A1A",
    padding: 14,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#333333",
  },
  payBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});

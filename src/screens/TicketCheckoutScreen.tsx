import React, { useEffect, useState } from "react";
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
import * as WebBrowser from "expo-web-browser";
import {
  formatPrice,
  PLATFORM_FEE_BPS,
  getCategoryDefaultImage,
} from "../constants/activityCategories";
import { startTicketCheckout } from "../hooks/useTickets";
import { useActivities, Activity } from "../hooks/useActivities";

/**
 * Ticket purchase summary screen. Shows price breakdown then opens
 * Stripe-hosted Checkout in an in-app browser. On return, the webhook
 * has confirmed the ticket so we navigate to the success screen.
 */
export default function TicketCheckoutScreen({ route, navigation }: any) {
  const { activityId } = route.params || {};
  const { getActivityById } = useActivities();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const a = await getActivityById(activityId);
      setActivity(a);
      setLoading(false);
    })();
  }, [activityId]);

  const grossCents = activity?.ticket_price_cents ?? 0;
  const platformFeeCents = Math.round((grossCents * PLATFORM_FEE_BPS) / 10000);
  const totalCents = grossCents; // Buyer pays gross; platform fee comes from creator payout

  const onPay = async () => {
    if (!activity) return;
    try {
      setBusy(true);
      const url = await startTicketCheckout(activity.id);
      if (!url) return;

      const result = await WebBrowser.openAuthSessionAsync(url, "lovemap://");
      if (result.type === "success" || result.type === "dismiss") {
        // Webhook confirms server-side. Navigate optimistically; the
        // success screen polls until the ticket is paid.
        navigation.replace("TicketSuccess", { activityId: activity.id });
      } else if (result.type === "cancel") {
        Alert.alert("Payment cancelled");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not open checkout");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !activity) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16A34A" />
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
          <Ionicons name="arrow-back" size={22} color="#111827" />
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
              {formatPrice(totalCents)}
            </Text>
          </View>
          <Text style={styles.feeNote}>
            Platform fee ({PLATFORM_FEE_BPS / 100}%): {formatPrice(platformFeeCents)} —
            paid from creator payout, not added to your total.
          </Text>
        </View>

        <View style={styles.terms}>
          <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
          <Text style={styles.termsText}>
            Secure payment by Stripe. By continuing you agree to Outlo's terms
            and refund policy.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, busy && styles.payBtnDisabled]}
          onPress={onPay}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={16} color="#fff" />
              <Text style={styles.payBtnText}>
                Pay {formatPrice(totalCents)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },

  scroll: { padding: 16, paddingBottom: 30 },

  activityCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
  },
  heroImg: { width: "100%", height: 140, backgroundColor: "#E5E7EB" },
  title: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  rowText: { fontSize: 13, color: "#374151" },

  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  summaryHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14, color: "#374151" },
  summaryValue: { fontSize: 14, color: "#111827", fontWeight: "600" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginVertical: 6,
  },
  summaryTotal: { fontSize: 16, fontWeight: "800", color: "#111827" },
  summaryTotalValue: { fontSize: 16, fontWeight: "800", color: "#16A34A" },
  feeNote: { fontSize: 11, color: "#9CA3AF", marginTop: 6 },

  terms: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  termsText: { fontSize: 12, color: "#6B7280", flex: 1 },

  footer: {
    backgroundColor: "#fff",
    padding: 14,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  payBtn: {
    backgroundColor: "#16A34A",
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

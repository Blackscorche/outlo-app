import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../integrations/supabase/client";
import { formatPrice } from "../constants/activityCategories";
import { useTheme } from '../contexts/ThemeContext';

/**
 * After Stripe checkout. We poll until the webhook flips the latest pending
 * ticket to `paid`, then show a confirmation with the ticket code (used as
 * a future QR code).
 */
export default function TicketSuccessScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { activityId } = route.params || {};
  const [ticket, setTicket] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      // Find most recent ticket for this activity by this buyer
      const { data } = await supabase
        .from("activity_tickets")
        .select(
          "id, payment_status, gross_amount_cents, currency, ticket_code, activity:activities(title, scheduled_at, location_name, image_url)",
        )
        .eq("activity_id", activityId)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setTicket(data);
        setActivity((data as any).activity);
        if (data.payment_status === "paid") {
          setDone(true);
          return;
        }
      }
      if (tries < 12) {
        setTimeout(() => setTries((t) => t + 1), 2000);
      }
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [activityId, tries]);

  const goActivities = () =>
    navigation.reset({
      index: 0,
      routes: [{ name: "Main", params: { screen: "Activities" } }],
    });

  if (!done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.loadingText}>Confirming your payment…</Text>
          <Text style={styles.loadingSub}>This usually takes a few seconds.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="checkmark-circle" size={72} color="#fff" />
        </View>
        <Text style={styles.heroTitle}>You're in!</Text>
        <Text style={styles.heroSub}>
          Your ticket is confirmed. We've added you to the activity.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.activityTitle}>{activity?.title}</Text>
        <Text style={styles.activityMeta}>
          {activity?.scheduled_at
            ? new Date(activity.scheduled_at).toLocaleString()
            : ""}
        </Text>
        <Text style={styles.activityMeta}>{activity?.location_name}</Text>

        <View style={styles.divider} />

        <Text style={styles.codeLabel}>Ticket code</Text>
        <Text style={styles.code}>{ticket?.ticket_code}</Text>

        <Text style={styles.amountLabel}>Amount paid</Text>
        <Text style={styles.amount}>
          {formatPrice(ticket?.gross_amount_cents ?? 0, ticket?.currency)}
        </Text>
      </View>

      <View style={{ padding: 16 }}>
        <TouchableOpacity style={styles.primaryBtn} onPress={goActivities}>
          <Text style={styles.primaryBtnText}>Go to my activities</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { fontSize: 16, fontWeight: "700", color: "#111827", marginTop: 16 },
  loadingSub: { fontSize: 13, color: "#6B7280" },

  hero: {
    backgroundColor: "#16A34A",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  heroIcon: { marginBottom: 14 },
  heroTitle: { fontSize: 26, fontWeight: "800", color: "#fff" },
  heroSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginTop: 4,
  },

  card: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 18,
    borderRadius: 14,
  },
  activityTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 6 },
  activityMeta: { fontSize: 13, color: "#6B7280", marginBottom: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginVertical: 14,
  },
  codeLabel: { fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 },
  code: { fontSize: 16, fontFamily: "Courier", color: "#111827", marginTop: 4, marginBottom: 14 },
  amountLabel: { fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 },
  amount: { fontSize: 22, fontWeight: "800", color: "#16A34A", marginTop: 4 },

  primaryBtn: {
    backgroundColor: "#16A34A",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

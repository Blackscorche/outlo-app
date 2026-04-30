import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../integrations/supabase/client';
import { useTheme } from '../contexts/ThemeContext';

interface TicketSale {
  id: string;
  gross_amount_cents: number;
  creator_payout_cents: number;
  platform_fee_cents: number;
  payment_status: string;
  paid_at: string;
  activity_id: string;
  activity_title: string;
}

export default function CreatorWalletScreen({ navigation }: any) {
  const [sales, setSales] = useState<TicketSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: myActivities } = await supabase
        .from('activities')
        .select('id, title')
        .eq('creator_id', user.id)
        .eq('is_paid', true);

      if (!myActivities || myActivities.length === 0) {
        setSales([]);
        return;
      }

      const activityIds = myActivities.map(a => a.id);
      const titleMap = Object.fromEntries(myActivities.map(a => [a.id, a.title]));

      const { data: tickets } = await supabase
        .from('activity_tickets')
        .select('id, gross_amount_cents, creator_payout_cents, platform_fee_cents, payment_status, paid_at, activity_id')
        .in('activity_id', activityIds)
        .eq('payment_status', 'paid')
        .order('paid_at', { ascending: false });

      setSales((tickets ?? []).map(t => ({
        ...t,
        activity_title: titleMap[t.activity_id] ?? 'Unknown Activity',
      })));
    } catch (e) {
      console.error('CreatorWallet fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  const totalPayout = sales.reduce((sum, s) => sum + (s.creator_payout_cents ?? 0), 0);
  const totalTickets = sales.length;

  const handleRequestPayout = () => {
    Alert.alert(
      'Payout Requested',
      'Payout request sent. Outlo will process your payment within 3-5 business days.',
      [{ text: 'OK' }]
    );
  };

  const formatCents = (cents: number) => `€${(cents / 100).toFixed(2)}`;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Earnings</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#4CAF50" size="large" />
        </View>
      ) : sales.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="wallet-outline" size={56} color="#333" />
          <Text style={styles.emptyTitle}>No ticket sales yet</Text>
          <Text style={styles.emptySubtitle}>
            Create a paid activity to start earning.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Earned</Text>
                <Text style={styles.summaryValue}>{formatCents(totalPayout)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Tickets Sold</Text>
                <Text style={styles.summaryValue}>{totalTickets}</Text>
              </View>
            </View>
            <View style={styles.pendingRow}>
              <Ionicons name="time-outline" size={14} color="#B3B3B3" />
              <Text style={styles.pendingText}>
                Manual payout — tap "Request Payout" below
              </Text>
            </View>
          </View>

          {/* Transaction List */}
          <Text style={styles.sectionTitle}>Transactions</Text>
          {sales.map(sale => (
            <View key={sale.id} style={styles.txCard}>
              <View style={styles.txTop}>
                <Text style={styles.txTitle} numberOfLines={1}>
                  {sale.activity_title}
                </Text>
                <View style={styles.paidBadge}>
                  <Text style={styles.paidBadgeText}>Paid</Text>
                </View>
              </View>
              <Text style={styles.txDate}>{formatDate(sale.paid_at)}</Text>
              <View style={styles.txAmounts}>
                <View style={styles.txAmountItem}>
                  <Text style={styles.txAmountLabel}>Buyer paid</Text>
                  <Text style={styles.txAmountValue}>
                    {formatCents(sale.gross_amount_cents)}
                  </Text>
                </View>
                <View style={styles.txAmountItem}>
                  <Text style={styles.txAmountLabel}>Your payout</Text>
                  <Text style={[styles.txAmountValue, styles.payoutValue]}>
                    {formatCents(sale.creator_payout_cents)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Request Payout Button */}
      {!loading && sales.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.payoutButton} onPress={handleRequestPayout}>
            <Ionicons name="cash-outline" size={20} color="#fff" />
            <Text style={styles.payoutButtonText}>Request Payout</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.surface,
  },
  backButton: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  emptySubtitle: {
    fontSize: 14,
    color: t.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  content: { padding: 16, paddingBottom: 100 },
  summaryCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: t.colors.inputBg },
  summaryLabel: { fontSize: 13, color: t.colors.textSecondary, marginBottom: 4 },
  summaryValue: { fontSize: 28, fontWeight: '800', color: '#4CAF50' },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: t.colors.inputBg,
  },
  pendingText: { fontSize: 12, color: t.colors.textSecondary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  txCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  txTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  txTitle: { fontSize: 15, fontWeight: '600', color: '#fff', flex: 1, marginRight: 8 },
  paidBadge: {
    backgroundColor: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  paidBadgeText: { fontSize: 12, fontWeight: '700', color: '#4CAF50' },
  txDate: { fontSize: 12, color: t.colors.textSecondary, marginBottom: 12 },
  txAmounts: { flexDirection: 'row', gap: 20 },
  txAmountItem: {},
  txAmountLabel: { fontSize: 12, color: t.colors.textSecondary, marginBottom: 2 },
  txAmountValue: { fontSize: 15, fontWeight: '600', color: '#fff' },
  payoutValue: { color: '#4CAF50' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: t.colors.surface },
  payoutButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  payoutButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

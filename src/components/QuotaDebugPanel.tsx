import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useQuotaManager, QuotaDetails } from '../hooks/useQuotaManager';
import { useSubscription } from '../hooks/useSubscription';
import { useIAP } from '../components/IAPProvider';

export const QuotaDebugPanel: React.FC = () => {
  const [quotaDetails, setQuotaDetails] = useState<QuotaDetails | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const { getQuotaDetails, loading } = useQuotaManager();
  const { subscription } = useSubscription();
  const { products, subscriptions, availablePurchases, connected } = useIAP();

  useEffect(() => {
    loadQuotaDetails();
  }, []);

  const loadQuotaDetails = async () => {
    setRefreshing(true);
    const details = await getQuotaDetails();
    setQuotaDetails(details);
    setRefreshing(false);
  };

  if (!__DEV__) {
    return null; // Only show in development
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Debug Panel</Text>
        <TouchableOpacity onPress={loadQuotaDetails} disabled={refreshing}>
          <Ionicons 
            name="refresh" 
            size={20} 
            color={refreshing ? theme.colors.textSecondary : theme.colors.primary} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* IAP Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IAP Status</Text>
          <Text style={styles.debugText}>Connected: {connected ? '✅' : '❌'}</Text>
          <Text style={styles.debugText}>Products: {products.length}</Text>
          <Text style={styles.debugText}>Subscriptions: {subscriptions.length}</Text>
          <Text style={styles.debugText}>Available Purchases: {availablePurchases.length}</Text>
        </View>

        {/* Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <Text style={styles.debugText}>Tier: {subscription?.tier || 'unknown'}</Text>
          <Text style={styles.debugText}>Status: {subscription?.status || 'unknown'}</Text>
          <Text style={styles.debugText}>Product: {subscription?.productId || 'none'}</Text>
          <Text style={styles.debugText}>Period End: {subscription?.current_period_end || 'none'}</Text>
        </View>

        {/* Quota Details */}
        {quotaDetails && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quotas</Text>
            
            <Text style={styles.subTitle}>Connection Requests</Text>
            <Text style={styles.debugText}>Remaining: {quotaDetails.connectionRequests.remaining}</Text>
            <Text style={styles.debugText}>Purchased: {quotaDetails.connectionRequests.purchased}</Text>
            <Text style={styles.debugText}>Total: {quotaDetails.connectionRequests.total}</Text>
            
            <Text style={styles.subTitle}>First Impressions</Text>
            <Text style={styles.debugText}>Remaining: {quotaDetails.firstImpressions.remaining}</Text>
            <Text style={styles.debugText}>Purchased: {quotaDetails.firstImpressions.purchased}</Text>
            <Text style={styles.debugText}>Total: {quotaDetails.firstImpressions.total}</Text>
            
            <Text style={styles.subTitle}>Invisible Mode</Text>
            <Text style={styles.debugText}>Active: {quotaDetails.invisibleMode.active ? '✅' : '❌'}</Text>
            <Text style={styles.debugText}>Source: {quotaDetails.invisibleMode.source}</Text>
            {quotaDetails.invisibleMode.expiresAt && (
              <Text style={styles.debugText}>
                Expires: {new Date(quotaDetails.invisibleMode.expiresAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        {/* Product List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Products</Text>
          {products.map((product, index) => (
            <Text key={index} style={styles.debugText}>
              {product.id}: {product.price}
            </Text>
          ))}
          {subscriptions.map((sub, index) => (
            <Text key={`sub-${index}`} style={styles.debugText}>
              {sub.id}: {sub.price}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  content: {
    maxHeight: 300,
    padding: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 8,
    marginBottom: 2,
  },
  debugText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});

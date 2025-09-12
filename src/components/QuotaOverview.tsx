import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useQuotaManager, QuotaDetails } from '../hooks/useQuotaManager';
import { useNavigation } from '@react-navigation/native';

export const QuotaOverview: React.FC = () => {
  const [quotaDetails, setQuotaDetails] = useState<QuotaDetails | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const { getQuotaDetails } = useQuotaManager();
  const navigation = useNavigation();

  useEffect(() => {
    loadQuotaDetails();
  }, []);

  const loadQuotaDetails = async () => {
    setRefreshing(true);
    const details = await getQuotaDetails();
    setQuotaDetails(details);
    setRefreshing(false);
  };

  const navigateToSubscription = () => {
    navigation.navigate('Subscription' as never);
  };

  if (!quotaDetails) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading quotas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Quotas</Text>
        <TouchableOpacity onPress={loadQuotaDetails} disabled={refreshing}>
          <Ionicons 
            name="refresh" 
            size={20} 
            color={refreshing ? theme.colors.textSecondary : theme.colors.primary} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.quotasList}>
        {/* Connection Requests */}
        <TouchableOpacity style={styles.quotaItem} onPress={navigateToSubscription}>
          <View style={styles.quotaIcon}>
            <Ionicons name="people" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.quotaInfo}>
            <Text style={styles.quotaName}>Connection Requests</Text>
            <Text style={styles.quotaDetails}>
              {quotaDetails.connectionRequests.total} available
              {quotaDetails.connectionRequests.purchased > 0 && 
                ` (${quotaDetails.connectionRequests.purchased} purchased)`
              }
            </Text>
          </View>
          <Text style={styles.quotaValue}>
            {quotaDetails.connectionRequests.total}
          </Text>
        </TouchableOpacity>

        {/* First Impressions */}
        <TouchableOpacity style={styles.quotaItem} onPress={navigateToSubscription}>
          <View style={styles.quotaIcon}>
            <Ionicons name="mail" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.quotaInfo}>
            <Text style={styles.quotaName}>First Impressions</Text>
            <Text style={styles.quotaDetails}>
              {quotaDetails.firstImpressions.total} available
              {quotaDetails.firstImpressions.purchased > 0 && 
                ` (${quotaDetails.firstImpressions.purchased} purchased)`
              }
            </Text>
          </View>
          <Text style={styles.quotaValue}>
            {quotaDetails.firstImpressions.total}
          </Text>
        </TouchableOpacity>

        {/* Invisible Mode */}
        <TouchableOpacity style={styles.quotaItem} onPress={navigateToSubscription}>
          <View style={styles.quotaIcon}>
            <Ionicons 
              name="eye-off" 
              size={20} 
              color={quotaDetails.invisibleMode.active ? theme.colors.success : theme.colors.textSecondary} 
            />
          </View>
          <View style={styles.quotaInfo}>
            <Text style={styles.quotaName}>Invisible Mode</Text>
            <Text style={styles.quotaDetails}>
              {quotaDetails.invisibleMode.active ? (
                quotaDetails.invisibleMode.source === 'premium' ? 
                  'Active with Premium' : 
                  `Active until ${quotaDetails.invisibleMode.expiresAt ? 
                    new Date(quotaDetails.invisibleMode.expiresAt).toLocaleDateString() : 
                    'unknown'}`
              ) : 'Not active'}
            </Text>
          </View>
          <Text style={[
            styles.quotaValue,
            { color: quotaDetails.invisibleMode.active ? theme.colors.success : theme.colors.textSecondary }
          ]}>
            {quotaDetails.invisibleMode.active ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Button */}
      <TouchableOpacity style={styles.actionButton} onPress={navigateToSubscription}>
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.actionButtonText}>Get More</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  loadingText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 16,
    padding: 20,
  },
  quotasList: {
    gap: 12,
    marginBottom: 16,
  },
  quotaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  quotaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quotaInfo: {
    flex: 1,
  },
  quotaName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  quotaDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  quotaValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

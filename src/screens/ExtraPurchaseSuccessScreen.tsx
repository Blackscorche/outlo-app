import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';
import { supabase } from '../integrations/supabase/client';
import subscriptionService from '../services/subscriptionService';

const ExtraPurchaseSuccessScreen = ({ navigation, route }: any) => {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<any>(null);

  useEffect(() => {
    handlePurchaseSuccess();
  }, []);

  const handlePurchaseSuccess = async () => {
    try {
      // Get session ID from route params
      const sessionId = route.params?.session_id;
      const purchaseType = route.params?.type || 'extra';
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Refresh quotas to show updated balance
      const updatedQuotas = await subscriptionService.getUserQuotas(user.id);
      
      if (updatedQuotas) {
        setPurchaseDetails({
          connectionRequests: updatedQuotas.connection_requests_remaining + updatedQuotas.connection_requests_purchased,
          firstImpressions: updatedQuotas.first_impressions_remaining + updatedQuotas.first_impressions_purchased,
          invisibleMode: updatedQuotas.invisible_mode_expires_at,
        });
        setSuccess(true);
      }
      
      setLoading(false);
      
      // Auto-navigate after 3 seconds
      setTimeout(() => {
        navigation.navigate('Subscription');
      }, 3000);
    } catch (err) {
      console.error('Error processing purchase success:', err);
      setLoading(false);
      // Still navigate to subscription screen
      setTimeout(() => {
        navigation.navigate('Subscription');
      }, 2000);
    }
  };

  const handleContinue = () => {
    navigation.navigate('Subscription');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Processing your purchase...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={100} color={theme.colors.success} />
        </View>
        
        <Text style={styles.title}>Purchase Successful!</Text>
        <Text style={styles.message}>
          Your extra features have been added to your account.
        </Text>
        
        {purchaseDetails && (
          <View style={styles.detailsContainer}>
            <Text style={styles.detailsTitle}>Your Updated Balance:</Text>
            
            <View style={styles.detailItem}>
              <Ionicons name="people" size={20} color={theme.colors.primary} />
              <Text style={styles.detailText}>
                Connection Requests: {purchaseDetails.connectionRequests}
              </Text>
            </View>
            
            <View style={styles.detailItem}>
              <Ionicons name="mail" size={20} color={theme.colors.primary} />
              <Text style={styles.detailText}>
                First Impressions: {purchaseDetails.firstImpressions}
              </Text>
            </View>
            
            {purchaseDetails.invisibleMode && (
              <View style={styles.detailItem}>
                <Ionicons name="eye-off" size={20} color={theme.colors.primary} />
                <Text style={styles.detailText}>
                  Invisible Mode: Active until {new Date(purchaseDetails.invisibleMode).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        )}
        
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
        
        <Text style={styles.autoRedirectText}>
          Redirecting to subscription screen...
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  successIcon: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 24,
  },
  loadingText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  detailsContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    width: '100%',
  },
  detailsTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  detailText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl * 2,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.md,
  },
  buttonText: {
    color: 'white',
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  autoRedirectText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default ExtraPurchaseSuccessScreen;
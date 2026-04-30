import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles } from '../styles/common';
import { supabase } from '../integrations/supabase/client';
import AppLoading from '../components/AppLoading';
import subscriptionService from '../services/subscriptionService';
import { useTheme } from '../contexts/ThemeContext';

const ExtraPurchaseSuccessScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
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
          <AppLoading />
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

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: t.spacing.xl,
  },
  successIcon: {
    marginBottom: t.spacing.xl,
  },
  title: {
    fontSize: t.fontSize.xxl,
    fontWeight: 'bold',
    color: t.colors.text,
    marginBottom: t.spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: t.fontSize.md,
    color: t.colors.textSecondary,
    textAlign: 'center',
    marginBottom: t.spacing.xl,
    lineHeight: 24,
  },
  loadingText: {
    fontSize: t.fontSize.md,
    color: t.colors.textSecondary,
    marginTop: t.spacing.md,
  },
  detailsContainer: {
    backgroundColor: t.colors.card,
    borderRadius: t.borderRadius.lg,
    padding: t.spacing.lg,
    marginBottom: t.spacing.xl,
    width: '100%',
  },
  detailsTitle: {
    fontSize: t.fontSize.md,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: t.spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: t.spacing.sm,
  },
  detailText: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    marginLeft: t.spacing.sm,
  },
  button: {
    backgroundColor: t.colors.primary,
    paddingHorizontal: t.spacing.xl * 2,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.full,
    marginBottom: t.spacing.md,
  },
  buttonText: {
    color: 'white',
    fontSize: t.fontSize.md,
    fontWeight: '600',
  },
  autoRedirectText: {
    fontSize: t.fontSize.xs,
    color: t.colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default ExtraPurchaseSuccessScreen;
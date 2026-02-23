import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';
import { supabase } from '../integrations/supabase/client';
import subscriptionService from '../services/subscriptionService';
import { useSubscription } from '../hooks/useSubscription';
import AppLoading from '../components/AppLoading';

const SubscriptionSuccessScreen = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshSubscription } = useSubscription();

  useEffect(() => {
    handleSubscriptionSuccess();
  }, []);

  const handleSubscriptionSuccess = async () => {
    try {
      // Get session ID from route params or URL
      const sessionId = route.params?.session_id;
      
      if (!sessionId) {
        setError('Payment session information not found.');
        setLoading(false);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User information not found.');
        setLoading(false);
        return;
      }

      // Force refresh subscription data from backend API
      // This will retry multiple times with delays to handle webhook processing
      const updatedSubscription = await subscriptionService.getSubscriptionStatus(user.id, true);
      
      // Check if subscription was successfully updated
      if (updatedSubscription && updatedSubscription.tier === 'premium' && updatedSubscription.status === 'active') {
        setSuccess(true);
        // Refresh the subscription context to update the global state
        await refreshSubscription();
      } else {
        // If subscription is not yet updated, it might still be processing
        setError('Your payment is being processed. Please check your subscription status in a few moments.');
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error processing subscription success:', err);
      setError('Your payment is being processed. Please check your subscription status in a few moments.');
      setLoading(false);
    }
  };

  const handleContinue = () => {
    // Navigate back to subscription screen to see updated status
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

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle" size={80} color={theme.colors.error} />
          <Text style={styles.title}>An Error Occurred</Text>
          <Text style={styles.message}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        <Ionicons name="checkmark-circle" size={80} color={theme.colors.success} />
        <Text style={styles.title}>Payment Completed!</Text>
        <Text style={styles.message}>
          Your premium subscription has been successfully activated.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Go to Subscription</Text>
        </TouchableOpacity>
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
    paddingHorizontal: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  message: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 24,
  },
  loadingText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 200,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SubscriptionSuccessScreen;
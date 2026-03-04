import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../hooks/useAuth';

const ChangeEmailScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendCode = async () => {
    setError('');

    if (!newEmail.trim()) {
      setError('Please enter your new email address');
      return;
    }

    if (!isValidEmail(newEmail.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setError('New email must be different from your current email');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');

    if (!otpCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: newEmail.trim(),
        token: otpCode.trim(),
        type: 'email_change',
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
          </View>
          <Text style={styles.successTitle}>Email Updated</Text>
          <Text style={styles.successMessage}>
            Your email has been changed to {newEmail.trim()} successfully.
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.successButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.actionButtonText}>Back to Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Email</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === 1 ? (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>Current Email</Text>
                <View style={[styles.inputRow, styles.disabledInput]}>
                  <Text style={styles.currentEmailText}>{user?.email || ''}</Text>
                </View>

                <Text style={styles.label}>New Email</Text>
                <View style={[styles.inputRow, { marginBottom: 0 }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new email address"
                    placeholderTextColor={theme.colors.gray[400]}
                    value={newEmail}
                    onChangeText={(t) => { setNewEmail(t); setError(''); }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.actionButton, loading && styles.actionButtonDisabled]}
                onPress={handleSendCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.actionButtonText}>Send Verification Code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.infoCard}>
                <Ionicons name="mail-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.infoText}>
                  A verification code has been sent to {newEmail.trim()}. Please check your inbox.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>Verification Code</Text>
                <View style={[styles.inputRow, { marginBottom: 0 }]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={theme.colors.gray[400]}
                    value={otpCode}
                    onChangeText={(t) => { setOtpCode(t); setError(''); }}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.actionButton, loading && styles.actionButtonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.actionButtonText}>Verify & Update Email</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendRow}
                onPress={() => { setStep(1); setOtpCode(''); setError(''); }}
              >
                <Text style={styles.resendText}>Change email or resend code</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  disabledInput: {
    backgroundColor: theme.colors.gray[100],
  },
  currentEmailText: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  input: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: theme.fontSize.base,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  resendText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  successButton: {
    alignSelf: 'stretch',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  successIconCircle: {
    marginBottom: theme.spacing.md,
  },
  successTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  successMessage: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
});

export default ChangeEmailScreen;

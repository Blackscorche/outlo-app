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

const ChangePasswordScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async () => {
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from your current password');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Verify current password by attempting sign-in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });

      if (signInError) {
        setError('Current password is incorrect');
        setLoading(false);
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
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
          <Text style={styles.successTitle}>Password Updated</Text>
          <Text style={styles.successMessage}>
            Your password has been changed successfully.
          </Text>
          <TouchableOpacity
            style={[styles.updateButton, styles.successButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.updateButtonText}>Back to Settings</Text>
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
        <Text style={styles.headerTitle}>Change Password</Text>
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

          <View style={styles.card}>
            {/* Current Password */}
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Enter current password"
                placeholderTextColor={theme.colors.gray[400]}
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={(t) => { setCurrentPassword(t); setError(''); }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.gray[400]}
                />
              </TouchableOpacity>
            </View>

            {/* New Password */}
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor={theme.colors.gray[400]}
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={(t) => { setNewPassword(t); setError(''); }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.gray[400]}
                />
              </TouchableOpacity>
            </View>

            {/* Confirm New Password */}
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={[styles.inputRow, { marginBottom: 0 }]}>
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={theme.colors.gray[400]}
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.gray[400]}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.requirementsCard}>
            <Text style={styles.requirementsTitle}>Password Requirements</Text>
            <Text style={styles.requirementItem}>- At least 6 characters</Text>
          </View>

          <TouchableOpacity
            style={[styles.updateButton, loading && styles.updateButtonDisabled]}
            onPress={handleUpdatePassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.updateButtonText}>Update Password</Text>
            )}
          </TouchableOpacity>
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
  input: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  eyeButton: {
    paddingHorizontal: theme.spacing.sm + 4,
    paddingVertical: theme.spacing.sm,
  },
  requirementsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  requirementsTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  requirementItem: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  updateButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: '#FFF',
    fontSize: theme.fontSize.base,
    fontWeight: '700',
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

export default ChangePasswordScreen;

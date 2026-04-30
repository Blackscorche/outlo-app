import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import subscriptionService from '../services/subscriptionService';
import { supabase } from '../integrations/supabase/client';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../styles/theme';

interface FirstImpressionModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  receiverName: string;
  connectionRequestId?: string;
  receiverId: string;
}

export const FirstImpressionModal: React.FC<FirstImpressionModalProps> = ({
  visible,
  onClose,
  onSend,
  receiverName,
  connectionRequestId,
  receiverId,
}) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [canSend, setCanSend] = useState(false);

  React.useEffect(() => {
    checkQuota();
  }, [visible]);

  const checkQuota = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const hasQuota = await subscriptionService.canSendFirstImpression(user.id);
      setCanSend(hasQuota);
    } catch (error) {
      console.error('Error checking first impression quota:', error);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please write a message');
      return;
    }

    if (!canSend) {
      Alert.alert(
        'No First Impressions Available',
        'You need to purchase first impressions or upgrade to Premium to send messages before connecting.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Plans', onPress: () => {
            onClose();
            // Navigate to subscription screen
          }},
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create first impression
      const { error } = await supabase
        .from('first_impressions')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          connection_request_id: connectionRequestId,
          message: message.trim(),
        });

      if (error) throw error;

      // Use a first impression quota
      const quotas = await subscriptionService.getUserQuotas(user.id);
      if (quotas.first_impressions_remaining > 0) {
        await supabase
          .from('user_quotas')
          .update({
            first_impressions_remaining: quotas.first_impressions_remaining - 1,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      } else if (quotas.first_impressions_purchased > 0) {
        await supabase
          .from('user_quotas')
          .update({
            first_impressions_purchased: quotas.first_impressions_purchased - 1,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }

      Alert.alert('Success', 'Your first impression has been sent!');
      onSend(message);
      setMessage('');
      onClose();
    } catch (error) {
      console.error('Error sending first impression:', error);
      Alert.alert('Error', 'Failed to send first impression. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>First Impression</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Introduce yourself to {receiverName} and suggest an activity you could do together
          </Text>

          {!canSend && (
            <View style={styles.warningBox}>
              <Ionicons name="information-circle" size={20} color={theme.colors.warning} />
              <Text style={styles.warningText}>
                You don't have any first impressions available. Upgrade to Premium or purchase extras.
              </Text>
            </View>
          )}

          <TextInput
            style={styles.messageInput}
            placeholder="Introduce yourself and suggest an activity..."
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
            editable={canSend && !loading}
          />

          <Text style={styles.charCount}>
            {message.length}/500 characters
          </Text>

          <TouchableOpacity
            style={[styles.sendButton, (!canSend || !message.trim() || loading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!canSend || !message.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="white" />
                <Text style={styles.sendButtonText}>Send First Impression</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  title: {
    fontSize: t.fontSize.lg,
    fontWeight: '600',
    color: t.colors.text,
  },
  content: {
    flex: 1,
    padding: t.spacing.lg,
  },
  subtitle: {
    fontSize: t.fontSize.base,
    color: t.colors.textSecondary,
    marginBottom: t.spacing.xl,
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: t.colors.warning + '20',
    padding: t.spacing.md,
    borderRadius: t.borderRadius.md,
    marginBottom: t.spacing.lg,
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: t.fontSize.sm,
    color: t.colors.warning,
  },
  messageInput: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
    padding: t.spacing.md,
    fontSize: t.fontSize.base,
    color: t.colors.text,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    textAlign: 'right',
    marginTop: t.spacing.xs,
    marginBottom: t.spacing.lg,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: t.colors.primary,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: t.colors.gray[400],
  },
  sendButtonText: {
    color: 'white',
    fontSize: t.fontSize.base,
    fontWeight: '600',
  },
});
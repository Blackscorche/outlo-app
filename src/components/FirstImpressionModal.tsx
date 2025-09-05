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
import { theme } from '../styles/theme';
import subscriptionService from '../services/subscriptionService';
import { supabase } from '../integrations/supabase/client';

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
            Send a message to {receiverName} before they accept your connection request
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
            placeholder="Write something memorable..."
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  subtitle: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.warning + '20',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
  },
  messageInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  sendButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.gray[400],
  },
  sendButtonText: {
    color: 'white',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
  },
});
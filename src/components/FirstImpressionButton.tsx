import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useQuotaManager } from '../hooks/useQuotaManager';
import { useNavigation } from '@react-navigation/native';

interface FirstImpressionButtonProps {
  targetUserId: string;
  targetUserName: string;
}

export const FirstImpressionButton: React.FC<FirstImpressionButtonProps> = ({
  targetUserId,
  targetUserName,
}) => {
  const { useFirstImpression, canUseFirstImpression, loading } = useQuotaManager();
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  
  const handleFirstImpression = async () => {
    // Check if user can send first impression
    const canSend = await canUseFirstImpression();
    if (!canSend) {
      Alert.alert(
        'No First Impressions Left',
        'You have no first impressions remaining. Would you like to purchase more or upgrade to Premium?',
        [
          { text: 'Not Now', style: 'cancel' },
          { 
            text: 'Get More', 
            style: 'default', 
            onPress: () => {
              // Navigate to subscription screen
              navigation.navigate('Subscription' as never);
            }
          }
        ]
      );
      return;
    }

    // Show message input modal
    setModalVisible(true);
  };

  const sendFirstImpression = async () => {
    if (!message.trim()) {
      Alert.alert('Message Required', 'Please enter a message for your first impression.');
      return;
    }

    // Use the first impression
    const success = await useFirstImpression(false); // Don't show default alert
    
    if (success) {
      setModalVisible(false);
      setMessage('');
      
      Alert.alert(
        'First Impression Sent! ✨',
        `Your message has been sent to ${targetUserName}.`
      );
      
      // Here you would call your API to actually send the first impression
      // await sendFirstImpressionAPI(targetUserId, message);
      
    } else {
      Alert.alert(
        'Failed to Send',
        'Unable to send first impression. Please try again.'
      );
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleFirstImpression}
        disabled={loading}
      >
        <Ionicons 
          name="mail" 
          size={18} 
          color={loading ? theme.colors.textSecondary : '#fff'} 
        />
        <Text style={[styles.buttonText, loading && styles.buttonTextDisabled]}>
          {loading ? 'Sending...' : 'First Impression'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send First Impression</Text>
            <Text style={styles.modalSubtitle}>
              Send a special message to {targetUserName}
            </Text>
            
            <TextInput
              style={styles.textInput}
              placeholder="Write your first impression message..."
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
            
            <Text style={styles.characterCount}>
              {message.length}/200 characters
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setMessage('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.sendButton]}
                onPress={sendFirstImpression}
                disabled={loading || !message.trim()}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.border,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    height: 100,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  characterCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

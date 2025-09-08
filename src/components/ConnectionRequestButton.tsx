import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useQuotaManager } from '../hooks/useQuotaManager';
import { useNavigation } from '@react-navigation/native';

interface ConnectionRequestButtonProps {
  targetUserId: string;
  targetUserName: string;
}

export const ConnectionRequestButton: React.FC<ConnectionRequestButtonProps> = ({
  targetUserId,
  targetUserName,
}) => {
  const { useConnectionRequest, canUseConnectionRequest, loading } = useQuotaManager();
  const navigation = useNavigation();
  
  const handleConnectionRequest = async () => {
    // Check if user can send connection request
    const canSend = await canUseConnectionRequest();
    if (!canSend) {
      Alert.alert(
        'No Connection Requests Left',
        'You have no connection requests remaining. Would you like to purchase more or upgrade to Premium?',
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

    // Confirm connection request
    Alert.alert(
      'Send Connection Request',
      `Send a connection request to ${targetUserName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'default',
          onPress: async () => {
            // Use the connection request
            const success = await useConnectionRequest(false); // Don't show default alert
            
            if (success) {
              Alert.alert(
                'Request Sent! 💕',
                `Your connection request has been sent to ${targetUserName}.`
              );
              
              // Here you would call your API to actually send the connection request
              // await sendConnectionRequestAPI(targetUserId);
              
            } else {
              Alert.alert(
                'Failed to Send',
                'Unable to send connection request. Please try again.'
              );
            }
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity 
      style={[styles.button, loading && styles.buttonDisabled]}
      onPress={handleConnectionRequest}
      disabled={loading}
    >
      <Ionicons 
        name="person-add" 
        size={18} 
        color={loading ? theme.colors.textSecondary : '#fff'} 
      />
      <Text style={[styles.buttonText, loading && styles.buttonTextDisabled]}>
        {loading ? 'Sending...' : 'Connect'}
      </Text>
    </TouchableOpacity>
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
});

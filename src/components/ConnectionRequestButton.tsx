import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useQuotaManager } from '../hooks/useQuotaManager';
import { useNavigation } from '@react-navigation/native';
import { useToast } from '../contexts/ToastContext';
import { theme } from '../styles/theme';

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
  const { showToast } = useToast();
  
  const handleConnectionRequest = async () => {
    // Check if user can send connection request
    const canSend = await canUseConnectionRequest();
    if (!canSend) {
      showToast({
        type: 'connection_request',
        title: 'No Partner Requests Left',
        message: 'Tap to get more partner requests',
        senderName: 'LoveMap',
        onPress: () => navigation.navigate('Subscription' as never),
      });
      return;
    }

    // Use the connection request immediately (with visual feedback)
    const success = await useConnectionRequest(false); // Don't show default alert
    
    if (success) {
      showToast({
        type: 'connection_request',
        title: 'Request Sent! 💕',
        message: `Your partner request has been sent to ${targetUserName}`,
        senderName: targetUserName,
      });
      
      // Here you would call your API to actually send the connection request
      // await sendConnectionRequestAPI(targetUserId);
      
    } else {
      showToast({
        type: 'connection_request',
        title: 'Unable to Send',
        message: 'Failed to send partner request. Please try again.',
        senderName: 'LoveMap',
      });
    }
  };
  const { theme } = useTheme();
  const styles = makeStyles(theme);

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

const makeStyles = (t: any) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  buttonDisabled: {
    backgroundColor: t.colors.border,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonTextDisabled: {
    color: t.colors.textSecondary,
  },
});

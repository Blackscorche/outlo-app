import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useQuotaManager } from '../hooks/useQuotaManager';
import { useSubscription } from '../hooks/useSubscription';
import { useNavigation } from '@react-navigation/native';

export const InvisibleModeToggle: React.FC = () => {
  const { hasInvisibleMode, getQuotaDetails } = useQuotaManager();
  const { subscription } = useSubscription();
  const navigation = useNavigation();
  const [isInvisible, setIsInvisible] = useState(false);
  const [invisibleSource, setInvisibleSource] = useState<'premium' | 'purchased' | 'none'>('none');
  const [expiresAt, setExpiresAt] = useState<string | undefined>();

  useEffect(() => {
    checkInvisibleMode();
  }, [subscription]);

  const checkInvisibleMode = async () => {
    const details = await getQuotaDetails();
    if (details) {
      setIsInvisible(details.invisibleMode.active);
      setInvisibleSource(details.invisibleMode.source);
      setExpiresAt(details.invisibleMode.expiresAt);
    }
  };

  const handleInvisibleModePress = () => {
    if (isInvisible) {
      // Show current status
      let statusMessage = '';
      if (invisibleSource === 'premium') {
        statusMessage = 'Invisible mode is active with your Premium subscription.';
      } else if (invisibleSource === 'purchased' && expiresAt) {
        const expiryDate = new Date(expiresAt).toLocaleDateString();
        statusMessage = `Invisible mode is active until ${expiryDate}.`;
      }

      Alert.alert('Invisible Mode Active', statusMessage);
    } else {
      // Prompt to purchase or upgrade
      Alert.alert(
        'Invisible Mode',
        'Browse profiles invisibly! Other users won\'t see that you viewed their profile.',
        [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'Get Invisible Mode',
            style: 'default',
            onPress: () => {
              navigation.navigate('Subscription' as never);
            }
          }
        ]
      );
    }
  };

  const getStatusText = () => {
    if (!isInvisible) return 'Inactive';
    
    if (invisibleSource === 'premium') {
      return 'Active (Premium)';
    } else if (invisibleSource === 'purchased' && expiresAt) {
      const expiryDate = new Date(expiresAt);
      const daysRemaining = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return `Active (${daysRemaining} days left)`;
    }
    
    return 'Active';
  };

  const getIconColor = () => {
    return isInvisible ? theme.colors.success : theme.colors.textSecondary;
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handleInvisibleModePress}>
      <View style={styles.iconContainer}>
        <Ionicons 
          name={isInvisible ? "eye-off" : "eye-off-outline"} 
          size={20} 
          color={getIconColor()} 
        />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>Invisible Mode</Text>
        <Text style={[
          styles.status, 
          { color: isInvisible ? theme.colors.success : theme.colors.textSecondary }
        ]}>
          {getStatusText()}
        </Text>
      </View>

      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={theme.colors.textSecondary} 
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    marginVertical: 4,
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  status: {
    fontSize: 14,
    marginTop: 2,
  },
});

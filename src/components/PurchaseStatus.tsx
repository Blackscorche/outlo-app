import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

interface PurchaseStatusProps {
  isLoading?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export const PurchaseStatus: React.FC<PurchaseStatusProps> = ({
  isLoading = false,
  isSuccess = false,
  isError = false,
  message,
  size = 'medium',
}) => {
  if (!isLoading && !isSuccess && !isError) return null;

  const sizeStyles = {
    small: {
      container: styles.containerSmall,
      icon: 16,
      text: styles.textSmall,
    },
    medium: {
      container: styles.containerMedium,
      icon: 20,
      text: styles.textMedium,
    },
    large: {
      container: styles.containerLarge,
      icon: 24,
      text: styles.textLarge,
    },
  };

  const currentSize = sizeStyles[size];

  const getContent = () => {
    if (isLoading) {
      return (
        <>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={currentSize.text}>
            {message || 'Processing...'}
          </Text>
        </>
      );
    }

    if (isSuccess) {
      return (
        <>
          <Ionicons 
            name="checkmark-circle" 
            size={currentSize.icon} 
            color={theme.colors.success} 
          />
          <Text style={[currentSize.text, { color: theme.colors.success }]}>
            {message || 'Success!'}
          </Text>
        </>
      );
    }

    if (isError) {
      return (
        <>
          <Ionicons 
            name="close-circle" 
            size={currentSize.icon} 
            color={theme.colors.error} 
          />
          <Text style={[currentSize.text, { color: theme.colors.error }]}>
            {message || 'Failed'}
          </Text>
        </>
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, currentSize.container]}>
      {getContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  containerSmall: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  containerMedium: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  containerLarge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  textSmall: {
    fontSize: theme.fontSize.xs,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  textMedium: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  textLarge: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
  },
});

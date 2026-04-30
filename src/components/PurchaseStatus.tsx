import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
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
  const { theme } = useTheme();
  const styles = makeStyles(theme);

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

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.background,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  containerSmall: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
    gap: t.spacing.xs,
  },
  containerMedium: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    gap: t.spacing.sm,
  },
  containerLarge: {
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    gap: t.spacing.md,
  },
  textSmall: {
    fontSize: t.fontSize.xs,
    fontWeight: '500',
    color: t.colors.textSecondary,
  },
  textMedium: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: t.colors.text,
  },
  textLarge: {
    fontSize: t.fontSize.base,
    fontWeight: '600',
    color: t.colors.text,
  },
});

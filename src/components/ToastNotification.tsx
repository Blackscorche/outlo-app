import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

const { width: screenWidth } = Dimensions.get('window');

export interface ToastNotificationData {
  id: string;
  type: 'message' | 'connection_request' | 'connection_accepted';
  title: string;
  message: string;
  senderName: string;
  senderPhoto?: string;
  duration?: number;
  onPress?: () => void;
  onDismiss?: () => void;
}

interface ToastNotificationProps {
  notification: ToastNotificationData;
  visible: boolean;
  onDismiss: () => void;
}

export default function ToastNotification({
  notification,
  visible,
  onDismiss,
}: ToastNotificationProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide down and fade in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after duration
      const timer = setTimeout(() => {
        handleDismiss();
      }, notification.duration || 4000);

      return () => clearTimeout(timer);
    } else {
      // Reset position for next notification
      translateY.setValue(-100);
      opacity.setValue(0);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
      notification.onDismiss?.();
    });
  };

  const handlePress = () => {
    notification.onPress?.();
    handleDismiss();
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'message':
        return 'chatbubble';
      case 'connection_request':
        return 'person-add';
      case 'connection_accepted':
        return 'checkmark-circle';
      default:
        return 'notifications';
    }
  };

  const getIconColor = () => {
    switch (notification.type) {
      case 'message':
        return theme.colors.primary;
      case 'connection_request':
        return theme.colors.warning;
      case 'connection_accepted':
        return theme.colors.success;
      default:
        return theme.colors.primary;
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.notification}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            {notification.senderPhoto ? (
              <Image
                source={{ uri: notification.senderPhoto }}
                style={styles.senderPhoto}
              />
            ) : (
              <View style={[styles.iconBackground, { backgroundColor: getIconColor() + '20' }]}>
                <Ionicons
                  name={getIcon()}
                  size={20}
                  color={getIconColor()}
                />
              </View>
            )}
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {notification.message}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color={theme.colors.gray[500]} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 9999,
  },
  notification: {
    backgroundColor: 'white',
    borderRadius: theme.borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  iconContainer: {
    marginRight: theme.spacing.md,
  },
  iconBackground: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  message: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  dismissButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
});
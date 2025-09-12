import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// ============ Purchase Loading Modal ============
interface PurchaseLoadingModalProps {
  visible: boolean;
  message?: string;
  price?: string;
  productName?: string;
}

export const PurchaseLoadingModal: React.FC<PurchaseLoadingModalProps> = ({
  visible,
  message = "Processing your purchase...",
  price,
  productName
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Scale in animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Continuous pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.bezier(0.4, 0, 0.6, 1),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.bezier(0.4, 0, 0.6, 1),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Rotate animation for loading indicator
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      scaleAnim.setValue(0);
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [visible]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.loadingContainer,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          {/* Animated Background Circles */}
          <Animated.View 
            style={[
              styles.loadingBackgroundCircle,
              { transform: [{ scale: pulseAnim }, { rotate: spin }] }
            ]}
          />
          
          <View style={styles.loadingContent}>
            {/* Custom Loading Indicator */}
            <View style={styles.loadingIndicatorContainer}>
              <Animated.View style={[styles.loadingRing, { transform: [{ rotate: spin }] }]}>
                <View style={styles.loadingDot} />
                <View style={[styles.loadingDot, styles.loadingDot2]} />
                <View style={[styles.loadingDot, styles.loadingDot3]} />
              </Animated.View>
              
              {/* Center Icon */}
              <View style={styles.loadingCenterIcon}>
                <Ionicons name="card" size={24} color={theme.colors.primary} />
              </View>
            </View>
            
            {/* Title */}
            <Text style={styles.loadingTitle}>Processing Payment</Text>
            
            {/* Price & Product Highlight */}
            {(productName || price) && (
              <View style={styles.loadingPriceContainer}>
                {productName && (
                  <Text style={styles.loadingProductText}>{productName}</Text>
                )}
                {price && (
                  <Text style={styles.loadingPriceText}>{price}</Text>
                )}
              </View>
            )}
            
            {/* Message */}
            <Text style={styles.loadingMessage}>{message}</Text>
            <Animated.Text 
              style={[
                styles.loadingSubtext,
                { opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.1],
                  outputRange: [0.7, 1],
                })}
              ]}
            >
              Please wait...
            </Animated.Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ============ Purchase Success Modal ============
interface PurchaseSuccessModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  price?: string;
  productName?: string;
  onClose: () => void;
}

export const PurchaseSuccessModal: React.FC<PurchaseSuccessModalProps> = ({
  visible,
  title = "Purchase Successful!",
  message = "Your purchase has been completed successfully.",
  price,
  productName,
  onClose,
}) => {
  // No animations - keep it simple

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.successContainer}>
          <View style={styles.successContent}>
            {/* Success Icon - Simple */}
            <View style={styles.successIconContainer}>
              <View style={styles.successIconWrapper}>
                <Ionicons
                  name="checkmark-circle"
                  size={50}
                  color="#00D4AA"
                />
              </View>
            </View>
            
            {/* Title */}
            <Text style={styles.successTitle}>{title}</Text>
            
            {/* Product & Price Highlight - More Prominent */}
            {(productName || price) && (
              <View style={styles.purchaseDetailsContainer}>
                <View style={styles.priceHighlight}>
                  {productName && (
                    <Text style={styles.productNameText}>{productName}</Text>
                  )}
                  {price && (
                    <Text style={styles.priceTextLarge}>{price}</Text>
                  )}
                </View>
              </View>
            )}
            
            {/* Success Message */}
            <Text style={styles.successMessage}>{message}</Text>
            
            {/* Simple Celebration - No Animation */}
            <View style={styles.celebrationContainer}>
              <Text style={styles.emoji}>🎉</Text>
            </View>
            
            {/* Close Button */}
            <TouchableOpacity
              style={styles.successButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============ Purchase Error Modal ============
interface PurchaseErrorModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
  onRetry?: () => void;
}

export const PurchaseErrorModal: React.FC<PurchaseErrorModalProps> = ({
  visible,
  title = "Purchase Failed",
  message = "Something went wrong with your purchase. Please try again.",
  onClose,
  onRetry,
}) => {
  // No animations - keep it simple

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            {/* Error Icon - Simple */}
            <View style={styles.errorIconContainer}>
              <Ionicons
                name="close-circle"
                size={60}
                color={theme.colors.error}
              />
            </View>
            
            {/* Error Message */}
            <Text style={styles.errorTitle}>{title}</Text>
            <Text style={styles.errorMessage}>{message}</Text>
            
            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {onRetry && (
                <TouchableOpacity
                  style={[styles.button, styles.retryButton]}
                  onPress={onRetry}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={18} color="white" />
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.button, styles.closeButton]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============ General Info Modal ============
interface InfoModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'success';
}

export const InfoModal: React.FC<InfoModalProps> = ({
  visible,
  title,
  message,
  onClose,
  onConfirm,
  confirmText = "OK",
  cancelText = "Cancel",
  type = 'info',
}) => {
  // No animations - keep it simple

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return { name: 'warning', color: theme.colors.warning };
      case 'success':
        return { name: 'checkmark-circle', color: theme.colors.success };
      default:
        return { name: 'information-circle', color: theme.colors.primary };
    }
  };

  const icon = getIcon();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.infoContainer}>
          <View style={styles.infoContent}>
            {/* Info Icon */}
            <View style={styles.infoIconContainer}>
              <Ionicons
                name={icon.name as any}
                size={60}
                color={icon.color}
              />
            </View>
            
            {/* Info Message */}
            <Text style={styles.infoTitle}>{title}</Text>
            <Text style={styles.infoMessage}>{message}</Text>
            
            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {onConfirm ? (
                <>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={onClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelButtonText}>{cancelText}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.confirmButton]}
                    onPress={onConfirm}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmButtonText}>{confirmText}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.singleButton]}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.singleButtonText}>{confirmText}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },

  // Loading Modal Styles - Compact  
  loadingContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: theme.spacing.md,
    margin: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 15,
    minWidth: 260,
    maxWidth: screenWidth - 60,
    position: 'relative',
    overflow: 'hidden',
  },
  loadingBackgroundCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: theme.colors.primary,
    opacity: 0.03,
    top: -30,
    right: -30,
  },
  loadingContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  loadingIndicatorContainer: {
    position: 'relative',
    width: 60,
    height: 60,
    marginBottom: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingRing: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: theme.colors.primary,
    borderRightColor: theme.colors.primary + '60',
  },
  loadingDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    top: -3,
    left: 22,
  },
  loadingDot2: {
    transform: [{ rotate: '120deg' }],
    backgroundColor: theme.colors.primary + '80',
  },
  loadingDot3: {
    transform: [{ rotate: '240deg' }],
    backgroundColor: theme.colors.primary + '60',
  },
  loadingCenterIcon: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  loadingTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  loadingPriceContainer: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingProductText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 1,
  },
  loadingPriceText: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: '900',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  loadingSubtext: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[500],
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Success Modal Styles - Compact
  successContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: theme.spacing.md,
    margin: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 15,
    minWidth: 280,
    maxWidth: screenWidth - 60,
  },
  successContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  successIconContainer: {
    marginBottom: theme.spacing.sm,
  },
  successIconWrapper: {
    backgroundColor: '#00D4AA' + '20',
    borderRadius: 30,
    padding: 6,
  },
  successTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  purchaseDetailsContainer: {
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  priceHighlight: {
    backgroundColor: '#00D4AA',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  productNameText: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 2,
  },
  priceText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
  },
  priceTextLarge: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: '900',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  successMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 20,
    paddingHorizontal: theme.spacing.sm,
  },
  celebrationContainer: {
    marginBottom: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 24,
    textAlign: 'center',
  },
  successButton: {
    backgroundColor: '#00D4AA',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minWidth: 100,
  },
  successButtonText: {
    color: 'white',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Error Modal Styles - Compact
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: theme.spacing.md,
    margin: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 15,
    minWidth: 280,
    maxWidth: screenWidth - 60,
    borderWidth: 1,
    borderColor: theme.colors.error + '20',
  },
  errorContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  errorIconContainer: {
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.error + '10',
    borderRadius: 35,
    padding: theme.spacing.sm,
  },
  errorTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.error,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 20,
    paddingHorizontal: theme.spacing.xs,
  },

  // Info Modal Styles - Compact
  infoContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: theme.spacing.md,
    margin: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 15,
    minWidth: 260,
    maxWidth: screenWidth - 60,
  },
  infoContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  infoIconContainer: {
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.primary + '10',
    borderRadius: 30,
    padding: theme.spacing.sm,
  },
  infoTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  infoMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 20,
    paddingHorizontal: theme.spacing.xs,
  },

  // Button Styles
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    minWidth: 100,
    flex: 1,
    marginHorizontal: theme.spacing.xs,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    marginLeft: theme.spacing.xs,
  },
  closeButton: {
    backgroundColor: theme.colors.gray[100],
  },
  closeButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.gray[100],
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    textAlign: 'center',
  },
  singleButton: {
    backgroundColor: theme.colors.primary,
  },
  singleButtonText: {
    color: 'white',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    textAlign: 'center',
  },
});

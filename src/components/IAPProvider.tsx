import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useLoveMapIAP } from '../services/iapService';
import subscriptionService from '../services/subscriptionService';
import { supabase } from '../integrations/supabase/client';

// Create context for IAP functionality
const IAPContext = createContext<ReturnType<typeof useLoveMapIAP> | null>(null);

interface IAPProviderProps {
  children: ReactNode;
}

// Provider component that wraps your app
export const IAPProvider: React.FC<IAPProviderProps> = ({ children }) => {
  const iapHook = useLoveMapIAP();

  // Load products when connected
  useEffect(() => {
    if (iapHook.connected) {
      console.log('IAP connected, loading products...');
      iapHook.loadProducts();
    }
  }, [iapHook.connected]);

  // Validate subscription on app state changes (foreground/background)
  useEffect(() => {
    const validateSubscriptionOnAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && iapHook.connected) {
        console.log('🔄 App became active, validating subscription...');

        try {
          // Check if user is authenticated before making network calls
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          if (authError) {
            console.log('⚠️ Auth error during validation, skipping:', authError.message);
            return;
          }
          if (!user) {
            console.log('ℹ️ No user logged in, skipping subscription validation');
            return;
          }

          // Method 1: Comprehensive validation with database + IAP
          let validationResult;
          try {
            validationResult = await iapHook.checkSubscriptionStatusWithIAP();
            console.log('📊 Subscription validation result:', validationResult);
          } catch (iapError) {
            console.warn('⚠️ IAP validation failed (network may be unavailable):', iapError);
            // Continue with database-only validation
            validationResult = { shouldUpdate: false };
          }

          if (validationResult.shouldUpdate) {
            if (validationResult.reason === 'unreflected_iap_subscription') {
              console.log('⬆️ Processing unreflected subscription...');
              await iapHook.processPendingPurchases();
            } else if (validationResult.reason === 'no_active_iap_subscription') {
              console.log('⬇️ Downgrading subscription...');
              await subscriptionService.validateAndSyncSubscription(user.id);
            }
          }

          // Method 2: Also run database-only validation for expiry checks
          try {
            await subscriptionService.validateAndSyncSubscription(user.id);
          } catch (dbError) {
            console.warn('⚠️ Database validation failed:', dbError);
          }

        } catch (error) {
          console.error('❌ Error validating subscription on app state change:', error);
          // Don't throw - let app continue even if validation fails
        }
      }
    };

    const subscription = AppState.addEventListener('change', validateSubscriptionOnAppStateChange);

    // Also run validation on initial mount (with delay to allow network to stabilize)
    const initialValidationTimeout = setTimeout(() => {
      validateSubscriptionOnAppStateChange('active');
    }, 2000); // 2 second delay for network stabilization

    return () => {
      subscription?.remove();
      clearTimeout(initialValidationTimeout);
    };
  }, [iapHook.connected]);

  return (
    <IAPContext.Provider value={iapHook}>
      {children}
    </IAPContext.Provider>
  );
};

// Hook to use IAP context in any component
export const useIAP = () => {
  const context = useContext(IAPContext);
  if (!context) {
    throw new Error('useIAP must be used within an IAPProvider');
  }
  return context;
};

// Export for backward compatibility
export default IAPProvider;
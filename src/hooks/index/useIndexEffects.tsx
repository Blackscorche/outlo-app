
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { User } from '@supabase/supabase-js';

interface UseIndexEffectsProps {
  user: User | null;
  isInitializing: boolean;
  locationEnabled: boolean;
  setLocationEnabled: (enabled: boolean) => void;
}

export const useIndexEffects = ({
  user,
  isInitializing,
  locationEnabled,
  setLocationEnabled
}: UseIndexEffectsProps) => {
  const { toast } = useToast();
  const { requestPermission, isSupported } = usePushNotifications();

  // 30-minute timeout effect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (locationEnabled) {
      timeoutId = setTimeout(() => {
        console.log('30 minutes elapsed, turning off location');
        setLocationEnabled(false);
        toast({
          title: "Location sharing turned off",
          description: "Your location sharing has been automatically disabled after 30 minutes",
        });
      }, 30 * 60 * 1000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [locationEnabled, setLocationEnabled, toast]);

  // Push notifications effect
  useEffect(() => {
    if (isSupported && user && !isInitializing) {
      requestPermission().then(granted => {
        if (granted) {
          console.log('Push notifications enabled for main app');
        }
      }).catch(error => {
        console.error('Error requesting push notification permission:', error);
      });
    }
  }, [requestPermission, isSupported, user, isInitializing]);
};

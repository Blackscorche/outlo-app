
import { useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { updateUserLocation, setUserOffline } from '@/utils/locationUpdates';

interface UseLocationIntervalProps {
  user: User | null;
  locationEnabled: boolean;
  userLocation: { lat: number; lng: number };
}

export const useLocationInterval = ({
  user,
  locationEnabled,
  userLocation
}: UseLocationIntervalProps) => {
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || !locationEnabled) {
      // Clear both intervals when location is disabled or user is not available
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      if (timeoutCheckIntervalRef.current) {
        clearInterval(timeoutCheckIntervalRef.current);
        timeoutCheckIntervalRef.current = null;
      }
      return;
    }

    // Update user location more frequently for better precision
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
    }
    
    locationIntervalRef.current = setInterval(async () => {
      // Check if app has been backgrounded for more than 15 minutes
      const backgroundedAt = localStorage.getItem('appBackgroundedAt');
      if (backgroundedAt) {
        const backgroundTime = parseInt(backgroundedAt);
        const now = Date.now();
        const fifteenMinutes = 15 * 60 * 1000;
        
        if (now - backgroundTime >= fifteenMinutes) {
          console.log('15 minutes passed during location update, setting user offline');
          await setUserOffline(user.id);
          localStorage.removeItem('appBackgroundedAt');
          return;
        }
      }
      
      // Update location only if user hasn't been backgrounded for too long
      await updateUserLocation(user.id, userLocation);
    }, 10000); // Reduced to 10 seconds for more frequent updates

    // More frequent timeout checking for better responsiveness
    if (timeoutCheckIntervalRef.current) {
      clearInterval(timeoutCheckIntervalRef.current);
    }

    timeoutCheckIntervalRef.current = setInterval(async () => {
      const backgroundedAt = localStorage.getItem('appBackgroundedAt');
      if (backgroundedAt) {
        const backgroundTime = parseInt(backgroundedAt);
        const now = Date.now();
        const fifteenMinutes = 15 * 60 * 1000;
        
        if (now - backgroundTime >= fifteenMinutes) {
          console.log('15 minutes timeout reached, setting user offline and clearing location');
          await setUserOffline(user.id);
          localStorage.removeItem('appBackgroundedAt');
          
          // Clear the location update interval since user is now offline
          if (locationIntervalRef.current) {
            clearInterval(locationIntervalRef.current);
            locationIntervalRef.current = null;
          }
        }
      }
    }, 30000); // Check every 30 seconds for better responsiveness

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      if (timeoutCheckIntervalRef.current) {
        clearInterval(timeoutCheckIntervalRef.current);
        timeoutCheckIntervalRef.current = null;
      }
    };
  }, [user?.id, locationEnabled, userLocation]);

  return { locationIntervalRef, timeoutCheckIntervalRef };
};

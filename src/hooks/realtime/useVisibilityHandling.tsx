
import { useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { setUserOffline } from '@/utils/locationUpdates';

interface UseVisibilityHandlingProps {
  user: User | null;
}

export const useVisibilityHandling = ({ user }: UseVisibilityHandlingProps) => {
  useEffect(() => {
    if (!user) return;

    // Handle page visibility changes for faster response
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🔍 App backgrounded, storing timestamp');
        localStorage.setItem('appBackgroundedAt', Date.now().toString());
      } else {
        console.log('🔍 App foregrounded, removing background timestamp');
        localStorage.removeItem('appBackgroundedAt');
        
        // Trigger immediate location update when app comes back to foreground
        // This ensures faster visibility when users return to the app
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('🔍 Got fresh location on foreground:', {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              });
            },
            (error) => {
              console.log('🔍 Could not get fresh location on foreground:', error);
            },
            { 
              enableHighAccuracy: false, 
              timeout: 5000,
              maximumAge: 30000 // Accept cached location up to 30 seconds old
            }
          );
        }
      }
    };

    // Handle beforeunload for immediate cleanup
    const handleBeforeUnload = async () => {
      console.log('🔍 App closing, setting user offline immediately');
      // Use sendBeacon for immediate cleanup without waiting
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/user-offline', JSON.stringify({ userId: user.id }));
      } else {
        // Fallback for immediate offline status
        await setUserOffline(user.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user?.id]);
};

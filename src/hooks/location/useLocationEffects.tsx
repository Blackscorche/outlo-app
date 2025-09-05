
import { useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { 
  updateLocationInDatabase, 
  getCurrentLocation, 
  setUserOfflineImmediately
} from '@/utils/locationHelpers';
import { getHighPrecisionLocation } from '@/utils/distanceCalculation';
import { useMobileLocationEffects } from './useMobileLocationEffects';

interface UseLocationEffectsProps {
  user: User | null;
  locationEnabled: boolean;
  isVisible: boolean;
  hasRealLocation: boolean;
  userLocation: { lat: number; lng: number };
  setUserLocation: (location: { lat: number; lng: number }) => void;
  setHasRealLocation: (hasReal: boolean) => void;
  setLocationEnabled: (enabled: boolean) => void;
  onBearingUpdate?: (bearing: number) => void;
}

// Check if we're running in a mobile app (Capacitor)
const isMobileApp = () => {
  return !!(window as any).Capacitor;
};

export const useLocationEffects = ({
  user,
  locationEnabled,
  isVisible,
  hasRealLocation,
  userLocation,
  setUserLocation,
  setHasRealLocation,
  setLocationEnabled,
  onBearingUpdate
}: UseLocationEffectsProps) => {
  
  // Use mobile location effects if we're in a mobile app
  useMobileLocationEffects({
    user,
    locationEnabled: locationEnabled && isMobileApp(),
    isVisible,
    userLocation,
    setUserLocation,
    setHasRealLocation,
    onBearingUpdate
  });

  // Save location preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('locationSharingEnabled', locationEnabled.toString());
  }, [locationEnabled]);

  // Handle app visibility changes for web browsers
  useEffect(() => {
    if (!user || isMobileApp()) return;

    const handleVisibilityChange = () => {
      console.log('🔍 Web app visibility changed:', document.visibilityState);
      
      if (document.visibilityState === 'hidden') {
        console.log('🔍 Web app backgrounded, user will remain visible for 15 minutes');
        localStorage.setItem('appBackgroundedAt', Date.now().toString());
      } else if (document.visibilityState === 'visible' && locationEnabled) {
        console.log('🔍 Web app foregrounded, clearing background timer');
        localStorage.removeItem('appBackgroundedAt');
        
        // Get high precision location when app comes back to foreground
        getHighPrecisionLocation()
          .then((locationData) => {
            console.log('🔍 Updated high precision location on foreground:', locationData);
            setUserLocation({ lat: locationData.lat, lng: locationData.lng });
            setHasRealLocation(true);
            
            if (isVisible) {
              updateLocationInDatabase(user.id, locationData.lat, locationData.lng, true);
            }
          })
          .catch((error) => {
            console.log('🔍 Could not get high precision location, trying standard:', error);
            getCurrentLocation()
              .then((newLocation) => {
                console.log('🔍 Standard location fallback:', newLocation);
                setUserLocation(newLocation);
                setHasRealLocation(true);
                
                if (isVisible) {
                  updateLocationInDatabase(user.id, newLocation.lat, newLocation.lng, true);
                }
              })
              .catch((fallbackError) => {
                console.log('🔍 Could not get any location on foreground:', fallbackError);
                if (isVisible) {
                  updateLocationInDatabase(user.id, userLocation.lat, userLocation.lng, true);
                }
              });
          });
      }
    };

    const handleBeforeUnload = () => {
      console.log('🔍 Web app being closed, starting 15-minute countdown');
      localStorage.setItem('appBackgroundedAt', Date.now().toString());
    };

    const handlePageHide = () => {
      console.log('🔍 Web page hidden, starting 15-minute countdown');
      localStorage.setItem('appBackgroundedAt', Date.now().toString());
    };

    // Only add web-specific event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [user, locationEnabled, isVisible, userLocation]);

  // Get high precision location for web browsers
  useEffect(() => {
    if (!user || isMobileApp()) return;

    if (locationEnabled) {
      console.log('Location enabled, getting high precision location for user:', user.id);
      
      localStorage.removeItem('appBackgroundedAt');
      
      getHighPrecisionLocation()
        .then((locationData) => {
          console.log('Successfully got high precision location:', locationData, 'accuracy:', locationData.accuracy + 'm');
          setUserLocation({ lat: locationData.lat, lng: locationData.lng });
          setHasRealLocation(true);
          
          if (isVisible) {
            updateLocationInDatabase(user.id, locationData.lat, locationData.lng, true);
          }
        })
        .catch((error) => {
          console.log('Could not get high precision location, trying standard:', error);
          getCurrentLocation()
            .then((newLocation) => {
              console.log('Standard location fallback successful:', newLocation);
              setUserLocation(newLocation);
              setHasRealLocation(true);
              
              if (isVisible) {
                updateLocationInDatabase(user.id, newLocation.lat, newLocation.lng, true);
              }
            })
            .catch((fallbackError) => {
              console.log('Could not get any location, using default:', fallbackError);
              setHasRealLocation(false);
              
              if (isVisible) {
                updateLocationInDatabase(user.id, userLocation.lat, userLocation.lng, true);
              }
            });
        });
    } else {
      console.log('Location disabled, setting user offline immediately');
      setUserOfflineImmediately(user.id);
      setHasRealLocation(false);
      localStorage.removeItem('appBackgroundedAt');
    }
  }, [locationEnabled, user, isVisible]);

  // Watch for location changes in web browsers
  useEffect(() => {
    if (!locationEnabled || !user || !isVisible || !hasRealLocation || isMobileApp()) return;

    let watchId: number | null = null;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('🔍 Web location updated via watch (accuracy: ' + position.coords.accuracy + 'm):', newLocation);
          setUserLocation(newLocation);
          updateLocationInDatabase(user.id, newLocation.lat, newLocation.lng, true);
        },
        (error) => {
          console.log('Error watching web location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 0
        }
      );
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [user, locationEnabled, isVisible, hasRealLocation]);
};

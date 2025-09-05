
import { useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { mobileLocationService } from '@/services/mobileLocationService';
import { updateLocationInDatabase } from '@/utils/locationHelpers';

interface UseMobileLocationEffectsProps {
  user: User | null;
  locationEnabled: boolean;
  isVisible: boolean;
  userLocation: { lat: number; lng: number };
  setUserLocation: (location: { lat: number; lng: number }) => void;
  setHasRealLocation: (hasReal: boolean) => void;
  onBearingUpdate?: (bearing: number) => void;
}

export const useMobileLocationEffects = ({
  user,
  locationEnabled,
  isVisible,
  userLocation,
  setUserLocation,
  setHasRealLocation,
  onBearingUpdate
}: UseMobileLocationEffectsProps) => {
  const isInitialized = useRef(false);

  // Initialize mobile location service
  useEffect(() => {
    if (!isInitialized.current) {
      mobileLocationService.initialize().catch(console.error);
      isInitialized.current = true;
    }
  }, []);

  // Handle location tracking
  useEffect(() => {
    if (!user || !locationEnabled || !isVisible) {
      mobileLocationService.stopWatching();
      return;
    }

    const handleLocationUpdate = (locationData: { lat: number; lng: number; accuracy: number; bearing?: number }) => {
      console.log('🔍 Mobile location update:', locationData);
      setUserLocation({ lat: locationData.lat, lng: locationData.lng });
      setHasRealLocation(true);
      
      // Update compass bearing if available and compass is enabled
      if (locationData.bearing !== undefined && onBearingUpdate && mobileLocationService.isCompassEnabled()) {
        onBearingUpdate(locationData.bearing);
      }
      
      // Update database with throttling based on app state
      const isBackground = mobileLocationService.isInBackground();
      const isOnline = mobileLocationService.isOnline();
      
      if (isOnline) {
        updateLocationInDatabase(user.id, locationData.lat, locationData.lng, !isBackground);
      }
    };

    const handleLocationError = (error: string) => {
      console.error('🔍 Mobile location error:', error);
      setHasRealLocation(false);
    };

    // Get initial location
    mobileLocationService.getCurrentLocation()
      .then(handleLocationUpdate)
      .catch(handleLocationError);

    // Start watching location changes
    mobileLocationService.startWatching(handleLocationUpdate, handleLocationError);

    return () => {
      mobileLocationService.stopWatching();
    };
  }, [user, locationEnabled, isVisible, setUserLocation, setHasRealLocation, onBearingUpdate]);

  // Handle compass toggle
  useEffect(() => {
    if (onBearingUpdate) {
      mobileLocationService.enableCompass(true);
    } else {
      mobileLocationService.enableCompass(false);
    }
  }, [onBearingUpdate]);
};

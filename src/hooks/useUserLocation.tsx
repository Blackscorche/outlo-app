
import { useAuth } from '@/hooks/useAuth';
import { useLocationState } from '@/hooks/location/useLocationState';
import { useLocationEffects } from '@/hooks/location/useLocationEffects';

export const useUserLocation = (onBearingUpdate?: (bearing: number) => void) => {
  const { user } = useAuth();
  const {
    userLocation,
    setUserLocation,
    hasRealLocation,
    setHasRealLocation,
    isVisible,
    setIsVisible,
    locationEnabled,
    setLocationEnabled
  } = useLocationState();

  useLocationEffects({
    user,
    locationEnabled,
    isVisible,
    hasRealLocation,
    userLocation,
    setUserLocation,
    setHasRealLocation,
    setLocationEnabled,
    onBearingUpdate
  });

  return { 
    userLocation, 
    hasRealLocation,
    isVisible, 
    setIsVisible, 
    locationEnabled, 
    setLocationEnabled 
  };
};

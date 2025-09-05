
import { useState } from 'react';

export const useLocationState = () => {
  // Start with a default location but mark it as not real
  const [userLocation, setUserLocation] = useState({ lat: 40.7128, lng: -74.0060 });
  const [hasRealLocation, setHasRealLocation] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  // Check localStorage for saved preference, default to false for new users
  const [locationEnabled, setLocationEnabled] = useState(() => {
    const saved = localStorage.getItem('locationSharingEnabled');
    // If no saved preference exists, default to false (location off)
    return saved !== null ? saved === 'true' : false;
  });

  return {
    userLocation,
    setUserLocation,
    hasRealLocation,
    setHasRealLocation,
    isVisible,
    setIsVisible,
    locationEnabled,
    setLocationEnabled
  };
};

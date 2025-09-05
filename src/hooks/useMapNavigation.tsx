
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const useMapNavigation = () => {
  const navigate = useNavigate();

  const navigateToLocation = useCallback((lat: number, lng: number, placeName: string) => {
    // Store the target location in sessionStorage so it can be accessed by the map
    sessionStorage.setItem('navigateToLocation', JSON.stringify({
      lat,
      lng,
      placeName,
      timestamp: Date.now()
    }));

    // Navigate to the main map page
    navigate('/', { 
      state: { 
        focusLocation: { lat, lng, placeName }
      }
    });
  }, [navigate]);

  const getNavigationTarget = useCallback(() => {
    const stored = sessionStorage.getItem('navigateToLocation');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Clear the stored navigation after retrieving it
        sessionStorage.removeItem('navigateToLocation');
        return parsed;
      } catch (error) {
        console.error('Error parsing navigation target:', error);
        sessionStorage.removeItem('navigateToLocation');
      }
    }
    return null;
  }, []);

  return {
    navigateToLocation,
    getNavigationTarget
  };
};

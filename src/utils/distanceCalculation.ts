
/**
 * Calculate distance between two coordinates using Haversine formula with maximum precision
 */
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  // Use more precise Earth radius in meters
  const R = 6371000; // Earth's radius in meters for maximum precision
  
  // Convert degrees to radians with maximum precision
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  // Haversine formula with high precision
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceMeters = R * c; // Distance in meters with high precision
  const distanceKm = distanceMeters / 1000; // Convert to kilometers
  
  // Return distance in kilometers with high precision
  if (distanceKm < 0.001) {
    // For very short distances (under 1m), return with meter precision
    return Math.round(distanceMeters) / 1000;
  } else if (distanceKm < 0.01) {
    // For distances under 10m, return with 1m precision
    return Math.round(distanceMeters) / 1000;
  } else if (distanceKm < 0.1) {
    // For distances under 100m, return with 5m precision
    return Math.round(distanceMeters / 5) * 5 / 1000;
  } else if (distanceKm < 1) {
    // For distances under 1km, return with 10m precision
    return Math.round(distanceMeters / 10) * 10 / 1000;
  } else if (distanceKm < 10) {
    // For distances under 10km, return with 50m precision
    return Math.round(distanceKm * 20) / 20;
  } else {
    // For longer distances, return with 100m precision
    return Math.round(distanceKm * 10) / 10;
  }
};

/**
 * Format distance for display with high precision and appropriate units
 */
export const formatDistance = (distanceKm: number): string => {
  const distanceMeters = distanceKm * 1000;
  
  if (distanceKm < 0.001) {
    // Less than 1 meter
    return `${Math.round(distanceMeters)}m`;
  } else if (distanceKm < 0.01) {
    // 1-10 meters
    return `${Math.round(distanceMeters)}m`;
  } else if (distanceKm < 0.1) {
    // 10-100 meters  
    return `${Math.round(distanceMeters / 5) * 5}m`;
  } else if (distanceKm < 1) {
    // 100m - 1km
    return `${Math.round(distanceMeters / 10) * 10}m`;
  } else if (distanceKm < 10) {
    // 1-10 km
    return `${(distanceKm).toFixed(1)} km`;
  } else {
    // Over 10 km
    return `${Math.round(distanceKm)} km`;
  }
};

/**
 * Get high-precision current location
 */
export const getHighPrecisionLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds timeout
        maximumAge: 0 // No cached location, always get fresh
      }
    );
  });
};

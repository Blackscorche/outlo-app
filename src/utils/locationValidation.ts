
/**
 * Utility functions for validating and handling location data
 */

export const DEFAULT_NYC_COORDINATES = {
  lat: 40.7128,
  lng: -74.006
} as const;

/**
 * Check if coordinates are the default New York coordinates
 */
export const isDefaultLocation = (lat: number, lng: number): boolean => {
  const tolerance = 0.001; // About 100 meters
  return (
    Math.abs(lat - DEFAULT_NYC_COORDINATES.lat) < tolerance &&
    Math.abs(lng - DEFAULT_NYC_COORDINATES.lng) < tolerance
  );
};

/**
 * Check if coordinates are valid (not null, not NaN, within valid ranges)
 */
export const isValidCoordinates = (lat?: number | null, lng?: number | null): boolean => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return false;
  }
  
  if (isNaN(lat) || isNaN(lng)) {
    return false;
  }
  
  // Check if coordinates are within valid Earth bounds
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }
  
  return true;
};

/**
 * Check if user has a real, non-default location
 */
export const hasRealLocation = (lat?: number | null, lng?: number | null): boolean => {
  if (!isValidCoordinates(lat, lng)) {
    return false;
  }
  
  return !isDefaultLocation(lat!, lng!);
};

/**
 * Log location validation details for debugging
 */
export const logLocationValidation = (
  userName: string, 
  lat?: number | null, 
  lng?: number | null
): void => {
  console.log(`🗺️ Location validation for ${userName}:`, {
    coordinates: { lat, lng },
    isValid: isValidCoordinates(lat, lng),
    isDefault: lat && lng ? isDefaultLocation(lat, lng) : false,
    hasReal: hasRealLocation(lat, lng)
  });
};

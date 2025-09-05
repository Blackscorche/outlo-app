
import { calculateDistance } from './distanceCalculation';
import { User } from '@/types';

export const transformProfileToUser = (profile: any, userLocation: { lat: number; lng: number }): User => {
  console.log('🔍 Transforming profile:', {
    name: profile.name,
    id: profile.id,
    isOnline: profile.is_online,
    lastSeen: profile.last_seen,
    currentLat: profile.current_latitude,
    currentLng: profile.current_longitude
  });

  const hasRealLocation = profile.current_latitude !== null && 
                         profile.current_longitude !== null &&
                         typeof profile.current_latitude === 'number' &&
                         typeof profile.current_longitude === 'number';

  let distance = 0;
  if (hasRealLocation) {
    distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      parseFloat(profile.current_latitude),
      parseFloat(profile.current_longitude)
    );
  }

  const transformedUser: User = {
    id: profile.id,
    name: profile.name || 'Unknown',
    age: profile.age || 0,
    bio: profile.bio || '',
    photos: profile.photos || [],
    interests: profile.interests || [],
    location: hasRealLocation ? {
      lat: parseFloat(profile.current_latitude),
      lng: parseFloat(profile.current_longitude)
    } : { lat: 0, lng: 0 },
    distance,
    isOnline: profile.is_online || false,
    gender: profile.gender || 'other',
    lookingFor: profile.looking_for || 'everyone',
    occupation: profile.occupation || '',
    education: profile.education || '',
    maxDistance: profile.max_distance || 25,
    ageRangeMin: profile.age_range_min || 18,
    ageRangeMax: profile.age_range_max || 35,
    hasRealLocation,
    lastSeen: profile.last_seen ? new Date(profile.last_seen) : undefined
  };

  console.log('🔍 Transformed user:', {
    name: transformedUser.name,
    id: transformedUser.id,
    isOnline: transformedUser.isOnline,
    lastSeen: transformedUser.lastSeen?.toISOString(),
    hasRealLocation: transformedUser.hasRealLocation,
    distance: transformedUser.distance
  });

  return transformedUser;
};

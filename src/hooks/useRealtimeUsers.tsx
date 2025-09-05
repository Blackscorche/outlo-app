
import { useState, useEffect } from 'react';
import { User } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useBlocking } from '@/hooks/useBlocking';
import { transformProfileToUser } from '@/utils/userTransformation';
import { setUserOnline, setUserOffline } from '@/utils/locationUpdates';
import { useRealtimeSubscription } from '@/hooks/realtime/useRealtimeSubscription';
import { useLocationInterval } from '@/hooks/realtime/useLocationInterval';
import { useVisibilityHandling } from '@/hooks/realtime/useVisibilityHandling';

export const useRealtimeUsers = (userLocation: { lat: number; lng: number }, locationEnabled: boolean) => {
  const [realtimeUsers, setRealtimeUsers] = useState<User[]>([]);
  const { user } = useAuth();
  const { filterBlockedUsers } = useBlocking();

  // Use the visibility handling hook
  useVisibilityHandling({ user });

  // Use the location interval hook
  useLocationInterval({ user, locationEnabled, userLocation });

  // Use the realtime subscription hook
  useRealtimeSubscription({
    user,
    locationEnabled,
    userLocation,
    onUsersUpdate: (users) => {
      // Apply blocking filter and update state
      const filteredUsers = filterBlockedUsers(users);
      setRealtimeUsers(filteredUsers);
    }
  });

  useEffect(() => {
    // Clear any existing state when dependencies change
    if (!user || !locationEnabled) {
      console.log('🔍 useRealtimeUsers: No user or location disabled, clearing users');
      setRealtimeUsers([]);
      
      // Set user offline if they were online
      if (user && !locationEnabled) {
        setUserOffline(user.id);
      }
      
      return;
    }

    console.log('🔍 Setting up real-time user tracking for user:', user.id);

    // Set current user as online
    setUserOnline(user.id, userLocation);

    // Cleanup function
    return () => {
      console.log('🔍 Cleaning up real-time subscriptions');
      
      // Set user offline when component unmounts or location is disabled
      if (user) {
        setUserOffline(user.id);
      }
    };
  }, [user?.id, locationEnabled]);

  // Separate effect for location updates to avoid recreating subscriptions
  useEffect(() => {
    if (user && locationEnabled && realtimeUsers.length > 0) {
      // Update existing users with new distances when location changes
      const updatedUsers = realtimeUsers
        .map(u => 
          transformProfileToUser({
            id: u.id,
            name: u.name,
            age: u.age,
            bio: u.bio,
            photos: u.photos,
            interests: u.interests,
            current_latitude: u.location.lat,
            current_longitude: u.location.lng,
            is_online: u.isOnline,
            last_seen: new Date().toISOString(), // Keep them visible
            gender: u.gender,
            looking_for: u.lookingFor,
            occupation: u.occupation,
            education: u.education,
            max_distance: u.maxDistance,
            age_range_min: u.ageRangeMin,
            age_range_max: u.ageRangeMax,
            show_on_map: true
          }, userLocation)
        )
        .filter(user => user.hasRealLocation);
      
      // Apply bidirectional blocking filter after location updates
      const filteredUsers = filterBlockedUsers(updatedUsers);
      setRealtimeUsers(filteredUsers);
    }
  }, [userLocation.lat, userLocation.lng, filterBlockedUsers]);

  // Return all users - they are already filtered for 15-minute activity in the subscription
  return realtimeUsers;
};

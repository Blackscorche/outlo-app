import { useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { transformProfileToUser } from '@/utils/userTransformation';
import { User as AppUser } from '@/types';

interface UseRealtimeSubscriptionProps {
  user: User | null;
  locationEnabled: boolean;
  userLocation: { lat: number; lng: number };
  onUsersUpdate: (users: AppUser[]) => void;
}

export const useRealtimeSubscription = ({
  user,
  locationEnabled,
  userLocation,
  onUsersUpdate
}: UseRealtimeSubscriptionProps) => {
  const subscriptionRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user || !locationEnabled) {
      // Clean up subscription when location is disabled or user is not available
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      onUsersUpdate([]);
      return;
    }

    console.log('🔍 Setting up real-time subscription for nearby users');

    const fetchNearbyUsers = async () => {
      try {
        // Calculate 15 minutes ago
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const fifteenMinutesAgoISO = fifteenMinutesAgo.toISOString();
        
        console.log('🔍 Fetching users - Current time:', new Date().toISOString());
        console.log('🔍 Fifteen minutes ago:', fifteenMinutesAgoISO);
        
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', user.id)
          .not('current_latitude', 'is', null)
          .not('current_longitude', 'is', null)
          .eq('show_on_map', true)
          .order('location_updated_at', { ascending: false });

        if (error) {
          console.error('Error fetching nearby users:', error);
          return;
        }

        if (!profiles) return;

        console.log('🔍 All profiles from DB:', profiles.length);

        // Apply strict 15-minute filtering
        const activeProfiles = profiles.filter(profile => {
          const isOnline = profile.is_online === true;
          const lastSeenDate = profile.last_seen ? new Date(profile.last_seen) : new Date(0);
          const isRecentlyActive = lastSeenDate > fifteenMinutesAgo;
          
          console.log(`🔍 Profile ${profile.name} (${profile.id}):`, {
            isOnline,
            lastSeen: profile.last_seen,
            lastSeenDate: lastSeenDate.toISOString(),
            isRecentlyActive,
            shouldKeep: isOnline || isRecentlyActive
          });
          
          // Keep user if they're online OR if they were last seen within 15 minutes
          return isOnline || isRecentlyActive;
        });

        console.log('🔍 Active profiles after filtering:', activeProfiles.length);

        const nearbyUsers = activeProfiles
          .map(profile => transformProfileToUser(profile, userLocation))
          .filter(u => u.hasRealLocation) // Only users with real locations
          .sort((a, b) => (a.distance || 0) - (b.distance || 0)); // Sort by distance

        console.log('🔍 Final nearby users count:', nearbyUsers.length);
        console.log('🔍 Users being shown:', nearbyUsers.map(u => ({ name: u.name, id: u.id, isOnline: u.isOnline })));
        
        onUsersUpdate(nearbyUsers);
      } catch (error) {
        console.error('Error in fetchNearbyUsers:', error);
      }
    };

    // Initial fetch
    fetchNearbyUsers();

    // Set up real-time subscription for profile changes
    subscriptionRef.current = supabase
      .channel('profiles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          const profileId = payload.new && typeof payload.new === 'object' && 'id' in payload.new 
            ? payload.new.id 
            : 'unknown';
          console.log('🔍 Profile change detected:', payload.eventType, profileId);
          fetchNearbyUsers(); // Refetch when any profile changes
        }
      )
      .subscribe((status) => {
        console.log('🔍 Profiles subscription status:', status);
      });

    // Set up periodic refresh every 30 seconds to catch users who should be filtered out
    const intervalId = setInterval(() => {
      console.log('🔍 Periodic refresh of nearby users');
      fetchNearbyUsers();
    }, 30000);

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clearInterval(intervalId);
      console.log('🔍 Cleaned up real-time subscriptions');
    };
  }, [user?.id, locationEnabled, userLocation.lat, userLocation.lng]);
};

import { supabase } from '@/integrations/supabase/client';

/**
 * Update user's online status and location in the database
 */
export const setUserOnline = async (
  userId: string, 
  userLocation: { lat: number; lng: number }
): Promise<void> => {
  // First check if user wants to be visible
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_visible')
    .eq('id', userId)
    .single();
    
  const showOnMap = profile?.is_visible !== false;
  
  const { error } = await supabase
    .from('profiles')
    .update({ 
      is_online: true,
      last_seen: new Date().toISOString(),
      current_latitude: userLocation.lat,
      current_longitude: userLocation.lng,
      location_updated_at: new Date().toISOString(),
      show_on_map: showOnMap // Respect user's visibility preference
    })
    .eq('id', userId);

  if (error) {
    console.error('Error setting user online:', error);
  } else {
    console.log('🔍 User set online with location update');
    // Trigger a manual refresh event to notify other components
    window.dispatchEvent(new CustomEvent('userOnlineStatusChanged', {
      detail: { userId, isOnline: true }
    }));
  }
};

/**
 * Set user offline but keep them visible for 15 minutes
 */
export const setUserOffline = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ 
      is_online: false, 
      last_seen: new Date().toISOString(), // Update last_seen to current time
      location_updated_at: new Date().toISOString(),
      // Keep show_on_map true and location coordinates so user remains visible for 15 minutes
      // The filtering logic will handle removing them after 15 minutes of inactivity
    })
    .eq('id', userId);

  if (error) {
    console.error('Error setting user offline:', error);
  } else {
    console.log('🔍 User set offline but will remain visible for 15 minutes');
    // Trigger a manual refresh event to notify other components
    window.dispatchEvent(new CustomEvent('userOnlineStatusChanged', {
      detail: { userId, isOnline: false }
    }));
  }
};

/**
 * Update user location periodically with optimized frequency
 */
export const updateUserLocation = async (
  userId: string,
  userLocation: { lat: number; lng: number }
): Promise<void> => {
  // First check if user wants to be visible
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_visible')
    .eq('id', userId)
    .single();
    
  const showOnMap = profile?.is_visible !== false;
  
  const { error } = await supabase
    .from('profiles')
    .update({ 
      current_latitude: userLocation.lat,
      current_longitude: userLocation.lng,
      location_updated_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      is_online: true,
      show_on_map: showOnMap // Respect user's visibility preference
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user location:', error);
  }
};

/**
 * Completely hide user from map immediately (for users inactive > 15 minutes)
 */
export const hideUserFromMap = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ 
      show_on_map: false,
      current_latitude: null,
      current_longitude: null,
      is_online: false,
      location_updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) {
    console.error('Error hiding user from map:', error);
  } else {
    console.log('🔍 User completely hidden from map due to inactivity');
  }
};

/**
 * Show user on map immediately
 */
export const showUserOnMap = async (
  userId: string, 
  userLocation: { lat: number; lng: number }
): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ 
      show_on_map: true,
      current_latitude: userLocation.lat,
      current_longitude: userLocation.lng,
      is_online: true,
      location_updated_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    })
    .eq('id', userId);

  if (error) {
    console.error('Error showing user on map:', error);
  } else {
    console.log('🔍 User shown on map with updated location');
    // Trigger a manual refresh event to notify other components
    window.dispatchEvent(new CustomEvent('userOnlineStatusChanged', {
      detail: { userId, isOnline: true }
    }));
  }
};

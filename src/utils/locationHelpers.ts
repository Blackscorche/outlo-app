
import { supabase } from '@/integrations/supabase/client';

export const updateLocationInDatabase = async (
  userId: string,
  lat: number, 
  lng: number, 
  isOnline: boolean = true
) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        current_latitude: lat,
        current_longitude: lng,
        location_updated_at: new Date().toISOString(),
        is_online: isOnline,
        show_on_map: true, // Keep user visible on map when updating location
        last_seen: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating location in database:', error);
    } else {
      console.log('Successfully updated location in database:', { lat, lng, isOnline });
    }
  } catch (err) {
    console.error('Error updating location:', err);
  }
};

export const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'));
      return;
    }

    // First try with high accuracy
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        console.log('Got high accuracy location:', newLocation);
        resolve(newLocation);
      },
      (error) => {
        console.log('High accuracy failed, trying normal accuracy:', error);
        // If high accuracy fails, try with normal accuracy
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            console.log('Got normal accuracy location:', newLocation);
            resolve(newLocation);
          },
          (error) => {
            console.error('All location attempts failed:', error);
            reject(error);
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000 // Cache for 1 minute for high accuracy
      }
    );
  });
};

export const setUserOfflineImmediately = async (userId: string) => {
  console.log('🔍 Setting user offline immediately and clearing location');
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_online: false,
        last_seen: new Date().toISOString(),
        current_latitude: null,
        current_longitude: null,
        location_updated_at: new Date().toISOString(),
        show_on_map: false // Hide from map when going offline
      })
      .eq('id', userId);

    if (error) {
      console.error('Error setting user offline:', error);
    } else {
      console.log('Successfully set user offline and cleared location immediately');
    }
  } catch (err) {
    console.error('Error setting user offline:', err);
  }
};

// Remove the updateVisibilityInDatabase function since we don't want to update visibility immediately
// when backgrounding - only when actually going offline after 15 minutes

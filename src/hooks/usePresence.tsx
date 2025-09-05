import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../integrations/supabase/client';

export const usePresence = () => {
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const lastActiveTime = useRef<number>(Date.now());

  const updatePresence = async (isOnline: boolean) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const now = new Date().toISOString();
      
      await supabase
        .from('profiles')
        .update({
          is_online: isOnline,
          last_seen: now,
        })
        .eq('id', authData.user.id);

      console.log('Presence updated:', isOnline ? 'online' : 'offline');
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  const startHeartbeat = () => {
    if (heartbeatInterval.current) return;

    // Update presence immediately
    updatePresence(true);

    // Send heartbeat every 30 seconds
    heartbeatInterval.current = setInterval(() => {
      updatePresence(true);
      lastActiveTime.current = Date.now();
    }, 30000);
  };

  const stopHeartbeat = () => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
    updatePresence(false);
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      console.log('App became active - starting presence heartbeat');
      startHeartbeat();
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      console.log('App went to background - user will remain online for 15 minutes');
      // Stop the heartbeat but don't set offline immediately
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      // Update last_seen but keep is_online true
      // User will appear online for 15 minutes based on last_seen timestamp
      updatePresence(true);
    }
  };

  useEffect(() => {
    // Start heartbeat when component mounts
    startHeartbeat();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup function
    return () => {
      console.log('Cleaning up presence tracking');
      stopHeartbeat();
      subscription?.remove();
    };
  }, []);


  return {
    updatePresence,
    markActive: () => {
      lastActiveTime.current = Date.now();
    }
  };
};
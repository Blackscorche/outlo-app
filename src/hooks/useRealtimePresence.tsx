
import { useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserPresence {
  [userId: string]: {
    isOnline: boolean;
    lastSeen: string;
  };
}

// Global channel instance to prevent multiple subscriptions
let globalPresenceChannel: any = null;
let globalUserPresence: UserPresence = {};
let globalListeners: Set<(presence: UserPresence) => void> = new Set();

export const useRealtimePresence = (currentUser: User | null) => {
  const [userPresence, setUserPresence] = useState<UserPresence>({});
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const listenerRef = useRef<(presence: UserPresence) => void | null>(null);

  // Initialize global presence tracking if needed
  useEffect(() => {
    if (!currentUser) {
      // Remove listener when no user
      if (listenerRef.current) {
        globalListeners.delete(listenerRef.current);
        listenerRef.current = null;
      }
      setUserPresence({});
      return;
    }

    // Create listener for this hook instance
    const listener = (presence: UserPresence) => {
      setUserPresence(presence);
    };
    listenerRef.current = listener;
    globalListeners.add(listener);

    // Initialize global channel if not exists
    if (!globalPresenceChannel) {
      console.log('🟢 Initializing global presence tracking');
      
      const channelName = 'global_user_presence';
      globalPresenceChannel = supabase.channel(channelName);

      globalPresenceChannel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = globalPresenceChannel.presenceState();
          console.log('🟢 Presence sync:', presenceState);
          
          const newPresence: UserPresence = {};
          
          Object.keys(presenceState).forEach(userId => {
            const userPresences = presenceState[userId];
            if (userPresences && userPresences.length > 0) {
              const latestPresence = userPresences[userPresences.length - 1];
              newPresence[userId] = {
                isOnline: true,
                lastSeen: latestPresence.last_seen || new Date().toISOString()
              };
            }
          });

          globalUserPresence = newPresence;
          // Notify all listeners
          globalListeners.forEach(cb => cb(newPresence));
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('🟢 User joined:', key, newPresences);
          globalUserPresence = {
            ...globalUserPresence,
            [key]: {
              isOnline: true,
              lastSeen: newPresences[0]?.last_seen || new Date().toISOString()
            }
          };
          globalListeners.forEach(cb => cb(globalUserPresence));
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('🔴 User left:', key, leftPresences);
          globalUserPresence = {
            ...globalUserPresence,
            [key]: {
              isOnline: false,
              lastSeen: leftPresences[0]?.last_seen || new Date().toISOString()
            }
          };
          globalListeners.forEach(cb => cb(globalUserPresence));
        })
        .subscribe(async (status) => {
          console.log('🟢 Global presence subscription status:', status);
          
          if (status === 'SUBSCRIBED') {
            // Track current user's presence
            const userPresenceData = {
              user_id: currentUser.id,
              last_seen: new Date().toISOString(),
              status: 'online'
            };
            
            await globalPresenceChannel.track(userPresenceData);
            console.log('🟢 Started tracking presence for:', currentUser.id);
          }
        });
    } else {
      // If channel exists, just track this user
      if (globalPresenceChannel.state === 'subscribed') {
        globalPresenceChannel.track({
          user_id: currentUser.id,
          last_seen: new Date().toISOString(),
          status: 'online'
        });
      }
    }

    // Set initial state from global state
    setUserPresence(globalUserPresence);

    // Set up heartbeat for current user
    if (!heartbeatIntervalRef.current) {
      heartbeatIntervalRef.current = setInterval(async () => {
        if (globalPresenceChannel && globalPresenceChannel.state === 'subscribed') {
          const heartbeatData = {
            user_id: currentUser.id,
            last_seen: new Date().toISOString(),
            status: 'online'
          };
          
          await globalPresenceChannel.track(heartbeatData);
          console.log('💓 Heartbeat sent for:', currentUser.id);
        }
      }, 30000);
    }

    // Cleanup function
    return () => {
      console.log('🔄 Cleaning up presence listener for:', currentUser.id);
      
      if (listenerRef.current) {
        globalListeners.delete(listenerRef.current);
        listenerRef.current = null;
      }

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [currentUser?.id]);

  // Handle page visibility changes
  useEffect(() => {
    if (!currentUser || !globalPresenceChannel) return;

    const handleVisibilityChange = async () => {
      if (globalPresenceChannel.state !== 'subscribed') return;
      
      if (document.hidden) {
        console.log('🔴 Page hidden, updating presence');
        await globalPresenceChannel.track({
          user_id: currentUser.id,
          last_seen: new Date().toISOString(),
          status: 'away'
        });
      } else {
        console.log('🟢 Page visible, updating presence');
        await globalPresenceChannel.track({
          user_id: currentUser.id,
          last_seen: new Date().toISOString(),
          status: 'online'
        });
      }
    };

    const handleBeforeUnload = async () => {
      console.log('🔴 Page unloading, removing presence');
      if (globalPresenceChannel && globalPresenceChannel.state === 'subscribed') {
        await globalPresenceChannel.untrack();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.id]);

  // Helper function to check if a user is online
  const isUserOnline = (userId: string): boolean => {
    return userPresence[userId]?.isOnline || false;
  };

  // Helper function to get user's last seen
  const getUserLastSeen = (userId: string): string | null => {
    return userPresence[userId]?.lastSeen || null;
  };

  // Get all online users
  const getOnlineUsers = (): string[] => {
    return Object.keys(userPresence).filter(userId => userPresence[userId]?.isOnline);
  };

  return {
    userPresence,
    isUserOnline,
    getUserLastSeen,
    getOnlineUsers
  };
};

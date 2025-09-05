
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useRealtimePresence } from '@/hooks/useRealtimePresence';

interface ChatUser {
  id: string;
  name: string;
  photos: string[];
  isOnline?: boolean;
  lastSeen?: string;
}

export const useChatRoom = (userId: string | undefined) => {
  const { user: currentUser } = useAuth();
  const [otherUser, setOtherUser] = useState<ChatUser | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { getChatRoom } = useChat();
  const { isUserOnline, getUserLastSeen } = useRealtimePresence(currentUser);

  console.log('useChatRoom - userId:', userId, 'currentUser:', currentUser?.id);

  // Load other user data and initialize chat room
  useEffect(() => {
    if (!userId || !currentUser) {
      console.log('Missing userId or currentUser');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const initializeChat = async () => {
      try {
        setLoading(true);
        console.log('Loading user profile for:', userId);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, name, photos, last_seen')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Error loading user profile:', error);
          if (isMounted) {
            setOtherUser(null);
            setLoading(false);
          }
          return;
        }

        if (!profile) {
          console.log('No profile found for user:', userId);
          if (isMounted) {
            setOtherUser(null);
            setLoading(false);
          }
          return;
        }

        console.log('Loaded user profile:', profile);
        
        if (isMounted) {
          setOtherUser({
            id: profile.id,
            name: profile.name || 'Unknown User',
            photos: profile.photos || [],
            isOnline: isUserOnline(profile.id),
            lastSeen: getUserLastSeen(profile.id) || profile.last_seen
          });

          // Initialize chat room immediately after loading user
          console.log('Initializing chat room for user:', userId);
          const roomId = await getChatRoom(userId);
          console.log('getChatRoom returned:', roomId);
          
          if (roomId && isMounted) {
            setCurrentRoomId(roomId);
            console.log('Chat room initialized:', roomId);
          } else if (isMounted) {
            console.error('Failed to create/find chat room - roomId is null');
          }
        }
      } catch (error) {
        console.error('Error in initializeChat:', error);
        if (isMounted) {
          setOtherUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeChat();
    
    return () => {
      isMounted = false;
    };
  }, [userId, currentUser?.id, getChatRoom]);

  // Update other user's online status when presence changes (separate effect)
  useEffect(() => {
    if (otherUser) {
      setOtherUser(prev => prev ? {
        ...prev,
        isOnline: isUserOnline(prev.id),
        lastSeen: getUserLastSeen(prev.id) || prev.lastSeen
      } : null);
    }
  }, [isUserOnline, getUserLastSeen, otherUser?.id]);

  return {
    otherUser,
    loading,
    currentRoomId,
    isReady: !!currentUser && !!otherUser && !!currentRoomId && !loading
  };
};

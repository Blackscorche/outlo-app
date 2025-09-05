
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Message } from '@/types';

export const useRealtimeChat = (roomId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  // Subscribe to real-time message updates
  useEffect(() => {
    if (!roomId || !user?.id) {
      setMessages([]);
      
      // Clean up existing channel
      if (channelRef.current && isSubscribedRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.error('Error removing chat channel:', error);
        }
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
      
      return;
    }

    console.log('Setting up realtime subscription for room:', roomId);

    // Only create new channel if not already subscribed
    if (!isSubscribedRef.current) {
      const channelName = `chat_room_${roomId}_${user.id}_${Date.now()}`;
      channelRef.current = supabase.channel(channelName);
      
      channelRef.current
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `chat_room_id=eq.${roomId}`
          },
          (payload) => {
            console.log('New message received in real-time:', payload);
            const newMessage: Message = {
              id: payload.new.id,
              senderId: payload.new.sender_id,
              receiverId: '',
              content: payload.new.message,
              timestamp: new Date(payload.new.created_at),
              read: false
            };
            
            setMessages(prev => [...prev, newMessage]);
          }
        )
        .subscribe((status: string) => {
          console.log('Chat channel status:', status);
          if (status === 'SUBSCRIBED') {
            isSubscribedRef.current = true;
          }
        });
    }

    return () => {
      console.log('Cleaning up realtime subscription for room:', roomId);
      if (channelRef.current && isSubscribedRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (error) {
          console.error('Error removing chat channel:', error);
        }
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [roomId, user?.id]);

  const loadInitialMessages = useCallback(async (roomId: string) => {
    if (!roomId) return;

    try {
      setLoading(true);
      const { data: messagesData, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      const formattedMessages: Message[] = messagesData?.map(msg => ({
        id: msg.id,
        senderId: msg.sender_id,
        receiverId: '',
        content: msg.message,
        timestamp: new Date(msg.created_at),
        read: !!msg.read_at
      })) || [];

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error in loadInitialMessages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    messages,
    loading,
    loadInitialMessages
  };
};

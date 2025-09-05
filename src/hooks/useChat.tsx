import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Message } from '@/types';

export interface ChatRoom {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
}

export const useChat = () => {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<{ [roomId: string]: Message[] }>({});
  const [loading, setLoading] = useState(false);

  const getChatRoom = useCallback(async (otherUserId: string): Promise<string | null> => {
    if (!user) {
      console.log('No user found for getChatRoom');
      return null;
    }

    console.log('getChatRoom called with:', { currentUserId: user.id, otherUserId });

    try {
      // First, try to find existing chat room with both possible orderings
      const { data: existingRoom, error: findError } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (findError) {
        console.error('Error finding chat room:', findError);
        return null;
      }

      if (existingRoom) {
        console.log('Found existing chat room:', existingRoom.id);
        return existingRoom.id;
      }

      // Create new chat room if none exists - use consistent ordering
      const user1_id = user.id < otherUserId ? user.id : otherUserId;
      const user2_id = user.id < otherUserId ? otherUserId : user.id;

      console.log('Creating new chat room with:', { user1_id, user2_id });

      const { data: newRoom, error: createError } = await supabase
        .from('chat_rooms')
        .insert({
          user1_id,
          user2_id
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating chat room:', createError);
        
        // If it's a duplicate key error, try to find the room again
        if (createError.code === '23505') {
          console.log('Chat room already exists due to race condition, finding it...');
          const { data: foundRoom, error: refindError } = await supabase
            .from('chat_rooms')
            .select('*')
            .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`)
            .single();

          if (refindError) {
            console.error('Error refinding chat room:', refindError);
            return null;
          }

          console.log('Found chat room after race condition:', foundRoom.id);
          return foundRoom.id;
        }
        
        return null;
      }

      console.log('Created new chat room:', newRoom.id);
      return newRoom.id;
    } catch (error) {
      console.error('Error in getChatRoom:', error);
      return null;
    }
  }, [user]);

  const loadMessages = useCallback(async (roomId: string) => {
    if (!roomId) {
      console.log('No roomId provided to loadMessages');
      return;
    }

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
        receiverId: '', // We'll need to determine this based on room participants
        content: msg.message,
        timestamp: new Date(msg.created_at),
        read: !!msg.read_at
      })) || [];

      console.log('Loaded messages for room:', roomId, formattedMessages.length);
      setMessages(prev => ({
        ...prev,
        [roomId]: formattedMessages
      }));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (roomId: string, content: string) => {
    if (!user || !roomId || !content.trim()) {
      console.log('Missing requirements for sendMessage:', { hasUser: !!user, roomId, content: content.trim() });
      return false;
    }

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          chat_room_id: roomId,
          sender_id: user.id,
          message: content.trim()
        });

      if (error) {
        console.error('Error sending message:', error);
        return false;
      }

      console.log('Message sent successfully');
      // Reload messages to get the new one
      await loadMessages(roomId);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [user, loadMessages]);

  return {
    getChatRoom,
    loadMessages,
    sendMessage,
    messages,
    loading
  };
};

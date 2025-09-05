import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from './useAuth';

export const useBadgeCounts = () => {
  const { user } = useAuth();
  const [chatBadgeCount, setChatBadgeCount] = useState(0);
  const [connectionsBadgeCount, setConnectionsBadgeCount] = useState(0);

  const loadChatBadgeCount = useCallback(async () => {
    if (!user) return;

    try {
      // Get all chat rooms for current user
      const { data: chatRooms } = await supabase
        .from('chat_rooms')
        .select('id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (!chatRooms || chatRooms.length === 0) {
        setChatBadgeCount(0);
        return;
      }

      // Count unread messages across all chat rooms
      const chatRoomIds = chatRooms.map(room => room.id);
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('chat_room_id', chatRoomIds)
        .neq('sender_id', user.id) // Not sent by current user
        .eq('is_read', false); // Unread messages

      console.log('Badge: Setting chat badge count to:', count || 0);
      setChatBadgeCount(count || 0);
    } catch (error) {
      console.error('Error loading chat badge count:', error);
    }
  }, [user]);

  const loadConnectionsBadgeCount = useCallback(async () => {
    if (!user) return;

    try {
      // Count pending connection requests received by current user
      const { count } = await supabase
        .from('connection_requests')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      setConnectionsBadgeCount(count || 0);
    } catch (error) {
      console.error('Error loading connections badge count:', error);
    }
  }, [user]);

  const loadBadgeCounts = useCallback(async () => {
    await Promise.all([
      loadChatBadgeCount(),
      loadConnectionsBadgeCount()
    ]);
  }, [loadChatBadgeCount, loadConnectionsBadgeCount]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadBadgeCounts();
    } else {
      setChatBadgeCount(0);
      setConnectionsBadgeCount(0);
    }
  }, [user, loadBadgeCounts]);

  // Real-time subscriptions for badge updates - same pattern as ChatScreen
  useEffect(() => {
    if (!user) return;


    // Subscribe to new messages for real-time updates
    const messagesSubscription = supabase
      .channel(`badge_new_messages_${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, async (payload) => {
        console.log('Badge: New message detected, updating count');
        // Update badge counts when new message arrives
        // This matches the pattern in ChatScreen
        await loadChatBadgeCount();
      })
      .subscribe();

    // Subscribe to message updates (for read status changes)
    const messageUpdatesSubscription = supabase
      .channel(`badge_message_updates_${user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'messages' 
      }, async (payload) => {
        console.log('Badge: Message updated, updating count');
        // Update badge counts when message is updated (read status)
        await loadChatBadgeCount();
      })
      .subscribe();

    // Subscribe to connection requests
    const connectionRequestsSubscription = supabase
      .channel(`badge_connection_requests_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'connection_requests',
        filter: `receiver_id=eq.${user.id}`
      }, async () => {
        await loadConnectionsBadgeCount();
      })
      .subscribe();

    // Set up interval to refresh badge counts - same as ChatScreen (15 seconds)
    const interval = setInterval(() => {
      loadBadgeCounts();
    }, 15000); // Refresh every 15 seconds

    return () => {
      messagesSubscription.unsubscribe();
      messageUpdatesSubscription.unsubscribe();
      connectionRequestsSubscription.unsubscribe();
      clearInterval(interval);
    };
  }, [user, loadChatBadgeCount, loadConnectionsBadgeCount, loadBadgeCounts]);


  // Refresh badges when app comes to foreground
  useEffect(() => {
    if (!user) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('App became active, refreshing badges');
        loadBadgeCounts();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [user, loadBadgeCounts]);

  return {
    chatBadgeCount,
    connectionsBadgeCount,
    refreshBadgeCounts: loadBadgeCounts,
    refreshChatBadgeCount: loadChatBadgeCount,
    refreshConnectionsBadgeCount: loadConnectionsBadgeCount
  };
};
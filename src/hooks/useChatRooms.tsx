
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectionRequests } from '@/hooks/useConnectionRequests';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimePresence } from '@/hooks/useRealtimePresence';
import { supabase } from '@/integrations/supabase/client';

interface ChatUser {
  id: string;
  name: string;
  photos: string[];
}

export const useChatRooms = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { connections, loadConnectionRequests } = useConnectionRequests();
  const { isUserOnline } = useRealtimePresence(user);
  const [pinnedRooms, setPinnedRooms] = useState<string[]>([]);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch only connected users for chat rooms
  useEffect(() => {
    const fetchChatUsers = async () => {
      console.log('ChatRooms - Current connections:', connections);
      console.log('ChatRooms - Connections length:', connections.length);
      
      if (connections.length === 0) {
        console.log('ChatRooms - No connections, clearing chat users');
        setChatUsers([]);
        setLoading(false);
        return;
      }

      try {
        // Only fetch profiles for users who are still connected
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, name, photos')
          .in('id', connections);

        if (error) {
          console.error('ChatRooms - Error fetching chat users:', error);
          return;
        }

        console.log('ChatRooms - Fetched profiles for connected users:', profiles);
        console.log('ChatRooms - Profile IDs:', profiles?.map(p => p.id));

        const transformedUsers: ChatUser[] = profiles?.map(profile => ({
          id: profile.id,
          name: profile.name,
          photos: profile.photos || []
        })) || [];

        console.log('ChatRooms - Setting chat users:', transformedUsers);
        setChatUsers(transformedUsers);
      } catch (error) {
        console.error('ChatRooms - Error in fetchChatUsers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChatUsers();
  }, [connections]);

  // Refresh connections when component mounts or when returning from other pages
  useEffect(() => {
    console.log('ChatRooms - Component mounted, refreshing connections...');
    loadConnectionRequests();
  }, [loadConnectionRequests]);

  // Listen for disconnection events to immediately remove users from chat list
  useEffect(() => {
    const handleUserDisconnected = (event: CustomEvent) => {
      const { userId } = event.detail;
      console.log('ChatRooms - User disconnected event received for user:', userId);
      
      // Immediately remove from chat users without waiting for connections update
      setChatUsers(prev => {
        const filtered = prev.filter(user => user.id !== userId);
        console.log('ChatRooms - Immediately removing user from chat list:', userId);
        console.log('ChatRooms - Chat users before removal:', prev.map(u => u.id));
        console.log('ChatRooms - Chat users after removal:', filtered.map(u => u.id));
        return filtered;
      });
      
      // Remove from pinned rooms immediately
      setPinnedRooms(prev => {
        const filtered = prev.filter(roomId => roomId !== userId);
        console.log('ChatRooms - Removing from pinned rooms:', userId);
        return filtered;
      });
      
      // Also refresh connection data for consistency
      loadConnectionRequests();
    };

    const handleConnectionDataChanged = (event: CustomEvent) => {
      const { userId, action } = event.detail;
      console.log('ChatRooms - Connection data changed event received:', { userId, action });
      
      // If it's a disconnect action, immediately remove the user
      if (action === 'disconnect' && userId) {
        setChatUsers(prev => {
          const filtered = prev.filter(user => user.id !== userId);
          console.log('ChatRooms - Removing user due to connection change:', userId);
          return filtered;
        });
        
        setPinnedRooms(prev => prev.filter(roomId => roomId !== userId));
      }
      
      // Refresh connection data
      loadConnectionRequests();
    };

    const handleForceConnectionRefresh = (event: CustomEvent) => {
      const { userId } = event.detail;
      console.log('ChatRooms - Force connection refresh event received for user:', userId);
      
      // Refresh connection data immediately
      loadConnectionRequests();
    };

    window.addEventListener('userDisconnected', handleUserDisconnected as EventListener);
    window.addEventListener('connectionDataChanged', handleConnectionDataChanged as EventListener);
    window.addEventListener('forceConnectionRefresh', handleForceConnectionRefresh as EventListener);
    
    return () => {
      window.removeEventListener('userDisconnected', handleUserDisconnected as EventListener);
      window.removeEventListener('connectionDataChanged', handleConnectionDataChanged as EventListener);
      window.removeEventListener('forceConnectionRefresh', handleForceConnectionRefresh as EventListener);
    };
  }, [loadConnectionRequests]);

  // Clean up pinned rooms when connections change to ensure consistency
  useEffect(() => {
    setPinnedRooms(prev => {
      const filtered = prev.filter(roomId => connections.includes(roomId));
      if (filtered.length !== prev.length) {
        console.log('ChatRooms - Cleaning up pinned rooms based on current connections');
      }
      return filtered;
    });
  }, [connections]);

  const handleChatClick = (userId: string) => {
    // Double-check if user is still connected before navigating
    if (!connections.includes(userId)) {
      console.log('ChatRooms - User no longer connected, not navigating to chat:', userId);
      // Also remove from local state if somehow still there
      setChatUsers(prev => prev.filter(user => user.id !== userId));
      return;
    }
    console.log('ChatRooms - Navigating to chat with user:', userId);
    navigate(`/chat/${userId}`);
  };

  const handlePinToggle = (userId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    // Only allow pinning if user is still connected
    if (!connections.includes(userId)) {
      console.log('ChatRooms - Cannot pin disconnected user:', userId);
      // Remove from local state if somehow still there
      setChatUsers(prev => prev.filter(user => user.id !== userId));
      return;
    }
    setPinnedRooms(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Filter and sort chat users - only show those who are still connected
  const filteredChatUsers = chatUsers.filter(user => {
    const isStillConnected = connections.includes(user.id);
    if (!isStillConnected) {
      console.log('ChatRooms - Filtering out disconnected user:', user.id);
    }
    return isStillConnected;
  });

  // Separate pinned and unpinned rooms, sort by online status
  const pinnedChatRooms = filteredChatUsers
    .filter(user => pinnedRooms.includes(user.id))
    .sort((a, b) => {
      const aOnline = isUserOnline(a.id);
      const bOnline = isUserOnline(b.id);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return 0;
    });
    
  const unpinnedChatRooms = filteredChatUsers
    .filter(user => !pinnedRooms.includes(user.id))
    .sort((a, b) => {
      const aOnline = isUserOnline(a.id);
      const bOnline = isUserOnline(b.id);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return 0;
    });
  
  const sortedChatRooms = [...pinnedChatRooms, ...unpinnedChatRooms];

  console.log('ChatRooms - Final state:');
  console.log('- Connections:', connections);
  console.log('- Chat users:', chatUsers.map(u => u.id));
  console.log('- Filtered chat users:', filteredChatUsers.map(u => u.id));
  console.log('- Sorted chat rooms:', sortedChatRooms.map(u => u.name));

  return {
    loading,
    sortedChatRooms,
    pinnedRooms,
    handleChatClick,
    handlePinToggle
  };
};

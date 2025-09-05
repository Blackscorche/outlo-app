
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useOnlineStatus = () => {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Fetch currently online users from database
    const fetchOnlineUsers = async () => {
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_online', true)
          .eq('show_on_map', true)
          .not('current_latitude', 'is', null)
          .not('current_longitude', 'is', null);

        if (!error && profiles) {
          const onlineIds = new Set(profiles.map(p => p.id));
          setOnlineUserIds(onlineIds);
          console.log('Online users updated:', Array.from(onlineIds));
        }
      } catch (error) {
        console.error('Error fetching online users:', error);
      }
    };

    // Initial fetch
    fetchOnlineUsers();

    // Refresh every 30 seconds to ensure accuracy
    const interval = setInterval(fetchOnlineUsers, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const isUserOnline = (userId: string): boolean => {
    return onlineUserIds.has(userId);
  };

  return {
    isUserOnline,
    onlineUserIds: Array.from(onlineUserIds)
  };
};

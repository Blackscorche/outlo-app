import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Alert } from 'react-native';

export const usePinnedUsers = () => {
  const [pinnedUsers, setPinnedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPinnedUsers();
  }, []);

  const loadPinnedUsers = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('pinned_users')
        .select('pinned_user_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setPinnedUsers(data?.map(item => item.pinned_user_id) || []);
    } catch (error) {
      console.error('Error loading pinned users:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePinUser = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const isPinned = pinnedUsers.includes(userId);

      if (isPinned) {
        // Unpin user
        const { error } = await supabase
          .from('pinned_users')
          .delete()
          .eq('user_id', user.id)
          .eq('pinned_user_id', userId);

        if (error) throw error;

        setPinnedUsers(prev => prev.filter(id => id !== userId));
        return false;
      } else {
        // Check if user has reached pin limit (e.g., 10 users)
        if (pinnedUsers.length >= 10) {
          Alert.alert('Pin Limit', 'You can only pin up to 10 users.');
          return pinnedUsers.includes(userId);
        }

        // Pin user
        const { error } = await supabase
          .from('pinned_users')
          .insert({
            user_id: user.id,
            pinned_user_id: userId,
            created_at: new Date().toISOString()
          });

        if (error) throw error;

        setPinnedUsers(prev => [...prev, userId]);
        return true;
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
      Alert.alert('Error', 'Failed to update pin status');
      return pinnedUsers.includes(userId);
    }
  };

  const isPinned = (userId: string) => {
    return pinnedUsers.includes(userId);
  };

  return {
    pinnedUsers,
    togglePinUser,
    isPinned,
    loadPinnedUsers,
    loading
  };
};
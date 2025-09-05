
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export const useBlocking = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [usersWhoBlockedMe, setUsersWhoBlockedMe] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch blocked users list (users I blocked)
  const fetchBlockedUsers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id);

      if (error) {
        console.error('Error fetching blocked users:', error);
        return;
      }

      const blockedUserIds = data.map(item => item.blocked_id);
      setBlockedUsers(blockedUserIds);
    } catch (error) {
      console.error('Error in fetchBlockedUsers:', error);
    }
  };

  // Fetch users who blocked me
  const fetchUsersWhoBlockedMe = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocked_id', user.id);

      if (error) {
        console.error('Error fetching users who blocked me:', error);
        return;
      }

      const blockerIds = data.map(item => item.blocker_id);
      setUsersWhoBlockedMe(blockerIds);
    } catch (error) {
      console.error('Error in fetchUsersWhoBlockedMe:', error);
    }
  };

  // Block a user
  const blockUser = async (userId: string) => {
    if (!user || userId === user.id) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: user.id,
          blocked_id: userId
        });

      if (error) {
        console.error('Error blocking user:', error);
        toast({
          title: "Error",
          description: "Failed to block user. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setBlockedUsers(prev => [...prev, userId]);
      
      toast({
        title: "User blocked",
        description: "This user has been blocked and will no longer appear in your feed.",
      });
      
      return true;
    } catch (error) {
      console.error('Error in blockUser:', error);
      toast({
        title: "Error",
        description: "Failed to block user. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Unblock a user
  const unblockUser = async (userId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId);

      if (error) {
        console.error('Error unblocking user:', error);
        toast({
          title: "Error",
          description: "Failed to unblock user. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setBlockedUsers(prev => prev.filter(id => id !== userId));
      
      toast({
        title: "User unblocked",
        description: "This user has been unblocked.",
      });
      
      return true;
    } catch (error) {
      console.error('Error in unblockUser:', error);
      toast({
        title: "Error",
        description: "Failed to unblock user. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Check if a user is blocked by me
  const isUserBlockedByMe = (userId: string) => {
    return blockedUsers.includes(userId);
  };

  // Check if I'm blocked by a user
  const amIBlockedByUser = (userId: string) => {
    return usersWhoBlockedMe.includes(userId);
  };

  // Check if there's any blocking relationship (either direction)
  const hasBlockingRelationship = (userId: string) => {
    return isUserBlockedByMe(userId) || amIBlockedByUser(userId);
  };

  // Enhanced filter function to remove users with any blocking relationship
  const filterBlockedUsers = <T extends { id: string }>(users: T[]): T[] => {
    return users.filter(user => !hasBlockingRelationship(user.id));
  };

  // Refresh both blocked lists
  const refreshBlockedUsers = async () => {
    await Promise.all([fetchBlockedUsers(), fetchUsersWhoBlockedMe()]);
  };

  useEffect(() => {
    refreshBlockedUsers();
  }, [user]);

  return {
    blockedUsers,
    usersWhoBlockedMe,
    loading,
    blockUser,
    unblockUser,
    isUserBlockedByMe,
    amIBlockedByUser,
    hasBlockingRelationship,
    filterBlockedUsers,
    refreshBlockedUsers
  };
};


import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
  friend_profile?: {
    id: string;
    name: string;
    photos: string[];
    is_online: boolean;
    age: number;
    occupation?: string;
    bio?: string;
    interests: string[];
  };
}

export const useFriends = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFriends = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('Loading friends for user:', user.id);
      
      const { data: friendsData, error } = await supabase
        .from('friends')
        .select(`
          id,
          user_id,
          friend_id,
          created_at
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading friends:', error);
        toast({
          title: "Error",
          description: "Failed to load friends list.",
          variant: "destructive",
        });
        return;
      }

      console.log('Friends data loaded:', friendsData);

      // Get friend profiles separately
      if (friendsData && friendsData.length > 0) {
        const friendIds = friendsData.map((f: any) => f.friend_id);
        console.log('Loading profiles for friend IDs:', friendIds);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select(`
            id,
            name,
            photos,
            is_online,
            age,
            occupation,
            bio,
            interests
          `)
          .in('id', friendIds);

        if (profilesError) {
          console.error('Error loading friend profiles:', profilesError);
        }

        console.log('Friend profiles loaded:', profilesData);

        // Combine friends with their profiles
        const friendsWithProfiles = friendsData.map((friend: any) => ({
          ...friend,
          friend_profile: profilesData?.find(profile => profile.id === friend.friend_id)
        }));

        console.log('Final friends with profiles:', friendsWithProfiles);
        setFriends(friendsWithProfiles as Friend[]);
      } else {
        console.log('No friends found');
        setFriends([]);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const addFriend = useCallback(async (friendId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: friendId
        });

      if (error) {
        console.error('Error adding friend:', error);
        return false;
      }

      await loadFriends();
      return true;
    } catch (error) {
      console.error('Error adding friend:', error);
      return false;
    }
  }, [user, loadFriends]);

  const removeFriend = useCallback(async (friendId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', user.id)
        .eq('friend_id', friendId);

      if (error) {
        console.error('Error removing friend:', error);
        return false;
      }

      await loadFriends();
      return true;
    } catch (error) {
      console.error('Error removing friend:', error);
      return false;
    }
  }, [user, loadFriends]);

  const isFriend = useCallback((userId: string): boolean => {
    const result = friends.some(friend => friend.friend_id === userId);
    console.log('Checking if user is friend:', userId, 'Result:', result, 'Friends:', friends.length);
    return result;
  }, [friends]);

  useEffect(() => {
    if (user) {
      loadFriends();
    }
  }, [user, loadFriends]);

  console.log('useFriends hook state - Friends count:', friends.length, 'Loading:', loading);

  return {
    friends,
    loading,
    addFriend,
    removeFriend,
    isFriend,
    loadFriends
  };
};


import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useConnectionRequests } from './useConnectionRequests';

export const useFavorites = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { getConnectionStatus } = useConnectionRequests();
  const [favoriteUsers, setFavoriteUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch user's favorites
  const fetchFavorites = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('favorited_user_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching favorites:', error);
        return;
      }

      const favoriteIds = data?.map(item => item.favorited_user_id) || [];
      setFavoriteUsers(favoriteIds);
    } catch (error) {
      console.error('Error in fetchFavorites:', error);
    }
  };

  // Add user to favorites
  const addToFavorites = async (userId: string) => {
    if (!user || userId === user.id) return false;

    // Check if users are connected
    const connectionStatus = getConnectionStatus(userId);
    if (connectionStatus !== 'connected') {
      toast({
        title: "Connection required",
        description: "You can only add connected users to your favorites.",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: user.id,
          favorited_user_id: userId
        });

      if (error) {
        console.error('Error adding to favorites:', error);
        toast({
          title: "Error",
          description: "Failed to add to favorites. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setFavoriteUsers(prev => [...prev, userId]);
      
      toast({
        title: "Added to favorites",
        description: "User has been added to your favorites.",
      });
      
      return true;
    } catch (error) {
      console.error('Error in addToFavorites:', error);
      toast({
        title: "Error",
        description: "Failed to add to favorites. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Remove user from favorites
  const removeFromFavorites = async (userId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('favorited_user_id', userId);

      if (error) {
        console.error('Error removing from favorites:', error);
        toast({
          title: "Error",
          description: "Failed to remove from favorites. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setFavoriteUsers(prev => prev.filter(id => id !== userId));
      
      toast({
        title: "Removed from favorites",
        description: "User has been removed from your favorites.",
      });
      
      return true;
    } catch (error) {
      console.error('Error in removeFromFavorites:', error);
      toast({
        title: "Error",
        description: "Failed to remove from favorites. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Check if user is in favorites
  const isFavorite = (userId: string) => {
    return favoriteUsers.includes(userId);
  };

  // Check if user can be favorited (must be connected)
  const canFavorite = (userId: string) => {
    const connectionStatus = getConnectionStatus(userId);
    return connectionStatus === 'connected';
  };

  // Toggle favorite status
  const toggleFavorite = async (userId: string) => {
    if (isFavorite(userId)) {
      return await removeFromFavorites(userId);
    } else {
      return await addToFavorites(userId);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  return {
    favoriteUsers,
    loading,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    canFavorite,
    toggleFavorite,
    refreshFavorites: fetchFavorites
  };
};

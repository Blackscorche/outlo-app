
import { supabase } from '@/integrations/supabase/client';
import { CreateStoryData, UpdateStoryData, Story } from '@/types/story';

export const useStoryOperations = (userId: string | undefined, refreshStories: () => Promise<void>) => {
  const createStory = async (storyData: CreateStoryData) => {
    if (!userId) {
      console.error('No user found for story creation');
      return null;
    }

    try {
      console.log('Creating story with data:', storyData);
      
      const { data, error } = await supabase
        .from('stories')
        .insert({
          user_id: userId,
          ...storyData
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating story:', error);
        return null;
      }

      console.log('Story created successfully:', data);
      
      // Refresh stories immediately after creation
      await refreshStories();
      return data;
    } catch (err) {
      console.error('Error in createStory:', err);
      return null;
    }
  };

  const updateStory = async (storyId: string, updates: UpdateStoryData) => {
    if (!userId) {
      console.error('No user found for story update');
      return null;
    }

    try {
      console.log('Updating story:', storyId, 'with data:', updates);
      
      const { data, error } = await supabase
        .from('stories')
        .update(updates)
        .eq('id', storyId)
        .eq('user_id', userId) // Ensure user can only update their own stories
        .select()
        .single();

      if (error) {
        console.error('Error updating story:', error);
        return null;
      }

      console.log('Story updated successfully:', data);
      
      // Refresh stories after update
      await refreshStories();
      return data;
    } catch (err) {
      console.error('Error in updateStory:', err);
      return null;
    }
  };

  const deleteStory = async (storyId: string) => {
    if (!userId) {
      console.error('No user found for story deletion');
      return false;
    }

    try {
      console.log('Deleting story:', storyId);
      
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId)
        .eq('user_id', userId); // Ensure user can only delete their own stories

      if (error) {
        console.error('Error deleting story:', error);
        return false;
      }

      console.log('Story deleted successfully');
      
      // Refresh stories after deletion
      await refreshStories();
      return true;
    } catch (err) {
      console.error('Error in deleteStory:', err);
      return false;
    }
  };

  return {
    createStory,
    updateStory,
    deleteStory
  };
};

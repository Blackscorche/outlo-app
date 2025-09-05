
import { supabase } from '@/integrations/supabase/client';

export const useStoryInteractions = (userId: string | undefined, refreshStories: () => Promise<void>) => {
  const likeStory = async (storyId: string) => {
    if (!userId) {
      console.error('No user found for liking story');
      return;
    }

    try {
      console.log('Liking story:', storyId, 'by user:', userId);
      
      // Check if user already liked this story
      const { data: existingLike, error: checkError } = await supabase
        .from('story_likes')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing like:', checkError);
        return;
      }

      if (existingLike) {
        console.log('User already liked this story');
        return;
      }

      const { error } = await supabase
        .from('story_likes')
        .insert({ story_id: storyId, user_id: userId });

      if (error) {
        console.error('Error liking story:', error);
        return;
      }

      console.log('Story liked successfully');
      // Refresh stories to get updated likes
      await refreshStories();
    } catch (err) {
      console.error('Error in likeStory:', err);
    }
  };

  const unlikeStory = async (storyId: string) => {
    if (!userId) {
      console.error('No user found for unliking story');
      return;
    }

    try {
      console.log('Unliking story:', storyId, 'by user:', userId);
      
      const { error } = await supabase
        .from('story_likes')
        .delete()
        .eq('story_id', storyId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error unliking story:', error);
        return;
      }

      console.log('Story unliked successfully');
      // Refresh stories to get updated likes
      await refreshStories();
    } catch (err) {
      console.error('Error in unlikeStory:', err);
    }
  };

  const commentOnStory = async (storyId: string, content: string) => {
    if (!userId) {
      console.error('No user found for commenting on story');
      return;
    }

    try {
      console.log('Commenting on story:', storyId, 'with content:', content);
      
      const { error } = await supabase
        .from('story_comments')
        .insert({ 
          story_id: storyId, 
          user_id: userId, 
          content 
        });

      if (error) {
        console.error('Error commenting on story:', error);
        return;
      }

      console.log('Comment added successfully');
      // Refresh stories to get updated comments
      await refreshStories();
    } catch (err) {
      console.error('Error in commentOnStory:', err);
    }
  };

  return {
    likeStory,
    unlikeStory,
    commentOnStory
  };
};

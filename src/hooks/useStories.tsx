
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStoryData } from './useStoryData';
import { useStoryOperations } from './useStoryOperations';
import { useStoryInteractions } from './useStoryInteractions';

export type { Story, CreateStoryData, UpdateStoryData } from '@/types/story';

export const useStories = () => {
  const { user } = useAuth();
  const { stories, loading, fetchStories } = useStoryData();
  const { createStory, updateStory, deleteStory } = useStoryOperations(user?.id, fetchStories);
  const { likeStory, unlikeStory, commentOnStory } = useStoryInteractions(user?.id, fetchStories);

  useEffect(() => {
    if (user) {
      fetchStories();
    }
  }, [user]);

  return {
    stories,
    loading,
    createStory,
    updateStory,
    deleteStory,
    likeStory,
    unlikeStory,
    commentOnStory,
    refreshStories: fetchStories
  };
};

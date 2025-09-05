
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Story } from '@/types/story';

export const useStoryData = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = async () => {
    try {
      console.log('Fetching stories...');
      
      // Fetch stories and profiles separately, then combine them
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select('*')
        .order('created_at', { ascending: false });

      if (storiesError) {
        console.error('Error fetching stories:', storiesError);
        return;
      }

      console.log('Raw stories data:', storiesData);

      // Get unique user IDs from stories
      const userIds = [...new Set(storiesData?.map(story => story.user_id) || [])];
      
      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, photos')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      console.log('Profiles data:', profilesData);

      // Fetch likes and comments for all stories
      const storyIds = storiesData?.map(story => story.id) || [];
      
      const { data: likesData, error: likesError } = await supabase
        .from('story_likes')
        .select(`
          *,
          profile:profiles(name)
        `)
        .in('story_id', storyIds);

      if (likesError) {
        console.error('Error fetching likes:', likesError);
      }

      const { data: commentsData, error: commentsError } = await supabase
        .from('story_comments')
        .select(`
          *,
          profile:profiles(name, photos)
        `)
        .in('story_id', storyIds)
        .order('created_at', { ascending: true });

      if (commentsError) {
        console.error('Error fetching comments:', commentsError);
      }

      console.log('Likes data:', likesData);
      console.log('Comments data:', commentsData);

      // Create a map of profiles by user ID for easy lookup
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Group likes and comments by story ID
      const likesMap = new Map();
      const commentsMap = new Map();
      
      likesData?.forEach((like: any) => {
        if (!likesMap.has(like.story_id)) {
          likesMap.set(like.story_id, []);
        }
        likesMap.get(like.story_id).push(like);
      });

      commentsData?.forEach((comment: any) => {
        if (!commentsMap.has(comment.story_id)) {
          commentsMap.set(comment.story_id, []);
        }
        commentsMap.get(comment.story_id).push(comment);
      });

      // Combine stories with profiles, likes, and comments
      const transformedStories = storiesData?.map(story => ({
        ...story,
        story_type: story.story_type as 'post' | 'selfie' | 'checkin',
        profile: profilesMap.get(story.user_id) ? {
          name: profilesMap.get(story.user_id).name,
          photos: profilesMap.get(story.user_id).photos || []
        } : undefined,
        likes: likesMap.get(story.id) || [],
        comments: commentsMap.get(story.id) || []
      })) || [];

      console.log('Transformed stories with likes/comments:', transformedStories);
      setStories(transformedStories);
    } catch (err) {
      console.error('Error in fetchStories:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    stories,
    loading,
    fetchStories,
    setStories,
    setLoading
  };
};

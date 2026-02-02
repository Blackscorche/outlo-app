import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../integrations/supabase/client';
import { Tables, TablesInsert } from '../integrations/supabase/types';

export type Activity = Tables<'activities'> & {
  creator?: {
    id: string;
    name: string;
    photos: string[] | null;
  };
  participants?: {
    id: string;
    user_id: string;
    status: string;
    joined_at: string;
    user?: {
      id: string;
      name: string;
      photos: string[] | null;
    };
  }[];
  comments?: ActivityComment[];
};

export type ActivityParticipant = Tables<'activity_participants'>;

export type ActivityComment = Tables<'activity_comments'> & {
  user?: {
    id: string;
    name: string;
    photos: string[] | null;
  };
};

interface CreateActivityData {
  activity_type: string;
  title: string;
  description?: string;
  location_name: string;
  latitude: number;
  longitude: number;
  scheduled_at: string;
  max_participants?: number;
}

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [joinedActivities, setJoinedActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchActivities();
    setupRealtimeSubscription();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setupRealtimeSubscription = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Subscribe to activities changes
    const activitiesSubscription = supabase
      .channel(`activities_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activities',
      }, () => {
        // Debounce reload
        setTimeout(() => {
          if (mountedRef.current) {
            fetchActivities();
          }
        }, 100);
      })
      .subscribe();

    // Subscribe to participants changes
    const participantsSubscription = supabase
      .channel(`activity_participants_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_participants',
      }, () => {
        setTimeout(() => {
          if (mountedRef.current) {
            fetchActivities();
          }
        }, 100);
      })
      .subscribe();

    return () => {
      activitiesSubscription.unsubscribe();
      participantsSubscription.unsubscribe();
    };
  };

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Allow activities scheduled within the last 2 hours (so ongoing activities still show)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      // 1. Fetch open activities for "All" tab (with time filter)
      const { data: publicActivitiesData, error: publicError } = await supabase
        .from('activities')
        .select(`
          *,
          creator:profiles!creator_id(id, name, photos)
        `)
        .eq('status', 'open')
        .gte('scheduled_at', twoHoursAgo)
        .order('scheduled_at', { ascending: true });

      if (publicError) {
        console.error('📅 Public activities error:', publicError);
        throw publicError;
      }

      // 2. Fetch ALL activities created by the user (no time filter for "Mine" tab)
      const { data: myActivitiesData, error: myError } = await supabase
        .from('activities')
        .select(`
          *,
          creator:profiles!creator_id(id, name, photos)
        `)
        .eq('creator_id', user.id)
        .order('scheduled_at', { ascending: false });

      if (myError) {
        console.error('📅 My activities error:', myError);
        throw myError;
      }

      // 3. Get all activities the user has joined (for "Joined" tab)
      const { data: myParticipations, error: partError } = await supabase
        .from('activity_participants')
        .select('activity_id')
        .eq('user_id', user.id)
        .eq('status', 'joined');

      if (partError) throw partError;

      let joinedActivitiesData: any[] = [];
      if (myParticipations && myParticipations.length > 0) {
        const joinedActivityIds = myParticipations.map(p => p.activity_id);
        const { data: joined, error: joinedError } = await supabase
          .from('activities')
          .select(`
            *,
            creator:profiles!creator_id(id, name, photos)
          `)
          .in('id', joinedActivityIds)
          .neq('creator_id', user.id) // Exclude activities I created
          .order('scheduled_at', { ascending: false });

        if (joinedError) throw joinedError;
        joinedActivitiesData = joined || [];
      }

      // Combine all unique activities for fetching participants
      const allActivitiesMap = new Map<string, any>();
      (publicActivitiesData || []).forEach(a => allActivitiesMap.set(a.id, a));
      (myActivitiesData || []).forEach(a => allActivitiesMap.set(a.id, a));
      joinedActivitiesData.forEach(a => allActivitiesMap.set(a.id, a));

      const allActivityIds = Array.from(allActivitiesMap.keys());
      let participantsData: any[] = [];

      if (allActivityIds.length > 0) {
        const { data: participants, error: participantsError } = await supabase
          .from('activity_participants')
          .select(`
            *,
            user:profiles!user_id(id, name, photos)
          `)
          .in('activity_id', allActivityIds)
          .eq('status', 'joined');

        if (participantsError) throw participantsError;
        participantsData = participants || [];
      }

      // Helper to add participants to activities
      const addParticipants = (activities: any[]) =>
        activities.map(activity => ({
          ...activity,
          participants: participantsData.filter(p => p.activity_id === activity.id),
        }));

      console.log('📅 Activities fetched - Public:', publicActivitiesData?.length || 0,
                  'Mine:', myActivitiesData?.length || 0,
                  'Joined:', joinedActivitiesData.length);

      if (mountedRef.current) {
        // "All" tab: public activities with time filter
        setActivities(addParticipants(publicActivitiesData || []));

        // "Mine" tab: all my created activities (no time filter)
        setMyActivities(addParticipants(myActivitiesData || []));

        // "Joined" tab: all activities I've joined but didn't create (no time filter)
        setJoinedActivities(addParticipants(joinedActivitiesData));
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const refreshActivities = useCallback(async () => {
    setRefreshing(true);
    await fetchActivities();
  }, [fetchActivities]);

  const createActivity = useCallback(async (data: CreateActivityData): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create an activity');
        return false;
      }

      const { error } = await supabase
        .from('activities')
        .insert({
          creator_id: user.id,
          activity_type: data.activity_type,
          title: data.title,
          description: data.description || null,
          location_name: data.location_name,
          latitude: data.latitude,
          longitude: data.longitude,
          scheduled_at: data.scheduled_at,
          max_participants: data.max_participants || 10,
          current_participants: 1, // Creator counts as participant
          status: 'open',
        });

      if (error) throw error;

      // Also add creator as first participant
      const { data: activity } = await supabase
        .from('activities')
        .select('id')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (activity) {
        await supabase
          .from('activity_participants')
          .insert({
            activity_id: activity.id,
            user_id: user.id,
            status: 'joined',
          });
      }

      await fetchActivities();
      return true;
    } catch (error) {
      console.error('Error creating activity:', error);
      Alert.alert('Error', 'Failed to create activity');
      return false;
    }
  }, [fetchActivities]);

  const joinActivity = useCallback(async (activityId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to join an activity');
        return false;
      }

      // Check if already joined
      const { data: existing } = await supabase
        .from('activity_participants')
        .select('id, status')
        .eq('activity_id', activityId)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        if (existing.status === 'joined') {
          Alert.alert('Info', 'You have already joined this activity');
          return false;
        }
        // Re-join if previously left
        const { error } = await supabase
          .from('activity_participants')
          .update({ status: 'joined', joined_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // New participant
        const { error } = await supabase
          .from('activity_participants')
          .insert({
            activity_id: activityId,
            user_id: user.id,
            status: 'joined',
          });

        if (error) throw error;
      }

      await fetchActivities();
      return true;
    } catch (error) {
      console.error('Error joining activity:', error);
      Alert.alert('Error', 'Failed to join activity');
      return false;
    }
  }, [fetchActivities]);

  const leaveActivity = useCallback(async (activityId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to leave an activity');
        return false;
      }

      // Check if user is the creator
      const { data: activity } = await supabase
        .from('activities')
        .select('creator_id')
        .eq('id', activityId)
        .single();

      if (activity?.creator_id === user.id) {
        Alert.alert('Error', 'You cannot leave an activity you created. Cancel it instead.');
        return false;
      }

      const { error } = await supabase
        .from('activity_participants')
        .update({ status: 'left' })
        .eq('activity_id', activityId)
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchActivities();
      return true;
    } catch (error) {
      console.error('Error leaving activity:', error);
      Alert.alert('Error', 'Failed to leave activity');
      return false;
    }
  }, [fetchActivities]);

  const cancelActivity = useCallback(async (activityId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return false;
      }

      // Verify user is the creator
      const { data: activity } = await supabase
        .from('activities')
        .select('creator_id')
        .eq('id', activityId)
        .single();

      if (activity?.creator_id !== user.id) {
        Alert.alert('Error', 'Only the creator can cancel this activity');
        return false;
      }

      const { error } = await supabase
        .from('activities')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', activityId);

      if (error) throw error;

      await fetchActivities();
      return true;
    } catch (error) {
      console.error('Error cancelling activity:', error);
      Alert.alert('Error', 'Failed to cancel activity');
      return false;
    }
  }, [fetchActivities]);

  const getActivityById = useCallback(async (activityId: string): Promise<Activity | null> => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          creator:profiles!creator_id(id, name, photos)
        `)
        .eq('id', activityId)
        .single();

      if (error) throw error;

      // Fetch participants
      const { data: participants } = await supabase
        .from('activity_participants')
        .select(`
          *,
          user:profiles!user_id(id, name, photos)
        `)
        .eq('activity_id', activityId)
        .eq('status', 'joined');

      return {
        ...data,
        participants: participants || [],
      };
    } catch (error) {
      console.error('Error fetching activity:', error);
      return null;
    }
  }, []);

  const isParticipant = useCallback((activity: Activity, userId: string): boolean => {
    return activity.participants?.some(p => p.user_id === userId && p.status === 'joined') || false;
  }, []);

  const isCreator = useCallback((activity: Activity, userId: string): boolean => {
    return activity.creator_id === userId;
  }, []);

  const fetchComments = useCallback(async (activityId: string): Promise<ActivityComment[]> => {
    try {
      // First fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('activity_comments')
        .select('*')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      if (!commentsData || commentsData.length === 0) return [];

      // Then fetch user profiles for comments
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, name, photos')
        .in('id', userIds);

      // Combine comments with user data
      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
      const commentsWithUsers = commentsData.map(comment => ({
        ...comment,
        user: usersMap.get(comment.user_id) || undefined,
      }));

      return commentsWithUsers;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  }, []);

  const addComment = useCallback(async (activityId: string, content: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to comment');
        return false;
      }

      const { error } = await supabase
        .from('activity_comments')
        .insert({
          activity_id: activityId,
          user_id: user.id,
          content: content.trim(),
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
      return false;
    }
  }, []);

  const deleteComment = useCallback(async (commentId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return false;
      }

      const { error } = await supabase
        .from('activity_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      Alert.alert('Error', 'Failed to delete comment');
      return false;
    }
  }, []);

  return {
    activities,
    myActivities,
    joinedActivities,
    loading,
    refreshing,
    fetchActivities,
    refreshActivities,
    createActivity,
    joinActivity,
    leaveActivity,
    cancelActivity,
    getActivityById,
    isParticipant,
    isCreator,
    fetchComments,
    addComment,
    deleteComment,
  };
}

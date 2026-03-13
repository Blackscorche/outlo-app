import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Tables } from '../integrations/supabase/types';
import { SkillMatch, UserSkill, UserSkillWant } from '../constants/skillTypes';

interface MatchingUser {
  id: string;
  name: string;
  photos: string[] | null;
  age: number | null;
  bio: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SkillMatchResult {
  user: MatchingUser;
  distance?: number;
  skills_can_teach: (Tables<'user_skills'> & {
    skill?: Tables<'skills'> & { category?: Tables<'skill_categories'> };
    badge?: Tables<'skill_badges'>;
  })[];
  skills_want_to_learn: (Tables<'user_skill_wants'> & {
    skill?: Tables<'skills'> & { category?: Tables<'skill_categories'> };
  })[];
  is_mutual_match: boolean;
  matching_teach_skills: string[]; // Skill IDs they can teach that you want
  matching_learn_skills: string[]; // Skill IDs you can teach that they want
}

// Calculate distance between two coordinates in km
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface UseSkillMatchingOptions {
  maxDistance?: number; // km
  categoryFilter?: string;
}

export function useSkillMatching(options: UseSkillMatchingOptions = {}) {
  const { maxDistance = 50, categoryFilter } = options;

  const [matches, setMatches] = useState<SkillMatchResult[]>([]);
  const [canTeachMatches, setCanTeachMatches] = useState<SkillMatchResult[]>([]);
  const [wantToLearnMatches, setWantToLearnMatches] = useState<SkillMatchResult[]>([]);
  const [mutualMatches, setMutualMatches] = useState<SkillMatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);
  const currentUserLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    loadMatches();

    return () => {
      mountedRef.current = false;
    };
  }, [maxDistance, categoryFilter]);

  const loadMatches = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      currentUserIdRef.current = user.id;

      // Get current user's profile for location
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', user.id)
        .single();

      if (myProfile?.latitude && myProfile?.longitude) {
        currentUserLocationRef.current = {
          lat: myProfile.latitude,
          lng: myProfile.longitude,
        };
      }

      // Get my skills I can teach
      const { data: mySkills } = await supabase
        .from('user_skills')
        .select('skill_id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const mySkillIds = mySkills?.map(s => s.skill_id) || [];

      // Get skills I want to learn
      const { data: myWants } = await supabase
        .from('user_skill_wants')
        .select('skill_id')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const myWantIds = myWants?.map(s => s.skill_id) || [];

      if (mySkillIds.length === 0 && myWantIds.length === 0) {
        if (mountedRef.current) {
          setMatches([]);
          setCanTeachMatches([]);
          setWantToLearnMatches([]);
          setMutualMatches([]);
        }
        return;
      }

      // Find users who can teach skills I want
      let canTeachQuery = supabase
        .from('user_skills')
        .select(`
          *,
          skill:skills(*, category:skill_categories(*)),
          user:profiles!user_skills_user_id_fkey(id, name, photos, age, bio, latitude, longitude)
        `)
        .in('skill_id', myWantIds.length > 0 ? myWantIds : ['no-match'])
        .eq('is_active', true)
        .neq('user_id', user.id);

      if (categoryFilter) {
        canTeachQuery = canTeachQuery.eq('skill.category_id', categoryFilter);
      }

      const { data: teachersData } = await canTeachQuery;

      // Find users who want to learn skills I can teach
      let wantToLearnQuery = supabase
        .from('user_skill_wants')
        .select(`
          *,
          skill:skills(*, category:skill_categories(*)),
          user:profiles!user_skill_wants_user_id_fkey(id, name, photos, age, bio, latitude, longitude)
        `)
        .in('skill_id', mySkillIds.length > 0 ? mySkillIds : ['no-match'])
        .eq('is_active', true)
        .neq('user_id', user.id);

      if (categoryFilter) {
        wantToLearnQuery = wantToLearnQuery.eq('skill.category_id', categoryFilter);
      }

      const { data: learnersData } = await wantToLearnQuery;

      // Get badges for teachers
      const teacherIds = [...new Set(teachersData?.map(t => t.user_id) || [])];
      const { data: badges } = await supabase
        .from('skill_badges')
        .select('*')
        .in('user_id', teacherIds.length > 0 ? teacherIds : ['no-match']);

      // Group by user
      const userSkillsMap = new Map<string, SkillMatchResult>();

      // Process teachers (can teach skills I want)
      teachersData?.forEach(item => {
        const userId = item.user_id;
        if (!userId || !item.user) return;

        let match = userSkillsMap.get(userId);
        if (!match) {
          const userProfile = item.user as MatchingUser;
          let distance: number | undefined;

          if (currentUserLocationRef.current && userProfile.latitude && userProfile.longitude) {
            distance = calculateDistance(
              currentUserLocationRef.current.lat,
              currentUserLocationRef.current.lng,
              userProfile.latitude,
              userProfile.longitude
            );
          }

          match = {
            user: userProfile,
            distance,
            skills_can_teach: [],
            skills_want_to_learn: [],
            is_mutual_match: false,
            matching_teach_skills: [],
            matching_learn_skills: [],
          };
          userSkillsMap.set(userId, match);
        }

        // Add skill with badge
        const skillBadge = badges?.find(
          b => b.user_id === userId && b.skill_id === item.skill_id
        );

        match.skills_can_teach.push({
          ...item,
          badge: skillBadge,
        });
        match.matching_teach_skills.push(item.skill_id);
      });

      // Process learners (want to learn skills I can teach)
      learnersData?.forEach(item => {
        const userId = item.user_id;
        if (!userId || !item.user) return;

        let match = userSkillsMap.get(userId);
        if (!match) {
          const userProfile = item.user as MatchingUser;
          let distance: number | undefined;

          if (currentUserLocationRef.current && userProfile.latitude && userProfile.longitude) {
            distance = calculateDistance(
              currentUserLocationRef.current.lat,
              currentUserLocationRef.current.lng,
              userProfile.latitude,
              userProfile.longitude
            );
          }

          match = {
            user: userProfile,
            distance,
            skills_can_teach: [],
            skills_want_to_learn: [],
            is_mutual_match: false,
            matching_teach_skills: [],
            matching_learn_skills: [],
          };
          userSkillsMap.set(userId, match);
        }

        match.skills_want_to_learn.push(item);
        match.matching_learn_skills.push(item.skill_id);
      });

      // Check for mutual matches and filter by distance
      const allMatches = Array.from(userSkillsMap.values())
        .map(match => ({
          ...match,
          is_mutual_match:
            match.matching_teach_skills.length > 0 && match.matching_learn_skills.length > 0,
        }))
        .filter(match => !match.distance || match.distance <= maxDistance)
        .sort((a, b) => {
          // Sort by: mutual matches first, then by distance
          if (a.is_mutual_match !== b.is_mutual_match) {
            return a.is_mutual_match ? -1 : 1;
          }
          if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance;
          }
          return 0;
        });

      if (mountedRef.current) {
        setMatches(allMatches);
        setCanTeachMatches(allMatches.filter(m => m.matching_teach_skills.length > 0));
        setWantToLearnMatches(allMatches.filter(m => m.matching_learn_skills.length > 0));
        setMutualMatches(allMatches.filter(m => m.is_mutual_match));
      }
    } catch (error) {
      console.error('Error loading skill matches:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  }, [maxDistance, categoryFilter]);

  // Fetch detailed user skills for a specific user
  const fetchUserSkillDetails = useCallback(async (userId: string) => {
    try {
      // Fetch user's teaching skills
      const { data: skillsData } = await supabase
        .from('user_skills')
        .select(`
          *,
          skill:skills(*, category:skill_categories(*))
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      // Fetch user's skill wants
      const { data: wantsData } = await supabase
        .from('user_skill_wants')
        .select(`
          *,
          skill:skills(*, category:skill_categories(*))
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      // Fetch user's badges
      const { data: badgesData } = await supabase
        .from('skill_badges')
        .select('*')
        .eq('user_id', userId);

      // Merge badges with skills
      const skillsWithBadges = (skillsData || []).map(skill => ({
        ...skill,
        badge: badgesData?.find(b => b.skill_id === skill.skill_id),
      }));

      return {
        skills: skillsWithBadges,
        skillWants: wantsData || [],
        badges: badgesData || [],
      };
    } catch (error) {
      console.error('Error fetching user skill details:', error);
      return { skills: [], skillWants: [], badges: [] };
    }
  }, []);

  return {
    // All matches
    matches,
    // Filtered lists
    canTeachMatches,     // Users who can teach skills I want
    wantToLearnMatches,  // Users who want to learn skills I can teach
    mutualMatches,       // Users where we can teach each other
    // Loading states
    loading,
    refreshing,
    // Actions
    refresh,
    fetchUserSkillDetails,
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../integrations/supabase/client';
import { Tables } from '../integrations/supabase/types';
import {
  Skill,
  SkillCategory,
  UserSkill,
  UserSkillWant,
  SkillBadge,
  SkillLevelId,
} from '../constants/skillTypes';

// Extended types with joined data
export type SkillWithCategory = Tables<'skills'> & {
  category?: Tables<'skill_categories'>;
};

export type UserSkillWithDetails = Tables<'user_skills'> & {
  skill?: SkillWithCategory;
  badge?: Tables<'skill_badges'>;
};

export type UserSkillWantWithDetails = Tables<'user_skill_wants'> & {
  skill?: SkillWithCategory;
};

interface AddSkillData {
  skill_id: string;
  level: SkillLevelId;
  description?: string;
}

interface AddSkillWantData {
  skill_id: string;
  description?: string;
}

export function useSkills() {
  // Categories and skills from database
  const [categories, setCategories] = useState<Tables<'skill_categories'>[]>([]);
  const [allSkills, setAllSkills] = useState<SkillWithCategory[]>([]);

  // User's skills
  const [mySkills, setMySkills] = useState<UserSkillWithDetails[]>([]);
  const [mySkillWants, setMySkillWants] = useState<UserSkillWantWithDetails[]>([]);
  const [myBadges, setMyBadges] = useState<Tables<'skill_badges'>[]>([]);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadCategoriesAndSkills();
    loadUserSkills();
    setupRealtimeSubscription();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load categories and skills from database
  const loadCategoriesAndSkills = async () => {
    try {
      setLoadingCategories(true);

      // Fetch categories
      const { data: categoriesData, error: catError } = await supabase
        .from('skill_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (catError) throw catError;

      // Fetch all skills
      const { data: skillsData, error: skillsError } = await supabase
        .from('skills')
        .select('*, category:skill_categories(*)');

      if (skillsError) throw skillsError;

      if (mountedRef.current) {
        setCategories(categoriesData || []);
        setAllSkills(skillsData || []);
      }
    } catch (error) {
      console.error('Error loading categories and skills:', error);
    } finally {
      if (mountedRef.current) {
        setLoadingCategories(false);
      }
    }
  };

  // Load user's skills, wants, and badges
  const loadUserSkills = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's teaching skills with skill details and badges
      const { data: skillsData, error: skillsError } = await supabase
        .from('user_skills')
        .select(`
          *,
          skill:skills(*, category:skill_categories(*))
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (skillsError) throw skillsError;

      // Fetch user's skill wants
      const { data: wantsData, error: wantsError } = await supabase
        .from('user_skill_wants')
        .select(`
          *,
          skill:skills(*, category:skill_categories(*))
        `)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (wantsError) throw wantsError;

      // Fetch user's badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('skill_badges')
        .select('*')
        .eq('user_id', user.id);

      if (badgesError) throw badgesError;

      if (mountedRef.current) {
        // Merge badges with skills
        const skillsWithBadges = (skillsData || []).map(skill => ({
          ...skill,
          badge: badgesData?.find(b => b.skill_id === skill.skill_id),
        }));

        setMySkills(skillsWithBadges);
        setMySkillWants(wantsData || []);
        setMyBadges(badgesData || []);
      }
    } catch (error) {
      console.error('Error loading user skills:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Setup realtime subscription
  const setupRealtimeSubscription = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const subscription = supabase
      .channel(`user_skills_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_skills',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        if (mountedRef.current) {
          loadUserSkills();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_skill_wants',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        if (mountedRef.current) {
          loadUserSkills();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'skill_badges',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        if (mountedRef.current) {
          loadUserSkills();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  // Refresh data
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserSkills();
    setRefreshing(false);
  }, []);

  // Add a skill I can teach
  const addSkill = useCallback(async (data: AddSkillData): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to add skills');
        return false;
      }

      // Check if already exists
      const existing = mySkills.find(s => s.skill_id === data.skill_id);
      if (existing) {
        Alert.alert('Info', 'You already have this skill added');
        return false;
      }

      const { error } = await supabase
        .from('user_skills')
        .insert({
          user_id: user.id,
          skill_id: data.skill_id,
          level: data.level,
          description: data.description || null,
        });

      if (error) throw error;

      await loadUserSkills();
      return true;
    } catch (error: any) {
      console.error('Error adding skill:', error);
      Alert.alert('Error', error.message || 'Failed to add skill');
      return false;
    }
  }, [mySkills]);

  // Update a skill I can teach
  const updateSkill = useCallback(async (
    skillId: string,
    data: { level?: SkillLevelId; description?: string }
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('user_skills')
        .update({
          level: data.level,
          description: data.description,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('skill_id', skillId);

      if (error) throw error;

      await loadUserSkills();
      return true;
    } catch (error: any) {
      console.error('Error updating skill:', error);
      Alert.alert('Error', error.message || 'Failed to update skill');
      return false;
    }
  }, []);

  // Remove a skill I can teach
  const removeSkill = useCallback(async (skillId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('user_skills')
        .delete()
        .eq('user_id', user.id)
        .eq('skill_id', skillId);

      if (error) throw error;

      await loadUserSkills();
      return true;
    } catch (error: any) {
      console.error('Error removing skill:', error);
      Alert.alert('Error', error.message || 'Failed to remove skill');
      return false;
    }
  }, []);

  // Add a skill I want to learn
  const addSkillWant = useCallback(async (data: AddSkillWantData): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to add skills');
        return false;
      }

      // Check if already exists
      const existing = mySkillWants.find(s => s.skill_id === data.skill_id);
      if (existing) {
        Alert.alert('Info', 'You already want to learn this skill');
        return false;
      }

      const { error } = await supabase
        .from('user_skill_wants')
        .insert({
          user_id: user.id,
          skill_id: data.skill_id,
          description: data.description || null,
        });

      if (error) throw error;

      await loadUserSkills();
      return true;
    } catch (error: any) {
      console.error('Error adding skill want:', error);
      Alert.alert('Error', error.message || 'Failed to add skill');
      return false;
    }
  }, [mySkillWants]);

  // Update a skill I want to learn
  const updateSkillWant = useCallback(async (
    skillId: string,
    data: { description?: string }
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('user_skill_wants')
        .update({
          description: data.description,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('skill_id', skillId);

      if (error) throw error;

      await loadUserSkills();
      return true;
    } catch (error: any) {
      console.error('Error updating skill want:', error);
      Alert.alert('Error', error.message || 'Failed to update skill');
      return false;
    }
  }, []);

  // Remove a skill I want to learn
  const removeSkillWant = useCallback(async (skillId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('user_skill_wants')
        .delete()
        .eq('user_id', user.id)
        .eq('skill_id', skillId);

      if (error) throw error;

      await loadUserSkills();
      return true;
    } catch (error: any) {
      console.error('Error removing skill want:', error);
      Alert.alert('Error', error.message || 'Failed to remove skill');
      return false;
    }
  }, []);

  // Get skills by category
  const getSkillsByCategory = useCallback((categoryId: string) => {
    return allSkills.filter(s => s.category_id === categoryId);
  }, [allSkills]);

  // Get skill by ID
  const getSkillById = useCallback((skillId: string) => {
    return allSkills.find(s => s.id === skillId);
  }, [allSkills]);

  // Fetch skills for a specific user (for viewing other profiles)
  const fetchUserSkills = useCallback(async (userId: string) => {
    try {
      // Fetch user's teaching skills
      const { data: skillsData, error: skillsError } = await supabase
        .from('user_skills')
        .select(`
          *,
          skill:skills(*, category:skill_categories(*))
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (skillsError) throw skillsError;

      // Fetch user's skill wants
      const { data: wantsData, error: wantsError } = await supabase
        .from('user_skill_wants')
        .select(`
          *,
          skill:skills(*, category:skill_categories(*))
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (wantsError) throw wantsError;

      // Fetch user's badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('skill_badges')
        .select('*')
        .eq('user_id', userId);

      if (badgesError) throw badgesError;

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
      console.error('Error fetching user skills:', error);
      return { skills: [], skillWants: [], badges: [] };
    }
  }, []);

  return {
    // Data
    categories,
    allSkills,
    mySkills,
    mySkillWants,
    myBadges,

    // Loading states
    loading,
    loadingCategories,
    refreshing,

    // Actions
    refresh,
    addSkill,
    updateSkill,
    removeSkill,
    addSkillWant,
    updateSkillWant,
    removeSkillWant,

    // Helpers
    getSkillsByCategory,
    getSkillById,
    fetchUserSkills,
  };
}

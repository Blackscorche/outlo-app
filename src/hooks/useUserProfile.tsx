
import { useState, useEffect } from 'react';
import { User } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';

export const useUserProfile = (user: SupabaseUser | null, userLocation: { lat: number; lng: number }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const grantVipIfFemale = async (userId: string, gender: string) => {
    if (gender === 'female') {
      try {
        console.log('Triggering VIP grant for female user:', userId);
        await supabase.functions.invoke('auto-grant-vip', {
          body: { record: { id: userId, gender: gender } }
        });
        
        // Also force a subscription check after granting VIP
        console.log('VIP granted, checking subscription status...');
        
        // Wait a moment for the VIP grant to process
        setTimeout(async () => {
          const { data: subscriptionData } = await supabase
            .from('subscribers')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          console.log('Subscription status after VIP grant:', subscriptionData);
        }, 1000);
        
      } catch (vipError) {
        console.error('Error granting VIP privileges:', vipError);
        // Don't fail the operation if VIP granting fails
      }
    }
  };

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        // Fallback to basic user data if profile doesn't exist
        const fallbackGender = (user.user_metadata?.gender === 'male' || user.user_metadata?.gender === 'female') 
          ? user.user_metadata.gender as 'male' | 'female' 
          : 'female';
        
        const fallbackUser: User = {
          id: user.id,
          name: user.user_metadata?.name || 'User',
          age: user.user_metadata?.age || 25,
          bio: 'Love exploring new places and meeting interesting people!',
          photos: ['/placeholder.svg'],
          interests: ['Travel', 'Coffee', 'Photography'],
          location: userLocation,
          isOnline: true,
          distance: 0,
          gender: fallbackGender,
          lookingFor: user.user_metadata?.lookingFor || 'everyone',
          occupation: user.user_metadata?.occupation,
          education: user.user_metadata?.education,
          jobTitle: user.user_metadata?.jobTitle,
          company: user.user_metadata?.company,
          school: user.user_metadata?.school,
          maxDistance: 25,
          ageRangeMin: 18,
          ageRangeMax: 35,
          relationshipGoals: user.user_metadata?.relationshipGoals,
          livingIn: user.user_metadata?.livingIn
        };
        
        setCurrentUser(fallbackUser);
        
        // Grant VIP if female user (for new/fallback users)
        await grantVipIfFemale(user.id, fallbackUser.gender);
      } else {
        // Convert database profile to User type with proper type checking
        const profileGender = (profile.gender === 'male' || profile.gender === 'female') ? profile.gender as 'male' | 'female' : 'female';
        const profileLookingFor = ['men', 'women', 'everyone'].includes(profile.looking_for) 
          ? profile.looking_for as 'men' | 'women' | 'everyone' 
          : 'everyone';

        const profileUser: User = {
          id: profile.id,
          name: profile.name,
          age: profile.age,
          bio: profile.bio || '',
          photos: profile.photos || ['/placeholder.svg'],
          interests: profile.interests || [],
          location: userLocation,
          isOnline: profile.is_online || true,
          distance: 0,
          gender: profileGender,
          lookingFor: profileLookingFor,
          occupation: profile.occupation || undefined,
          education: profile.education || undefined,
          jobTitle: profile.job_title || undefined,
          company: profile.company || undefined,
          school: profile.school || undefined,
          maxDistance: profile.max_distance || 25,
          ageRangeMin: profile.age_range_min || 18,
          ageRangeMax: profile.age_range_max || 35,
          relationshipGoals: (profile as any).relationship_goals || undefined,
          livingIn: (profile as any).living_in || undefined
        };

        setCurrentUser(profileUser);
        
        // Grant VIP if female user (for existing users) - this will trigger every time profile loads
        await grantVipIfFemale(user.id, profileGender);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  const saveUserProfile = async (updatedUser: User) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: updatedUser.name,
          age: updatedUser.age,
          bio: updatedUser.bio,
          photos: updatedUser.photos,
          interests: updatedUser.interests,
          gender: updatedUser.gender,
          looking_for: updatedUser.lookingFor,
          occupation: updatedUser.occupation,
          education: updatedUser.education,
          job_title: updatedUser.jobTitle,
          company: updatedUser.company,
          school: updatedUser.school,
          max_distance: updatedUser.maxDistance,
          age_range_min: updatedUser.ageRangeMin,
          age_range_max: updatedUser.ageRangeMax,
          relationship_goals: updatedUser.relationshipGoals,
          living_in: updatedUser.livingIn
        });

      if (error) {
        console.error('Error saving profile:', error);
      } else {
        // Grant VIP if female user
        await grantVipIfFemale(user.id, updatedUser.gender);
      }
    } catch (err) {
      console.error('Error saving user profile:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user, userLocation]);

  return {
    currentUser,
    setCurrentUser,
    saveUserProfile
  };
};


import { useState, useEffect } from 'react';
import { User } from '@/types';

interface UseOnboardingProps {
  currentUser: User | null;
  isInitializing: boolean;
}

export const useOnboarding = ({ currentUser, isInitializing }: UseOnboardingProps) => {
  const [showLocationOnboarding, setShowLocationOnboarding] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  // Check if user needs onboarding
  useEffect(() => {
    if (currentUser && !hasCompletedOnboarding && !isInitializing) {
      // Check if this is the user's first time (no saved location preference)
      const hasLocationPreference = localStorage.getItem('locationSharingEnabled') !== null;
      const needsLocationSetup = !hasLocationPreference;
      const needsProfileSetup = !currentUser.lookingFor || currentUser.maxDistance === undefined;
      
      if (needsLocationSetup) {
        setShowLocationOnboarding(true);
      } else if (needsProfileSetup) {
        setShowProfileSetup(true);
      } else {
        setHasCompletedOnboarding(true);
      }
    }
  }, [currentUser, hasCompletedOnboarding, isInitializing]);

  return {
    showLocationOnboarding,
    setShowLocationOnboarding,
    showProfileSetup,
    setShowProfileSetup,
    hasCompletedOnboarding,
    setHasCompletedOnboarding
  };
};

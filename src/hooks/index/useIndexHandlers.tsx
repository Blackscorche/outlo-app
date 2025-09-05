import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/types';

interface UseIndexHandlersProps {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  saveUserProfile: (user: User) => void;
  setShowLocationOnboarding: (show: boolean) => void;
  setShowProfileSetup: (show: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  setShowOwnProfile: (show: boolean) => void;
  setLocationEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setIsVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
}

export const useIndexHandlers = ({
  currentUser,
  setCurrentUser,
  saveUserProfile,
  setShowLocationOnboarding,
  setShowProfileSetup,
  setHasCompletedOnboarding,
  setShowOwnProfile,
  setLocationEnabled,
  setIsVisible
}: UseIndexHandlersProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLocationOnboardingComplete = (locationEnabled: boolean) => {
    setShowLocationOnboarding(false);
    if (locationEnabled) {
      setLocationEnabled(true);
      toast({
        title: "Welcome! 🎉",
        description: "You can now see and be seen by other users nearby",
      });
    }
    
    // Check if profile setup is needed
    if (currentUser && (!currentUser.lookingFor || currentUser.maxDistance === undefined)) {
      setShowProfileSetup(true);
    } else {
      setHasCompletedOnboarding(true);
    }
  };

  const handleLocationOnboardingSkip = () => {
    setShowLocationOnboarding(false);
    // Save the skip choice as false preference
    setLocationEnabled(false);
    
    if (currentUser && (!currentUser.lookingFor || currentUser.maxDistance === undefined)) {
      setShowProfileSetup(true);
    } else {
      setHasCompletedOnboarding(true);
    }
  };

  const handleProfileSetupComplete = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    saveUserProfile(updatedUser);
    setShowProfileSetup(false);
    setHasCompletedOnboarding(true);
    toast({
      title: "Profile updated!",
      description: "Your preferences have been saved",
    });
  };

  const handleProfileSetupSkip = () => {
    setShowProfileSetup(false);
    setHasCompletedOnboarding(true);
  };

  const handleProfileSave = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    setShowOwnProfile(false);
    saveUserProfile(updatedUser);
  };

  const handleLocationToggle = () => {
    setLocationEnabled(prev => !prev);
  };

  const handleVisibilityToggle = () => {
    setIsVisible(prev => !prev);
  };

  const handleNavigationChatClick = () => {
    navigate('/chat');
  };

  const handleNavigationConnectionsClick = () => {
    navigate('/connections');
  };

  const handleNavigationProfileClick = () => {
    setShowOwnProfile(true);
  };

  return {
    handleLocationOnboardingComplete,
    handleLocationOnboardingSkip,
    handleProfileSetupComplete,
    handleProfileSetupSkip,
    handleProfileSave,
    handleLocationToggle,
    handleVisibilityToggle,
    handleNavigationChatClick,
    handleNavigationConnectionsClick,
    handleNavigationProfileClick
  };
};

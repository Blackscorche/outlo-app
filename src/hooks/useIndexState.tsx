import { useState } from 'react';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRealtimeUsers } from '@/hooks/useRealtimeUsers';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useUserInteractions } from '@/hooks/useUserInteractions';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { useIndexAuth } from '@/hooks/index/useIndexAuth';
import { useIndexEffects } from '@/hooks/index/useIndexEffects';
import { useIndexHandlers } from '@/hooks/index/useIndexHandlers';

export const useIndexState = () => {
  const { user, loading, isInitializing } = useIndexAuth();
  const [mapBearing, setMapBearing] = useState<number>(0);
  const [compassEnabled, setCompassEnabled] = useState<boolean>(true);
  const { userLocation, isVisible, setIsVisible, locationEnabled, setLocationEnabled, hasRealLocation } = useUserLocation(compassEnabled ? setMapBearing : undefined);
  const { currentUser, setCurrentUser, saveUserProfile } = useUserProfile(user, userLocation);
  const realtimeUsers = useRealtimeUsers(userLocation, locationEnabled);

  const [showOwnProfile, setShowOwnProfile] = useState(false);

  // Keep screen awake whenever user is logged in and app is not initializing
  // This ensures the screen stays on even if they're just looking at the map without interacting
  const shouldKeepAwake = !!user && !isInitializing;
  useScreenWakeLock(shouldKeepAwake);

  const {
    showLocationOnboarding,
    setShowLocationOnboarding,
    showProfileSetup,
    setShowProfileSetup,
    hasCompletedOnboarding,
    setHasCompletedOnboarding
  } = useOnboarding({ currentUser, isInitializing });

  const {
    selectedUser,
    showOtherUserProfile,
    handleUserSelect,
    handleConnect,
    handleChat,
    handleChatWithUser,
    handleCloseOtherUserProfile
  } = useUserInteractions(isVisible);

  const handlers = useIndexHandlers({
    currentUser,
    setCurrentUser,
    saveUserProfile,
    setShowLocationOnboarding,
    setShowProfileSetup,
    setHasCompletedOnboarding,
    setShowOwnProfile,
    setLocationEnabled,
    setIsVisible
  });

  // Initialize effects
  useIndexEffects({
    user,
    isInitializing,
    locationEnabled,
    setLocationEnabled
  });

  console.log('Index render:', { 
    hasUser: !!user, 
    loading, 
    userEmail: user?.email,
    realtimeUsersCount: realtimeUsers.length,
    locationEnabled,
    hasRealLocation,
    isInitializing,
    shouldKeepAwake
  });

  return {
    // Auth state
    user,
    loading,
    isInitializing,
    
    // Location state
    userLocation,
    isVisible,
    locationEnabled,
    hasRealLocation,
    mapBearing,
    compassEnabled,
    setCompassEnabled,
    
    // User state
    currentUser,
    realtimeUsers,
    
    // Onboarding state
    showLocationOnboarding,
    showProfileSetup,
    hasCompletedOnboarding,
    
    // Modal state
    showOwnProfile,
    setShowOwnProfile,
    selectedUser,
    showOtherUserProfile,
    
    // Event handlers
    handleUserSelect,
    handleConnect,
    handleChat,
    handleChatWithUser,
    handleCloseOtherUserProfile,
    ...handlers
  };
};

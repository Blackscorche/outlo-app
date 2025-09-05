
import { useState, useEffect } from 'react';

export interface DatingPreferences {
  maxDistance: number;
  minAge: number;
  maxAge: number;
  showOnlineOnly: boolean;
  showRecentlyActive: boolean;
  hideSeenProfiles: boolean;
  profileVisibility: 'everyone' | 'connections';
}

const defaultPreferences: DatingPreferences = {
  maxDistance: 50,
  minAge: 18,
  maxAge: 50,
  showOnlineOnly: false,
  showRecentlyActive: true,
  hideSeenProfiles: false,
  profileVisibility: 'everyone',
};

export const useDatingPreferences = () => {
  const [preferences, setPreferences] = useState<DatingPreferences>(defaultPreferences);

  useEffect(() => {
    const savedPreferences = localStorage.getItem('datingPreferences');
    if (savedPreferences) {
      try {
        setPreferences(JSON.parse(savedPreferences));
      } catch (error) {
        console.error('Error parsing dating preferences:', error);
        setPreferences(defaultPreferences);
      }
    }
  }, []);

  const updatePreferences = (newPreferences: Partial<DatingPreferences>) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    localStorage.setItem('datingPreferences', JSON.stringify(updated));
  };

  const resetPreferences = () => {
    setPreferences(defaultPreferences);
    localStorage.setItem('datingPreferences', JSON.stringify(defaultPreferences));
  };

  return {
    preferences,
    updatePreferences,
    resetPreferences,
  };
};

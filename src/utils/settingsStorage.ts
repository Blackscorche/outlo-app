import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for settings persistence
export const SETTINGS_STORAGE_KEYS = {
  LOCATION_ENABLED: '@outlo_location_enabled',
  VISIBILITY: '@outlo_visibility',
  KEEP_SCREEN_ON: '@outlo_keep_screen_on',
  FILTERS: '@outlo_filters',
  LAST_SETTINGS_SYNC: '@outlo_last_settings_sync',
} as const;

// Interface for stored settings
export interface StoredSettings {
  isLocationEnabled?: boolean;
  isVisible?: boolean;
  keepScreenOn?: boolean;
  activeFilters?: {
    gender: 'all' | 'male' | 'female';
    ageRange: [number, number];
    distance: number;
  };
  lastSync?: string;
}

/**
 * Load all settings from AsyncStorage
 * This ensures settings persist across app restarts
 */
export const loadStoredSettings = async (): Promise<StoredSettings> => {
  try {
    console.log('📱 Loading stored settings from AsyncStorage...');

    const keys = Object.values(SETTINGS_STORAGE_KEYS);
    const values = await AsyncStorage.multiGet(keys);

    const storedSettings: StoredSettings = {};

    for (const [key, value] of values) {
      if (value !== null) {
        try {
          switch (key) {
            case SETTINGS_STORAGE_KEYS.LOCATION_ENABLED:
              storedSettings.isLocationEnabled = JSON.parse(value);
              break;
            case SETTINGS_STORAGE_KEYS.VISIBILITY:
              storedSettings.isVisible = JSON.parse(value);
              break;
            case SETTINGS_STORAGE_KEYS.KEEP_SCREEN_ON:
              storedSettings.keepScreenOn = JSON.parse(value);
              break;
            case SETTINGS_STORAGE_KEYS.FILTERS:
              storedSettings.activeFilters = JSON.parse(value);
              break;
            case SETTINGS_STORAGE_KEYS.LAST_SETTINGS_SYNC:
              storedSettings.lastSync = value;
              break;
          }
        } catch (parseError) {
          console.warn(`Failed to parse stored setting for key ${key}:`, parseError);
        }
      }
    }

    console.log('📱 Loaded stored settings:', storedSettings);
    return storedSettings;
  } catch (error) {
    console.error('Error loading stored settings:', error);
    return {};
  }
};

/**
 * Save settings to AsyncStorage
 * This ensures settings persist across app restarts
 */
export const saveSettingsToStorage = async (settings: Partial<StoredSettings>): Promise<void> => {
  try {
    const saveOperations: Array<[string, string]> = [];

    if (settings.isLocationEnabled !== undefined) {
      saveOperations.push([
        SETTINGS_STORAGE_KEYS.LOCATION_ENABLED,
        JSON.stringify(settings.isLocationEnabled)
      ]);
    }

    if (settings.isVisible !== undefined) {
      saveOperations.push([
        SETTINGS_STORAGE_KEYS.VISIBILITY,
        JSON.stringify(settings.isVisible)
      ]);
    }

    if (settings.keepScreenOn !== undefined) {
      saveOperations.push([
        SETTINGS_STORAGE_KEYS.KEEP_SCREEN_ON,
        JSON.stringify(settings.keepScreenOn)
      ]);
    }

    if (settings.activeFilters !== undefined) {
      saveOperations.push([
        SETTINGS_STORAGE_KEYS.FILTERS,
        JSON.stringify(settings.activeFilters)
      ]);
    }

    // Always update last sync timestamp
    saveOperations.push([
      SETTINGS_STORAGE_KEYS.LAST_SETTINGS_SYNC,
      new Date().toISOString()
    ]);

    await AsyncStorage.multiSet(saveOperations);
    console.log('📱 Settings saved to storage:', settings);
  } catch (error) {
    console.error('Error saving settings to storage:', error);
    throw error;
  }
};

/**
 * Clear all stored settings (useful for logout or reset)
 */
export const clearStoredSettings = async (): Promise<void> => {
  try {
    const keys = Object.values(SETTINGS_STORAGE_KEYS);
    await AsyncStorage.multiRemove(keys);
    console.log('📱 All stored settings cleared');
  } catch (error) {
    console.error('Error clearing stored settings:', error);
    throw error;
  }
};

/**
 * Check if settings need to be synced with database
 * Based on last sync timestamp
 */
export const shouldSyncSettings = async (maxAgeMinutes: number = 60): Promise<boolean> => {
  try {
    const lastSync = await AsyncStorage.getItem(SETTINGS_STORAGE_KEYS.LAST_SETTINGS_SYNC);

    if (!lastSync) {
      return true; // No sync timestamp, need to sync
    }

    const lastSyncDate = new Date(lastSync);
    const now = new Date();
    const ageMinutes = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60);

    return ageMinutes > maxAgeMinutes;
  } catch (error) {
    console.error('Error checking sync status:', error);
    return true; // On error, assume we need to sync
  }
};
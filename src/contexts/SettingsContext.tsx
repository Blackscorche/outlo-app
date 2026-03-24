import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { supabase } from "../integrations/supabase/client";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import subscriptionService from "../services/subscriptionService";
import { Alert } from "react-native";

interface SettingsState {
  isLocationEnabled: boolean;
  isVisible: boolean;
  visibleUntil: string | null;
  keepScreenOn: boolean;
  activeFilters: {
    gender: "all" | "male" | "female";
    ageRange: [number, number];
    distance: number;
  };
  location: Location.LocationObject | null;
}

// interface SettingsContextType {
//   settings: SettingsState;
//   updateLocationEnabled: (enabled: boolean) => Promise<void>;
//   updateVisibility: (visible: boolean) => Promise<void>;
//   updateKeepScreenOn: (enabled: boolean) => Promise<void>;
//   updateFilters: (filters: any) => Promise<void>;
//   setLocation: (location: Location.LocationObject | null) => void;
//   loadUserSettings: () => Promise<void>;
//   loadLocalSettings: () => Promise<void>;
//   saveLocalSettings: (partialSettings: Partial<SettingsState>) => Promise<void>;
// }

interface SettingsContextType {
  settings: SettingsState;
  updateLocationEnabled: (enabled: boolean) => Promise<void>;
  startManualCheckIn: (durationMinutes?: number) => Promise<void>;
  endManualCheckIn: () => Promise<void>;
  updateKeepScreenOn: (enabled: boolean) => Promise<void>;
  updateFilters: (filters: any) => Promise<void>;
  setLocation: (location: Location.LocationObject | null) => void;
  loadUserSettings: () => Promise<void>;
  loadLocalSettings: () => Promise<void>;
  saveLocalSettings: (partialSettings: Partial<SettingsState>) => Promise<void>;
}

// AsyncStorage keys for persistent settings
const STORAGE_KEYS = {
  SETTINGS: "@lovemap_settings",
  LOCATION_ENABLED: "@lovemap_location_enabled",
  // VISIBILITY: "@lovemap_visibility",
  KEEP_SCREEN_ON: "@lovemap_keep_screen_on",
  FILTERS: "@lovemap_filters",
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
}) => {
  const [settings, setSettings] = useState<SettingsState>({
    isLocationEnabled: false,
    isVisible: false,
    visibleUntil: null,
    keepScreenOn: true,
    activeFilters: {
      gender: "all",
      ageRange: [18, 50],
      distance: 50,
    },
    location: null,
  });

  // Load settings from local storage (AsyncStorage)
  const loadLocalSettings = async () => {
    try {
      console.log("🔧 Loading settings from local storage...");

      const [locationEnabled, keepScreenOn, filters] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.LOCATION_ENABLED),
        // AsyncStorage.getItem(STORAGE_KEYS.VISIBILITY),
        AsyncStorage.getItem(STORAGE_KEYS.KEEP_SCREEN_ON),
        AsyncStorage.getItem(STORAGE_KEYS.FILTERS),
      ]);

      // Parse and apply stored settings
      const storedSettings: Partial<SettingsState> = {};

      if (locationEnabled !== null) {
        storedSettings.isLocationEnabled = JSON.parse(locationEnabled);
      }

      // if (visibility !== null) {
      //   storedSettings.isVisible = JSON.parse(visibility);
      // }

      if (keepScreenOn !== null) {
        storedSettings.keepScreenOn = JSON.parse(keepScreenOn);
      }

      if (filters !== null) {
        storedSettings.activeFilters = JSON.parse(filters);
      }

      // Update settings state with stored values
      if (Object.keys(storedSettings).length > 0) {
        setSettings((prev) => ({
          ...prev,
          ...storedSettings,
        }));
        console.log("🔧 Loaded settings from storage:", storedSettings);
      }
    } catch (error) {
      console.error("Error loading settings from local storage:", error);
    }
  };

  // Save settings to local storage
  const saveLocalSettings = async (partialSettings: Partial<SettingsState>) => {
    try {
      const savePromises: Promise<void>[] = [];

      if (partialSettings.isLocationEnabled !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(
            STORAGE_KEYS.LOCATION_ENABLED,
            JSON.stringify(partialSettings.isLocationEnabled),
          ),
        );
      }

      // if (partialSettings.isVisible !== undefined) {
      //   savePromises.push(
      //     AsyncStorage.setItem(
      //       STORAGE_KEYS.VISIBILITY,
      //       JSON.stringify(partialSettings.isVisible),
      //     ),
      //   );
      // }

      if (partialSettings.keepScreenOn !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(
            STORAGE_KEYS.KEEP_SCREEN_ON,
            JSON.stringify(partialSettings.keepScreenOn),
          ),
        );
      }

      if (partialSettings.activeFilters !== undefined) {
        savePromises.push(
          AsyncStorage.setItem(
            STORAGE_KEYS.FILTERS,
            JSON.stringify(partialSettings.activeFilters),
          ),
        );
      }

      await Promise.all(savePromises);
      console.log("🔧 Settings saved to local storage:", partialSettings);
    } catch (error) {
      console.error("Error saving settings to local storage:", error);
    }
  };

  const loadUserSettings = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "is_visible, show_on_map, visible_until, gender_preference, min_age, max_age, max_distance, current_latitude, current_longitude",
        )
        .eq("id", authData.user.id)
        .single();

      if (profile) {
        const now = new Date();
        const stillVisible =
          !!profile.visible_until && new Date(profile.visible_until) > now;

        setSettings((prev) => ({
          ...prev,
          isVisible: stillVisible && profile.show_on_map === true,
          visibleUntil: stillVisible ? profile.visible_until : null,
          activeFilters: {
            gender:
              profile.gender_preference === "Everyone"
                ? "all"
                : profile.gender_preference === "Men"
                  ? "male"
                  : "female",
            ageRange: [profile.min_age || 18, profile.max_age || 50],
            distance: profile.max_distance || 50,
          },
        }));

        if (!stillVisible && (profile.is_visible || profile.show_on_map)) {
          await supabase
            .from("profiles")
            .update({
              is_visible: false,
              show_on_map: false,
              visible_until: null,
            })
            .eq("id", authData.user.id);
        }
      }
    } catch (error) {
      console.error("Error loading user settings:", error);
    }
  };

  const updateLocationEnabled = async (enabled: boolean) => {
    try {
      setSettings((prev) => ({ ...prev, isLocationEnabled: enabled }));

      // Save to local storage for persistence
      await saveLocalSettings({ isLocationEnabled: enabled });

      if (!enabled) {
        // Clear location when disabled
        setSettings((prev) => ({ ...prev, location: null }));

        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          await supabase
            .from("profiles")
            .update({
              current_latitude: null,
              current_longitude: null,
            })
            .eq("id", authData.user.id);
        }
      } else {
        // Re-enable location tracking
        try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            // User declined location permission - this is allowed
            // App should still function without location access
            console.log(
              "📍 Location permission declined by user - app continues without location",
            );
            setSettings((prev) => ({ ...prev, isLocationEnabled: false }));
            throw new Error(
              "Location permission is required to enable location sharing. You can still use other app features without location access.",
            );
          }

          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          setSettings((prev) => ({ ...prev, location: currentLocation }));

          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            await supabase
              .from("profiles")
              .update({
                current_latitude: currentLocation.coords.latitude,
                current_longitude: currentLocation.coords.longitude,
                last_seen: new Date().toISOString(),
              })
              .eq("id", authData.user.id);
          }
        } catch (locationError) {
          console.error("Error enabling location:", locationError);
          setSettings((prev) => ({ ...prev, isLocationEnabled: false }));
          throw locationError;
        }
      }
    } catch (error) {
      console.error("Error updating location enabled:", error);
      throw error;
    }
  };

  // const updateVisibility = async (visible: boolean) => {
  //   try {
  //     const { data: authData } = await supabase.auth.getUser();
  //     if (!authData?.user) return;

  //     // Check if user has invisible mode permission when trying to go invisible
  //     if (!visible) {
  //       const hasInvisibleMode = await subscriptionService.hasInvisibleMode(
  //         authData.user.id,
  //       );
  //       if (!hasInvisibleMode) {
  //         Alert.alert(
  //           "Premium Feature",
  //           "Invisible mode is a premium feature. Upgrade to Premium or purchase it separately to go invisible.",
  //           [
  //             { text: "Cancel", style: "cancel" },
  //             {
  //               text: "View Plans",
  //               onPress: () => {
  //                 // Navigation to subscription would be handled by the component using this
  //               },
  //             },
  //           ],
  //         );
  //         return;
  //       }
  //     }

  //     setSettings((prev) => ({ ...prev, isVisible: visible }));

  //     // Save to local storage for persistence
  //     await saveLocalSettings({ isVisible: visible });

  //     if (authData?.user) {
  //       if (visible) {
  //         // When turning visibility ON, we need to:
  //         // 1. Set is_visible = true
  //         // 2. Set show_on_map = true
  //         // 3. Update location if we have it
  //         // 4. Set online status

  //         const currentLocation = settings.location;
  //         const updateData: any = {
  //           is_visible: true,
  //           show_on_map: true,
  //           is_online: true,
  //           last_seen: new Date().toISOString(),
  //           location_updated_at: new Date().toISOString(),
  //         };

  //         // Include location if available
  //         if (currentLocation) {
  //           updateData.current_latitude = currentLocation.coords.latitude;
  //           updateData.current_longitude = currentLocation.coords.longitude;
  //         }

  //         await supabase
  //           .from("profiles")
  //           .update(updateData)
  //           .eq("id", authData.user.id);

  //         console.log("🔍 Visibility enabled - user should appear on map");
  //       } else {
  //         // When turning visibility OFF:
  //         // 1. Set is_visible = false
  //         // 2. Set show_on_map = false
  //         // 3. Keep location but hide from map
  //         await supabase
  //           .from("profiles")
  //           .update({
  //             is_visible: false,
  //             show_on_map: false,
  //             last_seen: new Date().toISOString(),
  //           })
  //           .eq("id", authData.user.id);

  //         console.log("🔍 Visibility disabled - user hidden from map");
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Error updating visibility:", error);
  //     // Revert state on error
  //     setSettings((prev) => ({ ...prev, isVisible: !visible }));
  //     throw error;
  //   }
  // };

  const startManualCheckIn = async (durationMinutes: number = 60) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      let currentLocation = settings.location;

      if (!settings.isLocationEnabled || !currentLocation) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          throw new Error("Location permission is required to check in.");
        }

        currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setSettings((prev) => ({
          ...prev,
          isLocationEnabled: true,
          location: currentLocation,
        }));

        await saveLocalSettings({ isLocationEnabled: true });
      }

      const visibleUntilDate = new Date(
        Date.now() + durationMinutes * 60 * 1000,
      );
      const visibleUntil = visibleUntilDate.toISOString();

      await supabase
        .from("profiles")
        .update({
          is_visible: true,
          show_on_map: true,
          visible_until: visibleUntil,
          is_online: true,
          last_seen: new Date().toISOString(),
          location_updated_at: new Date().toISOString(),
          current_latitude: currentLocation.coords.latitude,
          current_longitude: currentLocation.coords.longitude,
        })
        .eq("id", authData.user.id);

      setSettings((prev) => ({
        ...prev,
        isVisible: true,
        visibleUntil,
        location: currentLocation,
      }));
    } catch (error) {
      console.error("Error starting manual check-in:", error);
      throw error;
    }
  };

  const endManualCheckIn = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      await supabase
        .from("profiles")
        .update({
          is_visible: false,
          show_on_map: false,
          visible_until: null,
          last_seen: new Date().toISOString(),
        })
        .eq("id", authData.user.id);

      setSettings((prev) => ({
        ...prev,
        isVisible: false,
        visibleUntil: null,
      }));
    } catch (error) {
      console.error("Error ending manual check-in:", error);
      throw error;
    }
  };

  const updateFilters = async (newFilters: any) => {
    try {
      const updatedFilters = {
        gender: (newFilters.genderPreference === "Men" ? "male" : "female") as
          | "male"
          | "female", // Only male or female now
        ageRange: [18, 100] as [number, number], // Fixed age range
        distance: newFilters.maxDistance as number,
      };

      setSettings((prev) => ({ ...prev, activeFilters: updatedFilters }));

      // Save to local storage for persistence
      await saveLocalSettings({ activeFilters: updatedFilters });

      // Update settings in database
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        await supabase
          .from("profiles")
          .update({
            gender_preference: newFilters.genderPreference,
            min_age: newFilters.minAge,
            max_age: newFilters.maxAge,
            max_distance: newFilters.maxDistance,
          })
          .eq("id", authData.user.id);
      }
    } catch (error) {
      console.error("Error updating filters:", error);
      throw error;
    }
  };

  const setLocation = (location: Location.LocationObject | null) => {
    setSettings((prev) => ({ ...prev, location }));
  };

  const updateKeepScreenOn = async (enabled: boolean) => {
    try {
      setSettings((prev) => ({ ...prev, keepScreenOn: enabled }));

      // Save to local storage for persistence
      await saveLocalSettings({ keepScreenOn: enabled });

      console.log("🔧 Keep screen on setting updated:", enabled);
    } catch (error) {
      console.error("Error updating keep screen on setting:", error);
      throw error;
    }
  };

  useEffect(() => {
    // Load settings on app start
    const initializeSettings = async () => {
      // First load local settings for immediate UI update
      await loadLocalSettings();

      // Then load and sync with database settings
      await loadUserSettings();
    };

    initializeSettings();
  }, []);

  useEffect(() => {
    if (!settings.visibleUntil) return;

    const expiryTime = new Date(settings.visibleUntil).getTime();
    const now = Date.now();
    const timeout = expiryTime - now;

    if (timeout <= 0) {
      endManualCheckIn().catch(console.error);
      return;
    }

    const timer = setTimeout(() => {
      endManualCheckIn().catch(console.error);
    }, timeout);

    return () => clearTimeout(timer);
  }, [settings.visibleUntil]);

  const value: SettingsContextType = {
    settings,
    updateLocationEnabled,
    startManualCheckIn,
    endManualCheckIn,
    updateKeepScreenOn,
    updateFilters,
    setLocation,
    loadUserSettings,
    loadLocalSettings,
    saveLocalSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

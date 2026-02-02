import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Image,
  AppState,
  AppStateStatus,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../integrations/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import MapFilters from '../components/MapFilters';
import NearbyUsersModal from '../components/NearbyUsersModal';
import CheckInDetailModal from '../components/CheckInDetailModal';
import ActivityDetailModal from '../components/ActivityDetailModal';
import { getActivityTag } from '../components/CheckInModal';
import { getActivityType } from '../constants/activityTypes';
import { useSettings } from '../contexts/SettingsContext';
import { useSubscription } from '../hooks/useSubscription';
import { useInAppNotifications } from '../hooks/useInAppNotifications';
import { useActivities, Activity } from '../hooks/useActivities';

interface UserLocation {
  id: string;
  current_latitude: number;
  current_longitude: number;
  name?: string;
  age?: number;
  gender?: string;
  bio?: string;
  photos?: string[];
  interests?: string[];
  is_online?: boolean;
  last_seen?: string;
  show_on_map?: boolean;
  unreadCount?: number;
  isCurrentUser?: boolean;
  offsetIndex?: number;
  longitude_offset?: number;
  checkInInfo?: {
    location_name: string;
    description?: string;
    created_at: string;
  };
}

// Development mode flag - set to true when using gaming emulators
const DEV_MODE = false;
const DEFAULT_LOCATION = {
  latitude: 37.78825,
  longitude: -122.4324,
};

// Calculate marker scale based on zoom level (latitudeDelta)
const getMarkerScale = (latitudeDelta: number) => {
  // Higher latitudeDelta = more zoomed out
  // Scale markers inversely with zoom
  // Keep scale at 1.0 to avoid Android marker clipping issues
  return 1.0;
};

// Generic function to add offsets to markers at the same location
const getItemsWithOffsets = <T extends { latitude?: number | null; longitude?: number | null }>(
  items: T[],
  offsetFactor: number = 0.0003
): (T & { offsetIndex: number; longitude_offset: number })[] => {
  const locationGroups: { [key: string]: T[] } = {};

  // Group items by location (rounded to 4 decimal places)
  items.forEach(item => {
    if (item.latitude != null && item.longitude != null) {
      const key = `${item.latitude.toFixed(4)}_${item.longitude.toFixed(4)}`;
      if (!locationGroups[key]) {
        locationGroups[key] = [];
      }
      locationGroups[key].push(item);
    }
  });

  // Create items with offsets
  const itemsWithOffsets: (T & { offsetIndex: number; longitude_offset: number })[] = [];

  Object.values(locationGroups).forEach(group => {
    group.forEach((item, index) => {
      const longitudeOffset = -index * offsetFactor;

      itemsWithOffsets.push({
        ...item,
        offsetIndex: index,
        longitude_offset: longitudeOffset
      });
    });
  });

  return itemsWithOffsets;
};

// Helper for check-ins (use same offset as profile markers for visibility)
const getCheckInsWithOffsets = (checkIns: any[]) => getItemsWithOffsets(checkIns, 0.003);

// Helper for activities (use same offset as profile markers for visibility)
const getActivitiesWithOffsets = (activities: any[]) => getItemsWithOffsets(activities, 0.003);

// Group all markers by location and calculate offsets for overlapping markers
const getMarkersWithOffsets = (users: UserLocation[], currentUser?: any, userLocation?: Location.LocationObject | null) => {
  const locationGroups: { [key: string]: UserLocation[] } = {};
  const allMarkers: UserLocation[] = [...users];
  
  // Add current user to the markers if available
  if (currentUser && userLocation && currentUser.is_visible) {
    const currentUserMarker: UserLocation = {
      id: currentUser.id,
      current_latitude: userLocation.coords.latitude,
      current_longitude: userLocation.coords.longitude,
      name: currentUser.name || "You",
      gender: currentUser.gender,
      photos: currentUser.photos,
      is_online: true,
      isCurrentUser: true,
      unreadCount: 0
    };
    allMarkers.push(currentUserMarker);
  }
  
  // Group all markers by location (rounded to 4 decimal places to account for minor GPS variations)
  allMarkers.forEach(user => {
    if (user.current_latitude && user.current_longitude) {
      const key = `${user.current_latitude.toFixed(4)}_${user.current_longitude.toFixed(4)}`;
      if (!locationGroups[key]) {
        locationGroups[key] = [];
      }
      locationGroups[key].push(user);
    }
  });
  
  // Create markers with offsets
  const markersWithOffsets: UserLocation[] = [];
  
  Object.values(locationGroups).forEach(group => {
    group.forEach((user, index) => {
      // Calculate offset for cascading effect - horizontal cascading to the left
      const offsetFactor = 0.003; // Increased value for better visibility
      const longitudeOffset = -index * offsetFactor; // Negative value for left cascading
      
      markersWithOffsets.push({
        ...user,
        offsetIndex: index,
        longitude_offset: longitudeOffset
      });
    });
  });
  
  return markersWithOffsets;
};

export default function HomeScreen({ navigation, route }: any) {
  const { settings, updateLocationEnabled, updateVisibility, updateFilters, setLocation: setContextLocation } = useSettings();
  const { isInvisibleMode } = useSubscription();
  useInAppNotifications();
  const { isLocationEnabled, isVisible, activeFilters } = settings;
  const {
    activities,
    joinActivity,
    leaveActivity,
    cancelActivity,
    fetchComments,
    addComment,
    deleteComment,
  } = useActivities();
  const [nearbyUsers, setNearbyUsers] = useState<UserLocation[]>([]);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showNearbyUsers, setShowNearbyUsers] = useState(false);
  const [showCheckInsOnly, setShowCheckInsOnly] = useState(false);
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(null);
  const [showCheckInDetail, setShowCheckInDetail] = useState(false);
  const [selectedCheckIn, setSelectedCheckIn] = useState<any>(null);
  const [showActivitiesOnMap, setShowActivitiesOnMap] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [mapRegion, setMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null); // Start with null to wait for actual location
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [mapKey, setMapKey] = useState(0); // Force map re-render when needed
  const [isMapInteracting, setIsMapInteracting] = useState(false); // Track user interaction
  const [locationUpdateCount, setLocationUpdateCount] = useState(0); // Force marker re-render
  const [showLocationPrompt, setShowLocationPrompt] = useState(false); // Control location permission modal
  const mapRef = useRef<MapView>(null);
  
  // Extract values from settings context
  const { location } = settings;

  // Force refresh markers (useful for Android rendering issues)  
  const forceRefreshMarkers = () => {
    setLocationUpdateCount(prev => prev + 1);
  };
  
  // Handle focus location from navigation params
  useEffect(() => {
    if (route?.params?.focusLocation) {
      const { latitude, longitude, userId } = route.params.focusLocation;
      
      // Animate to the user's location instead of setting region
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.005, // Zoom in even closer for better visibility
          longitudeDelta: 0.005,
        }, 1000); // 1 second animation
      }
      
      // Highlight the user's marker
      setHighlightedUserId(userId);
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        setHighlightedUserId(null);
      }, 3000);
      
      // Clear the params
      navigation.setParams({ focusLocation: null });
    }
  }, [route?.params?.focusLocation]);
  

  // location setup (without complex logic for now)
  useEffect(() => {
    let isMounted = true;

    const setupLocation = async () => {
      try {
        
        
        if (DEV_MODE) {
          // Simple mock location setup
          const mockLocation: Location.LocationObject = {
            coords: {
              latitude: DEFAULT_LOCATION.latitude,
              longitude: DEFAULT_LOCATION.longitude,
              altitude: 0,
              accuracy: 100,
              altitudeAccuracy: 0,
              heading: 0,
              speed: 0,
            },
            timestamp: Date.now(),
          };
          
          if (isMounted) {
            setContextLocation(mockLocation);
            setLocationError(null);
            setLoading(false);
            
            // Set initial map region for DEV_MODE
            setMapRegion({
              latitude: DEFAULT_LOCATION.latitude,
              longitude: DEFAULT_LOCATION.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            });
            
            // Supabase database update
            try {
              
              const { data: authData } = await supabase.auth.getUser();
              if (authData?.user) {
                if (isMounted) {
                  setCurrentUserId(authData.user.id);
                }
                // Fetch user's profile including visibility status and photo
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('id, name, photos, is_visible, gender')
                  .eq('id', authData.user.id)
                  .single();

                if (profile && isMounted) {
                  setCurrentUserProfile(profile);
                }
                
                // Update location
                await supabase
                  .from('profiles')
                  .update({
                    current_latitude: DEFAULT_LOCATION.latitude,
                    current_longitude: DEFAULT_LOCATION.longitude,
                    last_seen: new Date().toISOString(),
                  })
                  .eq('id', authData.user.id);
                
              }
            } catch (dbError) {
              console.error('HomeScreenTest: Database error:', dbError);
            }
          }
          return;
        }

        // Real location request (simplified)
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setLocationError('Location permission denied');
            setLoading(false);
            // Set a default region so map can still render
            setMapRegion({
              latitude: DEFAULT_LOCATION.latitude,
              longitude: DEFAULT_LOCATION.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            });
          }
          return;
        }

        // Get the actual current location
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          setContextLocation(currentLocation);
          setLocationError(null);
          setLoading(false);
          
          // Set initial map region to user's location
          const userRegion = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          
          setMapRegion(userRegion);
          
          // Also animate to user's location if map is ready
          if (mapRef.current) {
            mapRef.current.animateToRegion(userRegion, 1000);
          }

          // Update location in database
          try {
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user) {
              if (isMounted) {
                setCurrentUserId(authData.user.id);
              }
              // Fetch user's profile if not already loaded
              if (!currentUserProfile) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('id, name, photos, is_visible, gender')
                  .eq('id', authData.user.id)
                  .single();

                if (profile) {
                  setCurrentUserProfile(profile);
                }
              }
              
              await supabase
                .from('profiles')
                .update({
                  current_latitude: currentLocation.coords.latitude,
                  current_longitude: currentLocation.coords.longitude,
                  last_seen: new Date().toISOString(),
                })
                .eq('id', authData.user.id);
            }
          } catch (dbError) {
            console.error('Database update error:', dbError);
          }
        }

      } catch (error) {
        console.error('Location setup error:', error);
        if (isMounted) {
          setLocationError('Location setup failed');
          setLoading(false);
        }
      }
    };

    setupLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  // Removed automatic map region updates on location change to prevent drift

  // fetchCheckIns function
  const fetchCheckIns = async () => {
    if (!location || !isLocationEnabled) return;

    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select('*, profiles(id, name, photos, is_online, last_seen)')
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString());

      if (error) {
        console.error('Error fetching check-ins:', error);
        return;
      }

      setCheckIns(data || []);
    } catch (error) {
      console.error('Error in fetchCheckIns:', error);
    }
  };

  // fetchNearbyUsers function
  const fetchNearbyUsers = async () => {
    // When location is explicitly disabled, fetch users without location filtering
    if (!isLocationEnabled) {
      // Only fetch all users when location is OFF
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) return;
        
        const user = authData.user;
        
        // Get blocked users
        const { data: blockedUsers } = await supabase
          .from('blocked_users')
          .select('blocker_id, blocked_id')
          .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
        const blockedUserIds = new Set<string>();
        blockedUsers?.forEach(b => {
          if (b.blocker_id === user.id) {
            blockedUserIds.add(b.blocked_id);
          } else {
            blockedUserIds.add(b.blocker_id);
          }
        });
        
        // Get all users (including offline) when location is off
        let query = supabase
          .from('profiles')
          .select('id, current_latitude, current_longitude, name, age, gender, bio, photos, interests, is_online, last_seen, show_on_map, location')
          .neq('id', user.id)
          .limit(50); // Limit to prevent too many results
        // Exclude blocked users
        if (blockedUserIds.size > 0) {
          query = query.not('id', 'in', `(${Array.from(blockedUserIds).join(',')})`);
        }
        
        const { data: profiles, error } = await query;
        
        if (error) {
          console.error('Error fetching users:', error);
          return;
        }
        setNearbyUsers(profiles || []);
      } catch (error) {
        console.error('Error fetching users without location:', error);
      }
      return;
    }
    
    // When location is enabled but location data is not available yet
    if (!location && isLocationEnabled) {
      // Don't fetch any users yet, wait for location data
      setNearbyUsers([]);
      return;
    }

    try {
      
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        
        return;
      }
      const user = authData.user;

      // Get blocked users (both directions)
      const { data: blockedUsers } = await supabase
        .from('blocked_users')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
      
      const blockedUserIds = new Set<string>();
      blockedUsers?.forEach(b => {
        if (b.blocker_id === user.id) {
          blockedUserIds.add(b.blocked_id);
        } else {
          blockedUserIds.add(b.blocker_id);
        }
      });

      // Build query with filters - get ALL users with any location data
      let query = supabase
        .from('profiles')
        .select('id, current_latitude, current_longitude, name, age, gender, bio, photos, interests, is_online, last_seen, show_on_map, location')
        .neq('id', user.id)
        .not('current_latitude', 'is', null)
        .not('current_longitude', 'is', null);
        // Removed show_on_map filter - we want to see all users in nearby tab
      
      // Exclude blocked users
      if (blockedUserIds.size > 0) {
        query = query.not('id', 'in', `(${Array.from(blockedUserIds).join(',')})`);
      }

      // Apply gender filter - debug logging
      if (activeFilters.gender !== 'all') {
        query = query.eq('gender', activeFilters.gender);
      }

      // Apply age range filter
      query = query
        .gte('age', activeFilters.ageRange[0])
        .lte('age', activeFilters.ageRange[1]);

      const { data, error } = await query.limit(500); // Get all users within filters

      if (error) {
        console.error('HomeScreenTest: Error fetching nearby users:', error);
        return;
      }

      // Filter by distance only - show ALL users regardless of last_seen time
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const currentLat = location?.coords.latitude || 0;
      const currentLng = location?.coords.longitude || 0;
      
      const filteredByDistance = (data || []).filter(user => {
        if (!user.current_latitude || !user.current_longitude) return false;
        
        // Calculate distance using Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = (user.current_latitude - currentLat) * Math.PI / 180;
        const dLon = (user.current_longitude - currentLng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(currentLat * Math.PI / 180) * Math.cos(user.current_latitude * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        return distance <= activeFilters.distance;
      });   
      
      // Update is_online status and calculate unread counts
      const usersWithUnreadCounts = await Promise.allSettled(
        filteredByDistance.map(async (nearbyUser) => {
          // Update is_online based on last_seen (within 15 minutes for online indicator)
          if (nearbyUser.last_seen) {
            const lastSeenDate = new Date(nearbyUser.last_seen);
            nearbyUser.is_online = lastSeenDate >= fifteenMinutesAgo;
          } else {
            nearbyUser.is_online = false;
          }
          
          // Refresh user photos to catch any missing photos after signup
          try {
            const { data: freshProfile } = await supabase
              .from('profiles')
              .select('photos')
              .eq('id', nearbyUser.id)
              .single();
            
            if (freshProfile && freshProfile.photos) {
              nearbyUser.photos = freshProfile.photos;
            }
          } catch (photoError) {
            console.log('Could not refresh photos for user:', nearbyUser.id);
          }
          
          try {
            // Check if there's a chat room with this user
            const { data: chatRoom } = await supabase
              .from('chat_rooms')
              .select('id')
              .or(`and(user1_id.eq.${user.id},user2_id.eq.${nearbyUser.id}),and(user1_id.eq.${nearbyUser.id},user2_id.eq.${user.id})`)
              .single();

            let unreadCount = 0;
            if (chatRoom) {
              // Count unread messages from this user
              const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('chat_room_id', chatRoom.id)
                .eq('sender_id', nearbyUser.id)
                .eq('is_read', false);
              
              unreadCount = count || 0;
            }

            return {
              ...nearbyUser,
              is_online: nearbyUser.is_online || false,
              unreadCount,
            };
          } catch (userError) {
            console.error(`HomeScreenTest: Error processing user ${nearbyUser.id}:`, userError);
            return {
              ...nearbyUser,
              is_online: nearbyUser.is_online || false,
              unreadCount: 0,
            };
          }
        })
      ).then(results => 
        results
          .filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<any>).value)
      );

      
      // Check for users who sent connection requests but might not be visible
      try {
        const { data: connectionRequests } = await supabase
          .from('connection_requests')
          .select('sender_id')
          .eq('receiver_id', user.id)
          .eq('status', 'pending');
        
        if (connectionRequests && connectionRequests.length > 0) {
          console.log(`Found ${connectionRequests.length} pending connection requests`);
          
          // Get profiles of connection request senders
          const senderIds = connectionRequests.map(req => req.sender_id);
          const { data: senderProfiles } = await supabase
            .from('profiles')
            .select('id, name, current_latitude, current_longitude, gender, age, photos')
            .in('id', senderIds);
          
          // Add connection request senders to nearby users if they're not already there
          senderProfiles?.forEach(sender => {
            if (sender && !usersWithUnreadCounts.find(u => u.id === sender.id)) {
              console.log('Adding connection request sender to nearby users:', sender.name);
              usersWithUnreadCounts.push({
                id: sender.id,
                name: sender.name,
                current_latitude: sender.current_latitude || 0,
                current_longitude: sender.current_longitude || 0,
                gender: sender.gender,
                age: sender.age,
                photos: sender.photos,
                is_online: false,
                unreadCount: 0,
              });
            }
          });
        }
      } catch (requestError) {
        console.log('Could not fetch connection requests:', requestError);
      }
      setNearbyUsers(usersWithUnreadCounts);
      setLocationUpdateCount(prev => prev + 1); // Force re-render like FindEvents
    } catch (error) {
      console.error('HomeScreenTest: Error in fetchNearbyUsers:', error);
    }
  };

  // useEffect for fetching users
  useEffect(() => {
    if (location && !loading && isLocationEnabled) {
      // Add a small delay to prevent race conditions when enabling location
      const timeoutId = setTimeout(() => {
        fetchNearbyUsers();
        fetchCheckIns();
      }, 200);
      return () => clearTimeout(timeoutId);
    } else if (!isLocationEnabled) {
      // Clear users and check-ins when location is disabled
      setNearbyUsers([]);
      setCheckIns([]);
    }
  }, [location, loading, isLocationEnabled, activeFilters, isVisible]); // Added isVisible to trigger refresh on visibility change

  // Update location when visibility changes
  useEffect(() => {
    const updateLocationOnVisibilityChange = async () => {
      if (isVisible && location && isLocationEnabled) {
        try {
          console.log('🗺️ Visibility turned ON - updating location on map...');
          
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          
          // Force update user location and show on map
          const { error } = await supabase
            .from('profiles')
            .update({
              current_latitude: location.coords.latitude,
              current_longitude: location.coords.longitude,
              location_updated_at: new Date().toISOString(),
              last_seen: new Date().toISOString(),
              is_online: true,
              is_visible: true,
              show_on_map: true
            })
            .eq('id', user.id);
            
          if (error) {
            console.error('Error updating location on visibility change:', error);
          } else {
            console.log('🗺️ Location updated successfully - fetching users...');
            
            // Update current user profile to ensure marker shows
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, name, photos, is_visible, gender')
              .eq('id', user.id)
              .single();
              
            if (profile) {
              setCurrentUserProfile(profile);
            }
            
            // Force refresh the map
            await fetchNearbyUsers();
            await fetchCheckIns();
            
            // Force map re-render to ensure marker appears
            setMapKey(prev => prev + 1);
          }
        } catch (error) {
          console.error('Error in visibility change handler:', error);
        }
      }
    };
    
    updateLocationOnVisibilityChange();
  }, [isVisible]); // Only depend on isVisible to avoid loops

  // real-time subscription and periodic refresh
  useEffect(() => {
    let subscription: any;
    let interval: any;
    let isMounted = true;

    const setupSubscription = async () => {
      try {
        
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user || !isMounted) {
          
          return;
        }

        // Subscribe to new messages for badge updates
        subscription = supabase
          .channel('map_test_messages')
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages' 
          }, (payload) => {
            
            // Refresh nearby users to update unread counts
            if (isMounted && location) {
              fetchNearbyUsers();
            }
          })
          .subscribe((status) => {
            
          });

        // Refresh periodically (every 30 seconds)
        interval = setInterval(() => {
          if (isMounted && location && isLocationEnabled) {
            
            fetchNearbyUsers();
            fetchCheckIns();
          }
        }, 30000);
        
      } catch (error) {
        console.error('HomeScreenTest: Subscription error:', error);
      }
    };

    if (location && !loading && isLocationEnabled) {
      setupSubscription();
    } else if (!isLocationEnabled) {
      // Clear users when location is disabled
      setNearbyUsers([]);
      setCheckIns([]);
    }

    return () => {
      
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [location, loading, isLocationEnabled]);

  // Handle app state changes to update last_seen
  useEffect(() => {
    let appStateSubscription: any;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Update last_seen when app goes to background
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && location) {
            console.log('App going to background - updating last_seen');
            await supabase
              .from('profiles')
              .update({
                last_seen: new Date().toISOString(),
                // Keep current location so user remains visible for 15 minutes
                current_latitude: location.coords.latitude,
                current_longitude: location.coords.longitude,
              })
              .eq('id', user.id);
          }
        } catch (error) {
          console.error('Error updating last_seen on background:', error);
        }
      }
    };

    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSubscription?.remove();
    };
  }, [location]);

  if (loading || !mapRegion) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF1744" />
          <Text>Loading location...</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (locationError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={64} color="#FF1744" />
          <Text style={styles.errorTitle}>Location Error</Text>
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              console.log('Retry button pressed');
              setLocationError(null);
              setLoading(true);
            }}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Main UI with MapView
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          key={mapKey} // Force re-render when visibility changes
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          googleRenderer="LEGACY"
          initialRegion={mapRegion}
          onRegionChangeComplete={(region) => {
            // Only update if user is not actively interacting
            // Don't update region if zoomed in too far to prevent drift
            const isHighlyZoomed = region.latitudeDelta < 0.0005 || region.longitudeDelta < 0.0005;
            
            if (!isMapInteracting && !isHighlyZoomed) {
              // Round the values to prevent floating point drift
              const roundedRegion = {
                latitude: Math.round(region.latitude * 1000000) / 1000000,
                longitude: Math.round(region.longitude * 1000000) / 1000000,
                latitudeDelta: Math.round(region.latitudeDelta * 1000000) / 1000000,
                longitudeDelta: Math.round(region.longitudeDelta * 1000000) / 1000000,
              };
              
              // Only update if the change is significant enough
              const significantChange = mapRegion ? (
                Math.abs(roundedRegion.latitude - mapRegion.latitude) > 0.000001 ||
                Math.abs(roundedRegion.longitude - mapRegion.longitude) > 0.000001 ||
                Math.abs(roundedRegion.latitudeDelta - mapRegion.latitudeDelta) > 0.000001 ||
                Math.abs(roundedRegion.longitudeDelta - mapRegion.longitudeDelta) > 0.000001
              ) : true;
              
              if (significantChange) {
                setMapRegion(roundedRegion);
              }
            }
          }}
          onPanDrag={() => setIsMapInteracting(true)}
          onTouchStart={() => setIsMapInteracting(true)}
          onTouchEnd={() => {
            // Delay to prevent immediate updates after interaction
            setTimeout(() => setIsMapInteracting(false), 500);
          }}
          onTouchCancel={() => {
            setTimeout(() => setIsMapInteracting(false), 500);
          }}
          onTouchMove={() => setIsMapInteracting(true)}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={true}
          maxZoomLevel={20}
          minZoomLevel={3}
          rotateEnabled={false}
          scrollEnabled={true}
          zoomEnabled={true}
          pitchEnabled={false}
        >
          {/* All markers grouped by location - only show when check-ins and activities are deactivated */}
          {!showCheckInsOnly && !showActivitiesOnMap && getMarkersWithOffsets(
            nearbyUsers.filter(user => {
              if (!user || !user.id || !user.current_latitude || !user.current_longitude ||
                  typeof user.current_latitude !== 'number' || typeof user.current_longitude !== 'number') {
                return false;
              }
              
             // Don't show on map if they opted out
              if (user.show_on_map === false) return false;
              
              // Only show users who have been active in the last 15 minutes on the map
              if (user.last_seen) {
                const lastSeenDate = new Date(user.last_seen);
                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
                return lastSeenDate >= fifteenMinutesAgo;
              }
              
              return false; // No last_seen = don't show on map
            }),
            isLocationEnabled && isVisible ? currentUserProfile : null,
            isLocationEnabled && isVisible ? location : null
          ).map((user) => {
            return(
              <Marker
                key={`current-location-${user.id}-${locationUpdateCount}`}
                coordinate={{
                latitude: user.current_latitude,
                longitude: user.current_longitude + (user.longitude_offset || 0),
              }}
              title={user.name || 'User'}
              description={user.isCurrentUser ? "Your location" : `Age: ${user.age || 'Unknown'}`}
              tracksViewChanges={true}
              onPress={() => {
                if (!user.isCurrentUser) {
                  navigation.navigate('UserProfile', { userId: user.id });
                }
              }}
              zIndex={100 + (user.offsetIndex || 0)}
            >
              <View style={[
                { alignItems: 'center', justifyContent: 'center' },
                highlightedUserId === user.id && styles.highlightedMarkerContainer
              ]}>
                {user.photos && user.photos.length > 0 ? (
                  <Image
                    source={{ uri: user.photos[0] }}
                    style={{
                      width: 33,
                      height: 33,
                      borderRadius: 16.5,
                      borderWidth: highlightedUserId === user.id ? 4 : 2,
                      borderColor: highlightedUserId === user.id
                        ? '#FFD700'
                        : (user.gender === 'male' ? '#2196F3' : '#FF1744'),
                    }}
                  />
                ) : (
                  <View style={{
                    width: 33,
                    height: 33,
                    borderRadius: 16.5,
                    backgroundColor: user.gender === 'male' ? '#2196F3' : '#FF1744',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: highlightedUserId === user.id ? 4 : 0,
                    borderColor: highlightedUserId === user.id ? '#FFD700' : 'transparent',
                  }}>
                    <Ionicons name="person" size={16} color="white" />
                  </View>
                )}
                {/* Current user pulse effect */}
                {user.isCurrentUser && <View style={styles.userMarkerPulse} />}
                {/* Online status indicator */}
                <View style={[
                  styles.onlineIndicator,
                  { backgroundColor: user.is_online ? '#4CAF50' : '#9E9E9E' }
                ]} />
              </View>
            </Marker>
          )})}

          {/* Check-in markers - only show when check-ins are activated */}
          {showCheckInsOnly && getCheckInsWithOffsets(checkIns).map((checkIn) => {
            const activityTagInfo = getActivityTag(checkIn.activity_tag);
            const markerIcon = activityTagInfo?.icon || 'location-sharp';

            return (
              <Marker
                key={`checkin-${checkIn.id}`}
                coordinate={{
                  latitude: checkIn.latitude,
                  longitude: checkIn.longitude + (checkIn.longitude_offset || 0),
                }}
                title={checkIn.location_name}
                description={checkIn.description || `${checkIn.profiles?.name} is here`}
                onPress={() => {
                  setSelectedCheckIn(checkIn);
                  setShowCheckInDetail(true);
                }}
                zIndex={200 + (checkIn.offsetIndex || 0)}
              >
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{
                    backgroundColor: '#FF1744',
                    width: 33,
                    height: 33,
                    borderRadius: 16.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: 'white',
                  }}>
                    <Ionicons name={markerIcon.replace('-outline', '') as any} size={16} color="white" />
                  </View>
                </View>
              </Marker>
            );
          })}

          {/* Activity markers - show when activities toggle is on */}
          {showActivitiesOnMap && getActivitiesWithOffsets(
            activities.filter(activity => activity.status === 'open' && activity.latitude != null && activity.longitude != null)
          ).map((activity) => {
              const activityTypeInfo = getActivityType(activity.activity_type);
              const markerIcon = activityTypeInfo?.icon || 'calendar';
              const spotsLeft = activity.max_participants - activity.current_participants;

              return (
                <Marker
                  key={`activity-${activity.id}`}
                  coordinate={{
                    latitude: activity.latitude!,
                    longitude: activity.longitude! + (activity.longitude_offset || 0),
                  }}
                  title={activity.title}
                  description={`${activityTypeInfo?.label || 'Activity'} - ${spotsLeft} spots left`}
                  onPress={() => {
                    setSelectedActivity(activity);
                  }}
                  zIndex={300 + (activity.offsetIndex || 0)}
                >
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{
                      backgroundColor: '#4CAF50',
                      width: 33,
                      height: 33,
                      borderRadius: 16.5,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: 'white',
                    }}>
                      <Ionicons name={markerIcon.replace('-outline', '') as any} size={16} color="white" />
                    </View>
                    {/* Badge showing spots left */}
                    {spotsLeft > 0 && (
                      <View style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        backgroundColor: '#FF9800',
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: 'white',
                      }}>
                        <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>
                          {spotsLeft}
                        </Text>
                      </View>
                    )}
                  </View>
                </Marker>
              );
            })}
        </MapView>
        
        {/* Dark overlay and prompt when user tries to enable location */}
        {showLocationPrompt && (
          <View style={styles.locationDisabledOverlay}>
            <View style={styles.locationPrompt}>
              <Ionicons name="location-outline" size={48} color="#FF1744" />
              <Text style={styles.locationPromptTitle}>Enable Location</Text>
              <Text style={styles.locationPromptText}>
                Turn on your location to see who is online nearby
              </Text>
              <View style={styles.locationPromptButtons}>
                <TouchableOpacity
                  style={styles.enableLocationButton}
                  onPress={async () => {
                    // Close modal immediately
                    setShowLocationPrompt(false);
                    
                    // Clear users first to prevent showing all users
                    setNearbyUsers([]);
                    setCheckIns([]);
                    
                    await updateLocationEnabled(true);
                    
                    if (location && mapRef.current) {
                      mapRef.current.animateToRegion({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                      }, 1000);
                      // Fetch nearby users with a small delay to ensure state is updated
                      setTimeout(() => {
                        fetchNearbyUsers();
                        fetchCheckIns();
                      }, 150);
                    }
                  }}
                >
                  <Text style={styles.enableLocationButtonText}>Enable Location</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineLocationButton}
                  onPress={() => {
                    // Close the modal
                    setShowLocationPrompt(false);
                  }}
                >
                  <Text style={styles.declineLocationButtonText}>Not Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        {/* Control buttons */}
        <View style={styles.controlsContainer}>
          {/* Location toggle */}
          <TouchableOpacity
            style={[styles.controlButton, !isLocationEnabled && styles.controlButtonDisabled]}
            onPress={async () => {
              try {
                if (!isLocationEnabled) {
                  // When location is OFF and user tries to turn it ON, show the modal
                  setShowLocationPrompt(true);
                  return;
                }
                
                // When location is ON and user tries to turn it OFF
                const newLocationEnabled = false;
                
                // Update the setting
                await updateLocationEnabled(newLocationEnabled);
                
                // When turning location OFF:
                // 1. Clear all nearby users immediately
                setNearbyUsers([]);
                // 2. Clear check-ins
                setCheckIns([]);
              } catch (error) {
                console.error('Error toggling location:', error);
                Alert.alert('Error', 'Failed to toggle location. Please try again.');
              }
            }}
          >
            <Ionicons 
              name={isLocationEnabled ? "location" : "location-outline"} 
              size={24} 
              color={isLocationEnabled ? "#FF1744" : "#999"} 
            />
            <Text style={[styles.controlButtonText, !isLocationEnabled && styles.controlButtonTextDisabled]}>
              Location {isLocationEnabled ? 'On' : 'Off'}
            </Text>
          </TouchableOpacity>

          {/* Visibility toggle - Check for invisible mode subscription */}
          <TouchableOpacity
            style={[styles.controlButton, !isVisible && styles.controlButtonDisabled]}
            onPress={async () => {
              try {
                // If trying to go invisible, check subscription
                if (isVisible && !isInvisibleMode) {
                  Alert.alert(
                    'Premium Feature',
                    'Invisible mode is a premium feature. Upgrade to Premium or purchase invisible mode to hide your location.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'View Plans', onPress: () => navigation.navigate('Subscription') },
                    ]
                  );
                  return;
                }
                await updateVisibility(!isVisible);
              } catch (error) {
                console.error('Error toggling visibility:', error);
                Alert.alert('Error', 'Failed to update visibility. Please try again.');
              }
            }}
          >
            <Ionicons 
              name={isVisible ? "eye" : "eye-off"} 
              size={24} 
              color={isVisible ? "#FF1744" : "#999"} 
            />
            <Text style={[styles.controlButtonText, !isVisible && styles.controlButtonTextDisabled]}>
              {isVisible ? 'Visible' : 'Hidden'}
            </Text>
          </TouchableOpacity>

          {/* Nearby users button */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowNearbyUsers(true)}
          >
            <Ionicons name="people" size={24} color="#FF1744" />
            <Text style={styles.controlButtonText}>
              {isLocationEnabled ? `Nearby (${nearbyUsers.length})` : `Users (${nearbyUsers.length})`}
            </Text>
          </TouchableOpacity>

          {/* Filters button */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options" size={24} color="#FF1744" />
            <Text style={styles.controlButtonText}>Filters</Text>
          </TouchableOpacity>

        </View>

        {/* Logo in upper left corner */}
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Custom location button */}
        {location && isLocationEnabled && (
          <>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => {
                if (location && location.coords && mapRef.current) {
                  // Use animateToRegion for smooth transition
                  mapRef.current.animateToRegion({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  }, 1000);
                }
              }}
            >
              <Ionicons name="locate" size={22} color="#FF1744" />
            </TouchableOpacity>
            
            {/* Check-ins toggle button */}
            <TouchableOpacity
              style={[styles.locationButton, { top: Platform.OS === 'ios' ? 100 : 70 }]}
              onPress={() => {
                const newValue = !showCheckInsOnly;
                setShowCheckInsOnly(newValue);
                // Deactivate activities when check-ins are activated
                if (newValue) {
                  setShowActivitiesOnMap(false);
                }
              }}
            >
              <Ionicons
                name={showCheckInsOnly ? "location" : "location-outline"}
                size={22}
                color="#FF1744"
              />
            </TouchableOpacity>

            {/* Activities toggle button */}
            <TouchableOpacity
              style={[styles.locationButton, { top: Platform.OS === 'ios' ? 150 : 120 }]}
              onPress={() => {
                const newValue = !showActivitiesOnMap;
                setShowActivitiesOnMap(newValue);
                // Deactivate check-ins when activities are activated
                if (newValue) {
                  setShowCheckInsOnly(false);
                }
              }}
            >
              <Ionicons
                name={showActivitiesOnMap ? "calendar" : "calendar-outline"}
                size={22}
                color="#FF1744"
              />
            </TouchableOpacity>

            {/* Refresh button */}
            <TouchableOpacity
              style={[styles.locationButton, { top: Platform.OS === 'ios' ? 200 : 170 }]}
              onPress={async () => {
                if (isLocationEnabled) {
                  // Force update current user's last_seen first
                  try {
                    const { data: authData } = await supabase.auth.getUser();
                    if (authData?.user) {
                      await supabase
                        .from('profiles')
                        .update({
                          last_seen: new Date().toISOString(),
                          is_online: true,
                        })
                        .eq('id', authData.user.id);
                    }
                  } catch (error) {
                    console.error('Error updating user status:', error);
                  }
                  
                  // Clear current users to force fresh fetch
                  setNearbyUsers([]);
                  
                  // Fetch fresh data with updated statuses
                  await fetchNearbyUsers();
                  await fetchCheckIns();
                  // Force refresh markers
                  forceRefreshMarkers();
                  Alert.alert('Refreshed', 'Map and user statuses have been updated');
                } else {
                  Alert.alert('Location Off', 'Please turn on location to refresh');
                }
              }}
            >
              <Ionicons name="refresh" size={22} color="#FF1744" />
            </TouchableOpacity>
          </>
        )}

        {/* Modals */}
        {showFilters && (
          <MapFilters
            visible={showFilters}
            onClose={() => setShowFilters(false)}
            filters={{
              genderPreference: activeFilters.gender === 'all' ? 'Everyone' : 
                               activeFilters.gender === 'male' ? 'Men' : 'Women',
              maxDistance: activeFilters.distance,
              minAge: activeFilters.ageRange[0],
              maxAge: activeFilters.ageRange[1],
            }}
            onFiltersChange={async (newFilters) => {
              try {
                await updateFilters(newFilters);
                setShowFilters(false);
                fetchNearbyUsers(); // Refresh with new filters
              } catch (error) {
                console.error('Error updating filters:', error);
                Alert.alert('Error', 'Failed to update filters. Please try again.');
              }
            }}
          />
        )}


        {showNearbyUsers && (
          <NearbyUsersModal
            visible={showNearbyUsers}
            onClose={() => setShowNearbyUsers(false)}
            users={nearbyUsers}
            onUserSelect={(user) => {
              navigation.navigate('UserProfile', { userId: user.id });
              setShowNearbyUsers(false);
            }}
            navigation={navigation}
            onShowOnMap={(usersToShow) => {
              // Update the map to show only the selected users
              setNearbyUsers(usersToShow);
              setShowNearbyUsers(false);

              // Center map on first user if available
              if (usersToShow.length > 0 && usersToShow[0].current_latitude && usersToShow[0].current_longitude) {
                setMapRegion({
                  latitude: usersToShow[0].current_latitude,
                  longitude: usersToShow[0].current_longitude,
                  latitudeDelta: 0.0922,
                  longitudeDelta: 0.0421,
                });
              }
            }}
          />
        )}

        <CheckInDetailModal
          visible={showCheckInDetail}
          onClose={() => {
            setShowCheckInDetail(false);
            setSelectedCheckIn(null);
          }}
          checkIn={selectedCheckIn}
          onViewProfile={async (targetUserId) => {
            setShowCheckInDetail(false);
            setSelectedCheckIn(null);

            // Check if it's the current user's profile
            const { data: { user } } = await supabase.auth.getUser();
            if (user && user.id === targetUserId) {
              // Navigate to own profile tab
              navigation.navigate('Profile');
            } else {
              // Navigate to other user's profile
              navigation.navigate('UserProfile', { userId: targetUserId });
            }
          }}
        />

        {/* Activity Detail Modal for map markers */}
        <ActivityDetailModal
          visible={!!selectedActivity}
          activity={selectedActivity}
          currentUserId={currentUserId || undefined}
          onClose={() => setSelectedActivity(null)}
          onJoin={async () => {
            if (selectedActivity) {
              const isParticipant = selectedActivity.participants?.some(
                p => p.user_id === currentUserId && p.status === 'joined'
              );
              if (isParticipant) {
                await leaveActivity(selectedActivity.id);
              } else {
                await joinActivity(selectedActivity.id);
              }
              setSelectedActivity(null);
            }
          }}
          onViewProfile={(userId) => {
            setSelectedActivity(null);
            if (userId === currentUserId) {
              navigation.navigate('Profile');
            } else {
              navigation.navigate('UserProfile', { userId });
            }
          }}
          onCancel={async () => {
            if (selectedActivity) {
              await cancelActivity(selectedActivity.id);
              setSelectedActivity(null);
            }
          }}
          fetchComments={fetchComments}
          addComment={addComment}
          deleteComment={deleteComment}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlButtonText: {
    fontSize: 12,
    color: '#333',
    marginTop: 4,
    fontWeight: '500',
  },
  controlButtonTextDisabled: {
    color: '#999',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF1744',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#FF1744',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginVertical: 10,
    minWidth: 200,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerImage: {
    width: 40,
    height: 40,
    borderRadius: 15,
    borderWidth: 2,
  },
  markerBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF1744',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userMarkerImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'white',
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    zIndex: -1,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.20,
    shadowRadius: 1.41,
    elevation: 2,
  },
  locationButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 10,
    width: 44,
    height: 44,
    backgroundColor: 'white',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.20,
    shadowRadius: 1.41,
    elevation: 2,
  },
  locationDisabledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  locationPrompt: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  locationPromptTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
  },
  locationPromptText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  enableLocationButton: {
    backgroundColor: '#FF1744',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  enableLocationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  locationPromptButtons: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10,
  },
  declineLocationButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FF1744',
  },
  declineLocationButtonText: {
    color: '#FF1744',
    fontSize: 16,
    fontWeight: '600',
  },
  checkInMarkerContainer: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInMarker: {
    backgroundColor: '#FF1744',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  highlightedMarkerContainer: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  logo: {
    position: 'absolute',
    top: -40,
    left: -25,
    width: 200,
    height: 200,
  },
});
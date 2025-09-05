import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Linking,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../integrations/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import MapFilters from '../components/MapFilters';
import UserProfilePopup from '../components/UserProfilePopup';
import NearbyUsersModal from '../components/NearbyUsersModal';

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
  unreadCount?: number;
}

// Development mode flag - set to true when using gaming emulators
const DEV_MODE = true;
const DEFAULT_LOCATION = {
  latitude: 37.78825,
  longitude: -122.4324,
};

export default function HomeScreen({ navigation }: any) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<UserLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserLocation | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  
  const [filters, setFilters] = useState({
    genderPreference: 'Everyone' as 'Everyone' | 'Men' | 'Women',
    maxDistance: 50,
    minAge: 18,
    maxAge: 65,
  });
  
  const [mapRegion, setMapRegion] = useState({
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let isMounted = true;

    (async () => {
      try {
        // In development mode with gaming emulators, use default location
        if (DEV_MODE) {
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
            setLocation(mockLocation);
            setLocationError(null);
            setLoading(false);
          }
          
          // Update user's location in database with error handling
          try {
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user && isMounted) {
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
            console.error('Database update error:', dbError);
          }
          return;
        }

        // Request location permissions
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setLocationError('Location permission is required to use this app.');
            setLoading(false);
          }
          return;
        }

        // Check if location services are enabled
        const isLocationEnabled = await Location.hasServicesEnabledAsync();
        if (!isLocationEnabled) {
          if (isMounted) {
            setLocationError('Please enable location services to use this app.');
            setLoading(false);
          }
          return;
        }

        // Get current location with timeout
        try {
          let currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest, // More compatible with emulators
            timeInterval: 10000,
            mayShowUserSettingsDialog: true,
          });
          
          if (isMounted) {
            setLocation(currentLocation);
            setLocationError(null);
            
            // Update map region to user's location
            setMapRegion({
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            });
          }

          // Update user's location in database with error handling
          try {
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user && isMounted) {
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

          // Start watching location
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Lowest, // More compatible with emulators
              timeInterval: 60000, // 60 seconds
              distanceInterval: 100, // 100 meters
            },
            (newLocation) => {
              setLocation(newLocation);
              updateUserLocation(newLocation);
            }
          );
        } catch (locationError) {
          console.error('Error getting location:', locationError);
          // Try last known location as fallback
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            setLocation(lastKnown);
            setMapRegion({
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            });
          } else {
            setLocationError('Unable to get your location. Please check your settings.');
          }
        }
      } catch (error) {
        console.error('Location setup error:', error);
        setLocationError('An error occurred while setting up location services.');
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    // Fetch nearby users
    if (location) {
      fetchNearbyUsers();
    }
  }, [location]);

  // Subscribe to new messages to update badge counts
  useEffect(() => {
    let subscription;
    let interval;

    const setupSubscription = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      subscription = supabase
        .channel('map_new_messages')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages' 
        }, (payload) => {
          // Refresh nearby users to update unread counts
          fetchNearbyUsers();
        })
        .subscribe();

      // Refresh periodically
      interval = setInterval(() => {
        fetchNearbyUsers();
      }, 30000); // Every 30 seconds
    };

    setupSubscription();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [location]);

  const updateUserLocation = async (newLocation: Location.LocationObject) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        await supabase
          .from('profiles')
          .update({
            current_latitude: newLocation.coords.latitude,
            current_longitude: newLocation.coords.longitude,
            last_seen: new Date().toISOString(),
          })
          .eq('id', authData.user.id);
      }
    } catch (error) {
      console.error('Error updating user location:', error);
    }
  };

  const fetchNearbyUsers = async () => {
    if (!location) return;

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const user = authData.user;

    // Fetch users within a certain radius (simplified for now)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, current_latitude, current_longitude, name, age, gender, bio, photos, interests, is_online, last_seen')
      .neq('id', user.id)
      .not('current_latitude', 'is', null)
      .not('current_longitude', 'is', null);

    if (error) {
      console.error('Error fetching nearby users:', error);
      return;
    }

    // Helper function to check if user is considered online
    const isUserOnline = (user: any) => {
      if (!user.is_online) return false;
      
      // Check if last_seen is within 15 minutes
      if (user.last_seen) {
        const lastSeen = new Date(user.last_seen);
        const now = new Date();
        const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
        return diffInMinutes <= 15;
      }
      
      return user.is_online;
    };

    // Fetch unread message counts for each user and update online status
    const usersWithUnreadCounts = await Promise.allSettled(
      (data || []).map(async (nearbyUser) => {
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
            is_online: isUserOnline(nearbyUser),
            unreadCount,
          };
        } catch (userError) {
          console.error(`Error processing user ${nearbyUser.id}:`, userError);
          return {
            ...nearbyUser,
            is_online: isUserOnline(nearbyUser),
            unreadCount: 0,
          };
        }
      })
    ).then(results => 
      results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any>).value)
    );

    setNearbyUsers(usersWithUnreadCounts);
    } catch (error) {
      console.error('Error fetching nearby users:', error);
    }
  };

  const handleMarkerPress = (user: UserLocation) => {
    setSelectedUser(user);
    setShowUserProfile(true);
  };

  const handleConnect = async (userId: string) => {
    // Handle connect logic
    console.log('Connecting to user:', userId);
  };

  const handleChat = (userId: string) => {
    navigation.navigate('Chat', { userId });
  };

  const toggleLocationEnabled = () => {
    setIsLocationEnabled(!isLocationEnabled);
    // Update user's location status in database
    updateUserVisibility(!isLocationEnabled);
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
    // Update user's visibility status in database
    updateUserVisibility(isLocationEnabled, !isVisible);
  };

  const updateUserVisibility = async (locationEnabled = isLocationEnabled, visible = isVisible) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      await supabase
        .from('profiles')
        .update({
          show_on_map: locationEnabled && visible,
          is_online: visible,
          last_seen: new Date().toISOString(),
        })
        .eq('id', authData.user.id);
    } catch (error) {
      console.error('Error updating user visibility:', error);
    }
  };

  const filteredUsers = nearbyUsers.filter(user => {
    // Apply gender filter
    if (filters.genderPreference !== 'Everyone') {
      const genderMatch = filters.genderPreference === 'Men' ? 'male' : 'female';
      if (user.gender !== genderMatch) return false;
    }
    
    // Apply age filter
    if (user.age && (user.age < filters.minAge || user.age > filters.maxAge)) {
      return false;
    }
    
    // Distance filter would go here (requires calculation)
    return true;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF1744" />
      </View>
    );
  }

  if (locationError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={64} color="#FF1744" />
          <Text style={styles.errorTitle}>Location Required</Text>
          <Text style={styles.errorText}>{locationError}</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }}
          >
            <Text style={styles.settingsButtonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
        showsUserLocation={isLocationEnabled}
        showsMyLocationButton={isLocationEnabled}
        showsCompass={true}
      >
        {filteredUsers
          .filter(user => 
            user && 
            user.id && 
            user.current_latitude && 
            user.current_longitude &&
            typeof user.current_latitude === 'number' &&
            typeof user.current_longitude === 'number'
          )
          .map((user) => (
            <Marker
              key={user.id}
              coordinate={{
                latitude: user.current_latitude,
                longitude: user.current_longitude,
              }}
              onPress={() => handleMarkerPress(user)}
            >
              <View style={styles.markerContainer}>
                <View style={[styles.marker, { backgroundColor: user.gender === 'male' ? '#2196F3' : '#FF1744' }]}>
                  <Ionicons name="person" size={20} color="white" />
                </View>
                {user.unreadCount > 0 && (
                  <View style={styles.markerBadge}>
                    <Text style={styles.markerBadgeText}>{user.unreadCount > 99 ? '99+' : user.unreadCount}</Text>
                  </View>
                )}
              </View>
            </Marker>
          ))}
      </MapView>

      {/* Top Controls */}
      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setShowOnlineUsers(true)}
        >
          <Ionicons name="people" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[styles.toggleButton, !isLocationEnabled && styles.toggleButtonOff]}
          onPress={toggleLocationEnabled}
        >
          <Ionicons 
            name={isLocationEnabled ? "location" : "location-outline"} 
            size={24} 
            color={isLocationEnabled ? "white" : "#666"} 
          />
          <Text style={[styles.toggleText, !isLocationEnabled && styles.toggleTextOff]}>
            Location {isLocationEnabled ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toggleButton, !isVisible && styles.toggleButtonOff]}
          onPress={toggleVisibility}
        >
          <Ionicons 
            name={isVisible ? "eye" : "eye-off"} 
            size={24} 
            color={isVisible ? "white" : "#666"} 
          />
          <Text style={[styles.toggleText, !isVisible && styles.toggleTextOff]}>
            {isVisible ? 'Visible' : 'Hidden'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters Modal */}
      <MapFilters
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* User Profile Popup */}
      {selectedUser && (
        <UserProfilePopup
          visible={showUserProfile}
          onClose={() => setShowUserProfile(false)}
          user={selectedUser}
          onConnect={handleConnect}
          onChat={handleChat}
          navigation={navigation}
        />
      )}

      {/* Nearby Users Modal */}
      <NearbyUsersModal
        visible={showOnlineUsers}
        onClose={() => setShowOnlineUsers(false)}
        users={filteredUsers}
        onUserSelect={(user) => {
          setSelectedUser(user);
          setShowUserProfile(true);
          setShowOnlineUsers(false);
        }}
        onRefresh={fetchNearbyUsers}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  marker: {
    backgroundColor: '#FF1744',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  markerBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF0000',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'white',
  },
  markerBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  settingsButton: {
    backgroundColor: '#FF1744',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  topControls: {
    position: 'absolute',
    top: 120,
    right: 20,
    gap: 12,
  },
  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: '#FF1744',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  toggleButtonOff: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toggleText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextOff: {
    color: '#666',
  },
});
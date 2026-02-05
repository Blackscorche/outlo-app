import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';
import { supabase } from '../integrations/supabase/client';
import { showImagePickerOptions } from '../utils/imagePicker';
import { useSettings } from '../contexts/SettingsContext';
import PostUploadModal from '../components/PostUploadModal';
import CheckInModal, { CheckInSuccessData } from '../components/CheckInModal';
import PlaceReviewModal from '../components/PlaceReviewModal';
import { usePlaces, Place } from '../hooks/usePlaces';

interface CheckIn {
  id: string;
  user_id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  description?: string;
  activity_tag?: string;
  is_active: boolean;
  created_at: string;
  expires_at: string;
}

const ProfileScreen = ({ navigation }) => {
  const { settings } = useSettings();
  const { getPlaceById } = usePlaces();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [placeForReview, setPlaceForReview] = useState<Place | null>(null);
  const [lastCheckInId, setLastCheckInId] = useState<string | null>(null);
  const [posts, setPosts] = useState([]);
  const [activeCheckIn, setActiveCheckIn] = useState<CheckIn | null>(null);
  const [profile, setProfile] = useState({
    id: '',
    email: '',
    name: '',
    bio: '',
    age: 0,
    location: '',
    interests: [],
    photos: [],
    gender: '',
    looking_for: '',
    relationship_goals: '',
  });
  const [stats, setStats] = useState({
    likes: 0,
    views: 0,
    connections: 0,
    checkIns: 0,
  });

  useEffect(() => {
    loadProfile();
    loadStats();
    loadPosts();
    loadActiveCheckIn();
  }, []);

  // Clean up broken local image URLs on component mount
  useEffect(() => {
    if (profile.photos && profile.photos.length > 0) {
      const hasLocalImages = profile.photos.some(photo => photo.includes('ExperienceData'));
      if (hasLocalImages) {
        console.log('Found local images, cleaning up...');
        cleanupBrokenImages();
      }
    }
  }, [profile.photos]);

  const cleanupBrokenImages = async () => {
    try {
      // Filter out local file URLs that are likely broken
      const validPhotos = profile.photos.filter(photo => 
        !photo.includes('ExperienceData') && 
        !photo.includes('ImagePicker') &&
        !photo.includes('file://')
      );

      if (validPhotos.length !== profile.photos.length) {
        console.log('Cleaning up broken images:', profile.photos.length - validPhotos.length, 'removed');
        
        // Update local state
        setProfile(prev => ({ ...prev, photos: validPhotos }));
        
        // Update database
        const { error } = await supabase
          .from('profiles')
          .update({
            photos: validPhotos,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        if (error) {
          console.error('Error cleaning up photos in database:', error);
        } else {
          console.log('Photos cleaned up successfully in database');
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.navigate('Auth');
        return;
      }

      console.log('Loading profile for user:', user.id);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        throw error;
      }

      if (data) {
        console.log('Profile data loaded:', {
          id: data.id,
          name: data.name,
          photos: data.photos,
          photosLength: data.photos ? data.photos.length : 0,
        });

        setProfile({
          id: data.id,
          email: user.email || '',
          name: data.name || '',
          bio: data.bio || '',
          age: data.age || 0,
          location: data.location || '',
          interests: Array.isArray(data.interests) ? data.interests : [],
          photos: Array.isArray(data.photos) ? data.photos : [],
          gender: data.gender || '',
          looking_for: data.looking_for || '',
          relationship_goals: data.relationship_goals || '',
        });
      } else {
        console.log('No profile data found for user');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get connections count
      const { count: connectionsCount } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      // Get active check-ins count
      const { count: checkInsCount } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Get profile views count (would need a profile_views table)
      // For now, we'll use a placeholder
      const viewsCount = Math.floor(Math.random() * 50) + 10;
      
      // Get likes count (would need a likes table)
      // For now, we'll use a placeholder
      const likesCount = Math.floor(Math.random() * 30) + 5;

      setStats({
        likes: likesCount,
        views: viewsCount,
        connections: connectionsCount || 0,
        checkIns: checkInsCount || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('posts')
        .select('*, post_likes(user_id), post_comments(id)')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(9);

      if (error) throw error;
      
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  };

  const loadActiveCheckIn = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }
      
      setActiveCheckIn(data);
    } catch (error) {
      console.error('Error loading active check-in:', error);
    }
  };

  const pickImage = async () => {
    showImagePickerOptions(
      {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      },
      async (imageUri) => {
        try {
          setSaving(true);
          
          console.log('Profile: Image selected:', imageUri);
          
          // Upload image to Supabase Storage
          const uploadedUrl = await uploadImageToStorage(imageUri);
          
          if (uploadedUrl) {
            console.log('Profile: Image uploaded successfully:', uploadedUrl);
            
            // Filter out any broken local images before adding new one
            const validPhotos = profile.photos.filter(photo => 
              photo.includes('supabase') || photo.startsWith('http')
            );
            
            const newPhotos = [...validPhotos, uploadedUrl];
            
            setProfile(prev => ({
              ...prev,
              photos: newPhotos
            }));
            
            // Auto-save the profile with new photo
            await saveProfileWithNewPhoto(newPhotos);
          } else {
            Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
          }
        } catch (error) {
          console.error('Error picking/uploading image:', error);
          Alert.alert('Error', 'Failed to upload image');
        } finally {
          setSaving(false);
        }
      }
    );
  };

  const uploadImageToStorage = async (imageUri: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create a unique filename with user ID in the path
      const fileName = `${Date.now()}.jpeg`;
      const filePath = `${user.id}/${fileName}`;

      console.log('Starting image upload:', imageUri);

      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            
            console.log('Converted to base64, uploading to Supabase...');
            
            // Decode base64 to array buffer
            const decode = atob(base64Data);
            const arrayBuffer = new Uint8Array(decode.length);
            for (let i = 0; i < decode.length; i++) {
              arrayBuffer[i] = decode.charCodeAt(i);
            }
            
            // Upload to Supabase with proper authentication
            const { data, error } = await supabase.storage
              .from('user-photos')
              .upload(filePath, arrayBuffer.buffer, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: true // Allow overwriting if needed
              });

            if (error) {
              console.error('Supabase upload error:', error);
              
              if (error.message?.includes('row-level security policy')) {
                Alert.alert(
                  'Storage Permission Error',
                  'Please ensure storage policies are set up correctly. Check setup-storage.sql file.'
                );
              }
              throw error;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('user-photos')
              .getPublicUrl(filePath);

            console.log('Upload successful! URL:', publicUrl);
            resolve(publicUrl);
          } catch (error) {
            console.error('Error in base64 upload:', error);
            reject(error);
          }
        };
        
        reader.onerror = (error) => {
          console.error('FileReader error:', error);
          reject(error);
        };
        
        reader.readAsDataURL(blob);
      });

    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert(
        'Upload Failed',
        'Failed to upload image. Please check your internet connection and try again.'
      );
      return null;
    }
  };

  const saveProfileWithNewPhoto = async (newPhotos: string[]) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          photos: newPhotos,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      console.log('Profile photos updated successfully');
    } catch (error) {
      console.error('Error saving profile with new photo:', error);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!profile.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    
    if (profile.photos.length < 2) {
      Alert.alert('Error', 'At least 2 photos are required');
      return;
    }
    
    if (profile.interests.length < 5) {
      Alert.alert('Error', 'At least 5 interests are required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          bio: profile.bio,
          age: profile.age,
          location: profile.location,
          interests: profile.interests,
          photos: profile.photos,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
      
      // Reload stats after save
      loadStats();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={commonStyles.title}>My Profile</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Ionicons
              name={isEditing ? 'close' : 'create-outline'}
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.photoSection}>
          <TouchableOpacity 
            style={styles.mainPhoto}
            onPress={isEditing ? pickImage : undefined}
          >
            {profile.photos && profile.photos.length > 0 && profile.photos[0] ? (
              <Image 
                source={{ uri: profile.photos[0] }} 
                style={styles.profileImage}
                resizeMode="cover"
                onError={(error) => {
                  console.log('Main photo load error:', error.nativeEvent.error);
                  // Handle broken local image URLs by showing placeholder
                  setProfile(prev => ({
                    ...prev,
                    photos: prev.photos.filter(photo => !photo.includes('ExperienceData'))
                  }));
                }}
                onLoad={() => {
                  console.log('Main photo loaded successfully');
                }}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={40} color={theme.colors.textSecondary} />
                <Text style={styles.photoPlaceholderText}>
                  {isEditing ? 'Tap to Add Photo' : 'No Photo'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Photo gallery */}
          <View style={styles.photoGallery}>
            {profile.photos && profile.photos.length > 1 && profile.photos.slice(1).map((photo, index) => (
              <View key={index} style={styles.photoItem}>
                <Image 
                  source={{ uri: photo }} 
                  style={styles.smallPhoto}
                  resizeMode="cover"
                  onError={(error) => {
                    console.log(`Gallery photo ${index + 1} load error:`, error.nativeEvent.error);
                    // Remove broken local image URLs
                    if (photo.includes('ExperienceData')) {
                      const newPhotos = profile.photos.filter(p => p !== photo);
                      setProfile(prev => ({ ...prev, photos: newPhotos }));
                    }
                  }}
                  onLoad={() => {
                    console.log(`Gallery photo ${index + 1} loaded successfully`);
                  }}
                />
                {isEditing && (
                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => {
                      const newPhotos = profile.photos.filter((_, i) => i !== index + 1);
                      setProfile({ ...profile, photos: newPhotos });
                    }}
                  >
                    <Ionicons name="close-circle" size={20} color="white" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            
            {/* Add more photos button */}
            {isEditing && profile.photos && profile.photos.length < 6 && (
              <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
                <Ionicons name="add" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{profile.email}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={profile.name}
                onChangeText={(text) => setProfile({ ...profile, name: text })}
              />
            ) : (
              <Text style={styles.value}>{profile.name}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Age</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={profile.age.toString()}
                onChangeText={(text) => setProfile({ ...profile, age: parseInt(text) || 0 })}
                keyboardType="numeric"
              />
            ) : (
              <Text style={styles.value}>{profile.age}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Location</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={profile.location}
                onChangeText={(text) => setProfile({ ...profile, location: text })}
              />
            ) : (
              <Text style={styles.value}>{profile.location}</Text>
            )}
          </View>

          <View style={styles.bioSection}>
            <Text style={styles.label}>Bio</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={profile.bio}
                onChangeText={(text) => setProfile({ ...profile, bio: text })}
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={styles.bioText}>{profile.bio}</Text>
            )}
          </View>

          <View style={styles.interestsSection}>
            <Text style={styles.label}>Interests</Text>
            <View style={styles.interestsList}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestText}>{interest}</Text>
                  {isEditing && (
                    <TouchableOpacity
                      onPress={() => {
                        const newInterests = profile.interests.filter((_, i) => i !== index);
                        setProfile({ ...profile, interests: newInterests });
                      }}
                      style={styles.removeInterest}
                    >
                      <Ionicons name="close-circle" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        {isEditing && (
          <TouchableOpacity 
            style={[commonStyles.button, saving && styles.buttonDisabled]} 
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={commonStyles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.statsSection}>
          <TouchableOpacity style={styles.statItem}>
            <Ionicons name="heart" size={24} color={theme.colors.primary} />
            <Text style={styles.statNumber}>{stats.likes}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.statItem}>
            <Ionicons name="eye" size={24} color={theme.colors.primary} />
            <Text style={styles.statNumber}>{stats.views}</Text>
            <Text style={styles.statLabel}>Views</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => navigation.navigate('Connections')}
          >
            <Ionicons name="people" size={24} color={theme.colors.primary} />
            <Text style={styles.statNumber}>{stats.connections}</Text>
            <Text style={styles.statLabel}>Connections</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.statItem}>
            <Ionicons name="location" size={24} color={theme.colors.primary} />
            <Text style={styles.statNumber}>{stats.checkIns}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </TouchableOpacity>
        </View>

        {/* Posts Section */}
        <View style={styles.postsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Posts</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowPostModal(true)}
            >
              <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.postsGrid}>
            {posts.length > 0 ? (
              posts.map((post) => (
                <TouchableOpacity key={post.id} style={styles.postItem}>
                  <Image 
                    source={{ uri: post.media_url }} 
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                  {post.media_type === 'video' && (
                    <View style={styles.videoOverlay}>
                      <Ionicons name="play-circle" size={30} color="white" />
                    </View>
                  )}
                  <View style={styles.postStats}>
                    <View style={styles.postStat}>
                      <Ionicons name="heart" size={14} color="white" />
                      <Text style={styles.postStatText}>{post.likes_count}</Text>
                    </View>
                    <View style={styles.postStat}>
                      <Ionicons name="chatbubble" size={14} color="white" />
                      <Text style={styles.postStatText}>{post.comments_count}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyPosts}>
                <Text style={styles.emptyText}>No posts yet</Text>
                <TouchableOpacity 
                  style={styles.createPostButton}
                  onPress={() => setShowPostModal(true)}
                >
                  <Text style={styles.createPostText}>Create your first post</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Check-in Section */}
        <View style={styles.checkInSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Current Location</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowCheckInModal(true)}
            >
              <Ionicons name="location" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          
          {activeCheckIn ? (
            <TouchableOpacity
              style={styles.checkInCard}
              onPress={() => {
                // Navigate to map and show check-in marker
                navigation.navigate('Home', {
                  showCheckIn: {
                    latitude: activeCheckIn.latitude,
                    longitude: activeCheckIn.longitude,
                    locationName: activeCheckIn.location_name,
                    checkInId: activeCheckIn.id,
                  },
                });
              }}
              activeOpacity={0.7}
            >
              <View style={styles.checkInInfo}>
                <Ionicons name="location-sharp" size={20} color={theme.colors.primary} />
                <Text style={styles.checkInLocation}>{activeCheckIn.location_name}</Text>
              </View>
              {activeCheckIn.description && (
                <Text style={styles.checkInDescription}>{activeCheckIn.description}</Text>
              )}
              <View style={styles.checkInFooter}>
                <Text style={styles.checkInTime}>
                  Checked in {new Date(activeCheckIn.created_at).toLocaleTimeString()}
                </Text>
                <View style={styles.viewOnMapHint}>
                  <Ionicons name="map-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.viewOnMapText}>View on map</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.checkInPrompt}
              onPress={() => setShowCheckInModal(true)}
            >
              <Ionicons name="add-circle-outline" size={40} color={theme.colors.textSecondary} />
              <Text style={styles.checkInPromptText}>Check in to a location</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Post Upload Modal */}
      {showPostModal && (
        <PostUploadModal
          visible={showPostModal}
          onClose={() => setShowPostModal(false)}
          onPostCreated={() => {
            loadPosts();
            setShowPostModal(false);
          }}
        />
      )}

      {/* Check-in Modal */}
      {showCheckInModal && (
        <CheckInModal
          visible={showCheckInModal}
          onClose={() => setShowCheckInModal(false)}
          onCheckIn={() => {
            loadActiveCheckIn();
            loadStats(); // Reload stats to update check-in count
            setShowCheckInModal(false);
          }}
          onCheckInSuccess={async (data: CheckInSuccessData) => {
            setLastCheckInId(data.checkInId);

            // Navigate to map and show check-in marker
            navigation.navigate('Home', {
              showCheckIn: {
                latitude: data.latitude,
                longitude: data.longitude,
                locationName: data.locationName,
                checkInId: data.checkInId,
              },
            });

            // If we have a place ID, fetch the place and prompt for review
            if (data.placeId) {
              const place = await getPlaceById(data.placeId);
              if (place) {
                // Small delay to let the navigation and modal close first
                setTimeout(() => {
                  Alert.alert(
                    'Write a Review?',
                    `Would you like to share your experience at ${data.locationName}?`,
                    [
                      { text: 'Not Now', style: 'cancel' },
                      {
                        text: 'Write Review',
                        onPress: () => {
                          setPlaceForReview(place);
                          setShowReviewModal(true);
                        },
                      },
                    ]
                  );
                }, 1000);
              }
            }
          }}
          currentLocation={settings.location}
        />
      )}

      {/* Place Review Modal */}
      <PlaceReviewModal
        visible={showReviewModal}
        place={placeForReview}
        checkInId={lastCheckInId || undefined}
        onClose={() => {
          setShowReviewModal(false);
          setPlaceForReview(null);
          setLastCheckInId(null);
        }}
        onSubmitted={() => {
          Alert.alert('Thank you!', 'Your review has been submitted.');
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  photoSection: {
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  photoGallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  photoItem: {
    position: 'relative',
  },
  smallPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
  },
  addPhotoButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: theme.colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
  },
  mainPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    marginTop: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  infoSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  infoRow: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  value: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  bioSection: {
    marginBottom: theme.spacing.md,
  },
  bioText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    lineHeight: 22,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  interestsSection: {
    marginTop: theme.spacing.md,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.sm,
  },
  interestTag: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeInterest: {
    marginLeft: theme.spacing.xs,
  },
  interestText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  postsSection: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  addButton: {
    padding: theme.spacing.xs,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  postItem: {
    width: '32.5%',
    aspectRatio: 1,
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postStats: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    gap: 8,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  postStatText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyPosts: {
    width: '100%',
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  createPostButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  createPostText: {
    color: 'white',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
  },
  checkInSection: {
    marginBottom: theme.spacing.xl,
  },
  checkInCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  checkInInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  checkInLocation: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
  },
  checkInDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  checkInTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  checkInFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  viewOnMapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewOnMapText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  checkInPrompt: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  checkInPromptText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
});

export default ProfileScreen;
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { showImagePickerOptions } from '../utils/imagePicker';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';
import { supabase } from '../integrations/supabase/client';
import { useSettings } from '../contexts/SettingsContext';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import PostUploadModal from '../components/PostUploadModal';
import CheckInModal from '../components/CheckInModal';
import ActivityDetailModal from '../components/ActivityDetailModal';
import CheckInDetailModal from '../components/CheckInDetailModal';
import { useActivities, Activity } from '../hooks/useActivities';
import { getActivityType, ACTIVITY_TYPES } from '../constants/activityTypes';
import AppLoading from '../components/AppLoading';
import SkillEditSection from '../components/SkillEditSection';

interface TimelineItem {
  id: string;
  type: 'post' | 'checkin';
  created_at: string;
  // Post fields
  media_url?: string;
  media_type?: 'photo' | 'video';
  caption?: string;
  likes_count?: number;
  comments_count?: number;
  // Check-in fields
  location_name?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  is_active?: boolean;
  expires_at?: string;
  activity_tag?: string;
  // User info
  user?: {
    id: string;
    name: string;
    photos: string[];
  };
}

// Default images
const DEFAULT_COVER_PHOTO = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=400&fit=crop';
const DEFAULT_PROFILE_PHOTO = 'https://ui-avatars.com/api/?background=FF1744&color=fff&size=200&font-size=0.5';

const { width } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - theme.spacing.lg * 2 - theme.spacing.xs * 2) / 3;

// Interests options
const INTERESTS_OPTIONS = [
  'Travel', 'Photography', 'Music', 'Sports', 'Art', 'Reading', 'Movies', 'Dancing',
  'Cooking', 'Gaming', 'Hiking', 'Fitness', 'Fashion', 'Food', 'Animals', 'Technology',
  'Nature', 'Coffee', 'Wine', 'Yoga', 'Running', 'Swimming', 'Cycling', 'Meditation',
  'Shopping', 'Concerts', 'Theater', 'Museums', 'Beaches', 'Mountains', 'Cities',
  'Adventure', 'Learning', 'Volunteering', 'Gardening', 'DIY', 'Entrepreneurship'
];

const ProfileScreenV2 = ({ navigation, route }: any) => {
  const { settings } = useSettings();
  const { getConnectionStatus } = useConnectionRequests();
  const {
    joinActivity,
    leaveActivity,
    cancelActivity,
    fetchComments,
    addComment,
    deleteComment,
  } = useActivities();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [userActivities, setUserActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedCheckIn, setSelectedCheckIn] = useState<TimelineItem | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    posts: 0,
    connections: 0,
    checkIns: 0,
    activities: 0,
  });

  const userId = route?.params?.userId;

  useEffect(() => {
    loadProfile();
  }, [userId]);

  // Clear profile state when userId changes to prevent showing wrong user
  useEffect(() => {
    setProfile({
      id: '',
      name: '',
      bio: '',
      age: 0,
      location: '',
      gender: '',
      looking_for: '',
      interests: [],
      photos: [],
      is_online: false,
      is_visible: true,
      cover_photo: null,
    });
    setTimeline([]);
    setUserActivities([]);
    setStats({ posts: 0, connections: 0, checkIns: 0, activities: 0 });
  }, [userId]);

  // Load profile on mount and when userId changes
  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log("🚀 ~ loadProfile ~ currentUser:", currentUser)
      if (!currentUser) return;

      setCurrentUserId(currentUser.id);

      const profileId = userId || currentUser.id;
      const isOwn = profileId === currentUser.id;
      setIsOwnProfile(isOwn);

      // Check if current user is blocked by this profile owner
      if (!isOwn) {
        const { data: blockedMe } = await supabase
          .from('blocked_users')
          .select('*')
          .eq('blocker_id', profileId)
          .eq('blocked_id', currentUser.id);
        
        // If the current user is blocked by this user, prevent access
        if (blockedMe && blockedMe.length > 0) {
          Alert.alert(
            'Profile Unavailable', 
            'You have been blocked by this user and cannot view their profile.',
            [
              {
                text: 'OK',
                onPress: () => {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  } else {
                    navigation.navigate('Home');
                  }
                }
              }
            ]
          );
          return;
        }
      }

      // Load profile data
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) throw error;
      
      
      setProfile(profileData);
      setShowAllInterests(false);

      // Check connection status if not own profile
      if (!isOwn) {
        const status = getConnectionStatus(profileId);
        setIsConnected(status === 'connected');
      }

      // Load timeline
      await loadTimeline(profileId);
      await loadStats(profileId);
      await loadUserActivities(profileId);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadUserActivities = async (profileId: string) => {
    try {
      // Get activities created by the user
      const { data: createdActivities, error: createdError } = await supabase
        .from('activities')
        .select(`
          *,
          creator:profiles!creator_id(id, name, photos)
        `)
        .eq('creator_id', profileId)
        .order('scheduled_at', { ascending: false })
        .limit(6);

      if (createdError) throw createdError;

      // Get activities the user has joined (but not created)
      const { data: participations, error: partError } = await supabase
        .from('activity_participants')
        .select('activity_id')
        .eq('user_id', profileId)
        .eq('status', 'joined');

      if (partError) throw partError;

      let joinedActivities: any[] = [];
      if (participations && participations.length > 0) {
        const activityIds = participations.map(p => p.activity_id);
        const { data: joined, error: joinedError } = await supabase
          .from('activities')
          .select(`
            *,
            creator:profiles!creator_id(id, name, photos)
          `)
          .in('id', activityIds)
          .neq('creator_id', profileId)
          .order('scheduled_at', { ascending: false })
          .limit(6);

        if (!joinedError && joined) {
          joinedActivities = joined;
        }
      }

      // Combine and fetch participants for all activities
      const allActivities = [...(createdActivities || []), ...joinedActivities];
      const activityIds = allActivities.map(a => a.id);

      if (activityIds.length > 0) {
        const { data: participants } = await supabase
          .from('activity_participants')
          .select(`
            *,
            user:profiles!user_id(id, name, photos)
          `)
          .in('activity_id', activityIds)
          .eq('status', 'joined');

        // Combine activities with their participants
        const activitiesWithParticipants = allActivities.map(activity => ({
          ...activity,
          participants: (participants || []).filter(p => p.activity_id === activity.id),
        }));

        setUserActivities(activitiesWithParticipants);
      } else {
        setUserActivities([]);
      }
    } catch (error) {
      console.error('Error loading user activities:', error);
    }
  };

  const loadTimeline = async (profileId: string) => {
    try {
      // Load posts (limit to 6 for profile page)
      const { data: posts } = await supabase
        .from('posts')
        .select(`
          *, 
          profiles!user_id(id, name, photos),
          post_likes(user_id),
          post_comments(id)
        `)
        .eq('user_id', profileId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(6);

      // Load check-ins
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('*, profiles!user_id(id, name, photos)')
        .eq('user_id', profileId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Combine and sort by date
      const timelineItems: TimelineItem[] = [
        ...(posts || []).map(post => ({
          ...post,
          type: 'post' as const,
          user: post.profiles,
          likes_count: post.post_likes?.length || 0,
          comments_count: post.post_comments?.length || 0,
        })),
        ...(checkIns || []).map(checkIn => ({
          ...checkIn,
          type: 'checkin' as const,
          user: checkIn.profiles,
        })),
      ].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTimeline(timelineItems);
    } catch (error) {
      console.error('Error loading timeline:', error);
    }
  };

  const loadStats = async (profileId: string) => {
    try {
      // Count posts
      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileId)
        .eq('is_deleted', false);

      // Count connections
      const { count: connectionsCount } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`);

      // Count active check-ins
      const { count: checkInsCount } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileId)
        .eq('is_active', true);

      // Count activities created by user
      const { count: activitiesCreatedCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', profileId)
        .in('status', ['open', 'full']);

      // Count activities user has joined
      const { count: activitiesJoinedCount } = await supabase
        .from('activity_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileId)
        .eq('status', 'joined');

      setStats({
        posts: postsCount || 0,
        connections: connectionsCount || 0,
        checkIns: checkInsCount || 0,
        activities: (activitiesCreatedCount || 0) + (activitiesJoinedCount || 0),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const startEditing = () => {
    setEditingProfile({ ...profile });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditingProfile(null);
    setIsEditing(false);
    setShowAllInterests(false);
  };

  const toggleInterest = (interest: string) => {
    const currentInterests = editingProfile?.interests || [];
    const newInterests = currentInterests.includes(interest)
      ? currentInterests.filter(i => i !== interest)
      : [...currentInterests, interest];
    setEditingProfile({ ...editingProfile, interests: newInterests });
  };

  const saveProfile = async () => {
    if (!editingProfile.name?.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    if (!editingProfile.interests || editingProfile.interests.length < 3) {
      Alert.alert('Error', 'Please select at least 3 interests');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          name: editingProfile.name.trim(),
          bio: editingProfile.bio?.trim() || null,
          location: editingProfile.location?.trim() || null,
          interests: editingProfile.interests,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update local profile state
      setProfile({ ...profile, ...editingProfile });
      setIsEditing(false);
      setEditingProfile(null);
      setShowAllInterests(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleViewOnMap = () => {
    if (profile && profile.is_online && profile.current_latitude && profile.current_longitude) {
      navigation.navigate('Home', {
        focusLocation: {
          latitude: profile?.current_latitude,
          longitude: profile?.current_longitude,
          userId: profile?.id,
        }
      });
    } else {
      Alert.alert('Location Not Available', 'This user is not currently sharing their location.');
    }
  };

  const handleChangeAvatar = async () => {
    showImagePickerOptions(
      {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      },
      async (imageUri) => {
        try {
          setUploadingCover(true); // Reuse the same loading state
        
        // Upload to storage
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Upload image
        const fileName = `avatar_${Date.now()}.jpg`;
        const filePath = `${user.id}/${fileName}`;

        const response = await fetch(imageUri);
        const blob = await response.blob();
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            
            const decode = atob(base64Data);
            const arrayBuffer = new Uint8Array(decode.length);
            for (let i = 0; i < decode.length; i++) {
              arrayBuffer[i] = decode.charCodeAt(i);
            }
            
            const { error: uploadError } = await supabase.storage
              .from('user-photos')
              .upload(filePath, arrayBuffer.buffer, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
              });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('user-photos')
              .getPublicUrl(filePath);

            // Update profile - replace first photo (avatar)
            const newPhotos = [...(profile.photos || [])];
            newPhotos[0] = publicUrl;

            const { error: updateError } = await supabase
              .from('profiles')
              .update({ photos: newPhotos })
              .eq('id', user.id);

            if (updateError) throw updateError;

            // Update local state
            setProfile(prev => ({ ...prev, photos: newPhotos }));
            Alert.alert('Success', 'Avatar updated!');
          } catch (error) {
            console.error('Error uploading avatar:', error);
            Alert.alert('Error', 'Failed to upload avatar');
          }
        };
        
        reader.readAsDataURL(blob);
        } catch (error) {
          console.error('Error changing avatar:', error);
          Alert.alert('Error', 'Failed to change avatar');
          setUploadingCover(false);
        }
      }
    );
  };

  const handleChangeCoverPhoto = async () => {
    showImagePickerOptions(
      {
        allowsEditing: true,
        aspect: [16, 6],
        quality: 0.8,
      },
      async (imageUri) => {
        try {
          setUploadingCover(true);
        
        // Upload to storage
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Upload image
        const fileName = `cover_${Date.now()}.jpg`;
        const filePath = `${user.id}/${fileName}`;

        const response = await fetch(imageUri);
        const blob = await response.blob();
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            
            const decode = atob(base64Data);
            const arrayBuffer = new Uint8Array(decode.length);
            for (let i = 0; i < decode.length; i++) {
              arrayBuffer[i] = decode.charCodeAt(i);
            }
            
            const { error: uploadError } = await supabase.storage
              .from('user-photos')
              .upload(filePath, arrayBuffer.buffer, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
              });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('user-photos')
              .getPublicUrl(filePath);

            // Update profile
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ cover_photo: publicUrl })
              .eq('id', user.id);

            if (updateError) throw updateError;

            // Update local state
            setProfile(prev => ({ ...prev, cover_photo: publicUrl }));
            Alert.alert('Success', 'Cover photo updated!');
          } catch (error) {
            console.error('Error uploading cover photo:', error);
            Alert.alert('Error', 'Failed to upload cover photo');
          }
        };
        
        reader.readAsDataURL(blob);
        } catch (error) {
          console.error('Error changing cover photo:', error);
          Alert.alert('Error', 'Failed to change cover photo');
          setUploadingCover(false);
        }
      }
    );
  };

  const renderPostGridItem = (item: TimelineItem, index: number) => (
    <TouchableOpacity 
      key={item.id}
      style={styles.gridPostItem}
      onPress={() => navigation.navigate('PostDetail', { 
        postId: item.id
      })}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: item.media_url }} 
        style={styles.gridPostImage}
        resizeMode="cover"
      />
      {item.media_type === 'video' && (
        <View style={styles.gridVideoOverlay}>
          <Ionicons name="play-circle" size={24} color="white" />
        </View>
      )}
      <View style={styles.gridPostStats}>
        <View style={styles.gridStatItem}>
          <Ionicons name="heart" size={12} color="white" />
          <Text style={styles.gridStatText}>{item.likes_count || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTimelineItem = (item: TimelineItem) => {
    if (item.type === 'post') {
      return (
        <View key={item.id} style={styles.timelineCard}>
          <View style={styles.timelineHeader}>
            <Image 
              source={{ uri: item.user?.photos?.[0] || `${DEFAULT_PROFILE_PHOTO}&name=${encodeURIComponent(item.user?.name || 'User')}&size=100` }} 
              style={styles.timelineAvatar}
            />
            <View style={styles.timelineHeaderText}>
              <Text style={styles.timelineName}>{item.user?.name || 'User'}</Text>
              <Text style={styles.timelineTime}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
          
          {item.caption && (
            <Text style={styles.timelineCaption}>{item.caption}</Text>
          )}
          
          {item.media_url && (
            <View style={styles.mediaContainer}>
              <Image 
                source={{ uri: item.media_url }} 
                style={styles.postMedia}
                resizeMode="cover"
              />
              {item.media_type === 'video' && (
                <View style={styles.videoPlayButton}>
                  <Ionicons name="play-circle" size={50} color="white" />
                </View>
              )}
            </View>
          )}
          
          <View style={styles.timelineActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="heart-outline" size={20} color={theme.colors.text} />
              <Text style={styles.actionText}>{item.likes_count || 0} Likes</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    } else {
      // Check-in item - simplified view
      const isExpired = item.expires_at ? new Date(item.expires_at).getTime() < Date.now() : false;
      const activityInfo = item.activity_tag ? ACTIVITY_TYPES.find(t => t.id === item.activity_tag) : null;

      return (
        <TouchableOpacity
          key={item.id}
          style={styles.checkInSimpleCard}
          onPress={() => setSelectedCheckIn(item)}
          activeOpacity={0.7}
        >
          {/* Activity Icon */}
          <View style={styles.checkInIconContainer}>
            <Ionicons
              name={(activityInfo?.icon || 'location') as any}
              size={24}
              color={theme.colors.primary}
            />
          </View>

          {/* Check-in Info */}
          <View style={styles.checkInSimpleInfo}>
            <Text style={styles.checkInSimpleLocation} numberOfLines={1}>
              {item.location_name}
            </Text>
            <View style={styles.checkInSimpleMeta}>
              <Text style={styles.checkInSimpleActivity}>
                {activityInfo?.label || 'Check-in'}
              </Text>
            </View>
            <Text style={styles.checkInSimpleDate}>
              {new Date(item.created_at).toLocaleDateString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>

          {/* Expired Badge or Chevron */}
          {isExpired ? (
            <View style={styles.expiredBadgeInline}>
              <Ionicons name="time-outline" size={12} color={theme.colors.textSecondary} />
              <Text style={styles.expiredBadgeText}>Expired</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          )}
        </TouchableOpacity>
      );
    }
  };

  if (loading || !profile || !profile.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <AppLoading />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.title}>My Profile</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Cover Photo */}
        <TouchableOpacity 
          style={styles.coverPhotoContainer}
          onPress={isOwnProfile && !uploadingCover ? handleChangeCoverPhoto : undefined}
          disabled={uploadingCover}
        >
          <Image 
            source={{ uri: profile?.cover_photo || DEFAULT_COVER_PHOTO }} 
            style={styles.coverPhoto}
            defaultSource={{ uri: DEFAULT_COVER_PHOTO }}
          />
          {isOwnProfile && (
            <View style={styles.changeCoverButton}>
              {uploadingCover ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="camera" size={20} color="white" />
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              style={styles.profilePhotoContainer}
              onPress={isOwnProfile && !uploadingCover ? handleChangeAvatar : undefined}
              disabled={uploadingCover}
            >
              <Image 
                source={{ uri: profile?.photos?.[0] || `${DEFAULT_PROFILE_PHOTO}&name=${encodeURIComponent(profile?.name || 'User')}` }} 
                style={styles.profilePhoto}
                defaultSource={{ uri: DEFAULT_PROFILE_PHOTO }}
              />
              {isOwnProfile && (
                <View style={styles.avatarEditOverlay}>
                  {uploadingCover ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="camera" size={16} color="white" />
                  )}
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              {/* Name with edit button - editable */}
              <View style={styles.nameContainer}>
                {isEditing ? (
                  <TextInput
                    style={styles.profileNameInput}
                    value={editingProfile?.name || ''}
                    onChangeText={(text) => setEditingProfile({...editingProfile, name: text})}
                    placeholder="Enter your name"
                    maxLength={50}
                  />
                ) : (
                  <Text style={styles.profileName}>{profile?.name || 'Loading...'}</Text>
                )}
                
                {/* Edit button for own profile */}
                {isOwnProfile && (
                  <TouchableOpacity 
                    style={styles.editButtonInline}
                    onPress={isEditing ? cancelEditing : startEditing}
                  >
                    <Ionicons 
                      name={isEditing ? "close" : "create-outline"} 
                      size={20} 
                      color={theme.colors.primary} 
                    />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Age and Gender */}
              <View style={styles.basicInfoContainer}>
                {profile?.age && profile.age > 0 && (
                  <Text style={styles.basicInfoText}>{profile.age} years old</Text>
                )}
                {profile?.age && profile.age > 0 && profile?.gender && (
                  <Text style={styles.basicInfoSeparator}> • </Text>
                )}
                {profile?.gender && profile.gender.length > 0 && (
                  <Text style={styles.basicInfoText}>
                    {profile.gender === 'male' ? 'Man' : 
                     profile.gender === 'female' ? 'Woman' : 
                     profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)}
                  </Text>
                )}
              </View>
              
              {/* Bio - editable */}
              {isEditing ? (
                <TextInput
                  style={styles.profileBioInput}
                  value={editingProfile?.bio || ''}
                  onChangeText={(text) => setEditingProfile({...editingProfile, bio: text})}
                  placeholder="What activities do you enjoy? What are you looking to do?"
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                />
              ) : (
                profile?.bio && profile.bio.length > 0 && <Text style={styles.profileBio}>{profile.bio}</Text>
              )}
              
              
              {/* Location - editable */}
              {isEditing ? (
                <View style={styles.locationEditContainer}>
                  <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                  <TextInput
                    style={styles.locationInput}
                    value={editingProfile?.location || ''}
                    onChangeText={(text) => setEditingProfile({...editingProfile, location: text})}
                    placeholder="Enter your location"
                    maxLength={100}
                  />
                </View>
              ) : (
                profile?.location && profile.location.length > 0 && (
                  <View style={styles.locationContainer}>
                    <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.locationText}>{profile.location}</Text>
                  </View>
                )
              )}
              
              {/* Interests */}
              {isEditing ? (
                <View style={styles.interestsEditContainer}>
                  <Text style={styles.interestsEditTitle}>
                    Interests (Select at least 3) - {editingProfile?.interests?.length || 0} selected
                  </Text>
                  <Text style={styles.interestsEditDescription}>
                    Select activities and interests to connect with like-minded people
                  </Text>
                  <View style={styles.interestsEditGrid}>
                    {INTERESTS_OPTIONS.map((interest) => (
                      <TouchableOpacity
                        key={interest}
                        style={[
                          styles.interestEditChip,
                          editingProfile?.interests?.includes(interest) && styles.interestEditChipSelected
                        ]}
                        onPress={() => toggleInterest(interest)}
                      >
                        <Text style={[
                          styles.interestEditText,
                          editingProfile?.interests?.includes(interest) && styles.interestEditTextSelected
                        ]}>
                          {interest}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                profile?.interests && profile.interests.length > 0 && (
                  <View style={styles.interestsContainer}>
                    <View style={styles.interestsList}>
                      {(showAllInterests ? profile.interests : profile.interests.slice(0, 4)).map((interest, index) => (
                        <View key={index} style={styles.interestTag}>
                          <Text style={styles.interestText}>{interest}</Text>
                        </View>
                      ))}
                      {!showAllInterests && profile.interests.length > 4 && (
                        <TouchableOpacity
                          style={styles.interestTag}
                          onPress={() => setShowAllInterests(true)}
                        >
                          <Text style={styles.interestText}>+{profile.interests.length - 4}</Text>
                        </TouchableOpacity>
                      )}
                      {showAllInterests && profile.interests.length > 4 && (
                        <TouchableOpacity
                          style={styles.interestTag}
                          onPress={() => setShowAllInterests(false)}
                        >
                          <Text style={styles.interestText}>Show less</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )
              )}
            </View>
          </View>

          {/* Skills Section - Full width outside profileHeader */}
          {isOwnProfile && (
            <View style={styles.skillsSection}>
              <SkillEditSection isEditing={isEditing} showTitle={true} />
            </View>
          )}

          {/* Action Buttons - Below Skills Section */}
          <View style={styles.profileActions}>
            {isOwnProfile ? (
              isEditing ? (
                <TouchableOpacity
                  style={[styles.primaryButton, saving && styles.buttonDisabled]}
                  onPress={saveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                  <Text style={styles.primaryButtonText}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => setShowPostModal(true)}
                  >
                    <Ionicons name="camera" size={16} color="white" />
                    <Text style={styles.primaryButtonText}>Add Post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setShowCheckInModal(true)}
                  >
                    <Ionicons name="location" size={16} color={theme.colors.primary} />
                    <Text style={styles.secondaryButtonText}>Check In</Text>
                  </TouchableOpacity>
                </>
              )
            ) : (
              <>
                {isConnected && profile?.is_online && (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleViewOnMap}
                  >
                    <Ionicons name="map" size={16} color="white" />
                    <Text style={styles.primaryButtonText}>View on Map</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={async () => {
                    if (!profile?.id) {
                      Alert.alert('Error', 'Unable to start chat. Please try again.');
                      return;
                    }

                    try {
                      // Get current user
                      const { data: { user: currentUser } } = await supabase.auth.getUser();
                      if (!currentUser) {
                        Alert.alert('Error', 'You must be logged in to start a chat.');
                        return;
                      }

                      // Create or find existing chat room
                      const { data: existingRoom } = await supabase
                        .from('chat_rooms')
                        .select('id')
                        .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${currentUser.id})`)
                        .single();

                      let roomId;
                      if (existingRoom) {
                        roomId = existingRoom.id;
                      } else {
                        // Create new chat room
                        const { data: newRoom, error } = await supabase
                          .from('chat_rooms')
                          .insert({
                            user1_id: currentUser.id,
                            user2_id: profile.id,
                            created_at: new Date().toISOString()
                          })
                          .select('id')
                          .single();

                        if (error) throw error;
                        roomId = newRoom.id;
                      }

                      navigation.navigate('ChatRoom', {
                        roomId: roomId,
                        otherUserId: profile.id,
                        otherUserName: profile.name
                      });
                    } catch (error) {
                      console.error('Error creating/finding chat room:', error);
                      Alert.alert('Error', 'Unable to start chat. Please try again.');
                    }
                  }}
                >
                  <Ionicons name="chatbubble" size={16} color={theme.colors.primary} />
                  <Text style={styles.secondaryButtonText}>Message</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.posts || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.connections || 0}</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.activities || 0}</Text>
              <Text style={styles.statLabel}>Activities</Text>
            </View>
          </View>
        </View>

        {/* Posts Grid */}
        <View style={styles.postsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Posts</Text>
            {(stats.posts || 0) > 6 && (
              <TouchableOpacity 
                onPress={() => navigation.navigate('AllPosts', { 
                  userId: profile?.id, 
                  userName: profile?.name 
                })}
              >
                <Text style={styles.viewAllLink}>View All ({stats.posts || 0})</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {timeline.filter(item => item.type === 'post').length > 0 ? (
            <View style={styles.postsGrid}>
              {timeline
                .filter(item => item.type === 'post')
                .map(renderPostGridItem)}
            </View>
          ) : (
            <View style={styles.emptyPosts}>
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          )}
        </View>

        {/* Activities Section */}
        <View style={styles.activitiesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activities</Text>
            {userActivities.length > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Activities')}
              >
                <Text style={styles.viewAllLink}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {userActivities.length > 0 ? (
            <View style={styles.activitiesList}>
              {userActivities.slice(0, 3).map((activity) => {
                const activityTypeInfo = getActivityType(activity.activity_type);
                const isCreator = activity.creator_id === profile?.id;
                const spotsLeft = activity.max_participants - activity.current_participants;
                const isPast = new Date(activity.scheduled_at).getTime() < Date.now() - 2 * 60 * 60 * 1000;
                const isStarted = !isPast && new Date(activity.scheduled_at).getTime() < Date.now();

                return (
                  <TouchableOpacity
                    key={activity.id}
                    style={styles.activityCard}
                    onPress={() => setSelectedActivity(activity)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.activityIconContainer}>
                      <Ionicons
                        name={(activityTypeInfo?.icon || 'calendar') as any}
                        size={24}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {activity.title}
                      </Text>
                      <View style={styles.activityMeta}>
                        <Text style={styles.activityType}>
                          {activityTypeInfo?.label || 'Activity'}
                        </Text>
                        <Text style={styles.activityDot}> • </Text>
                        <Text style={styles.activitySpots}>
                          {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
                        </Text>
                      </View>
                      <Text style={styles.activityDate}>
                        {new Date(activity.scheduled_at).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                    {/* Status badges */}
                    {isStarted && activity.status !== 'cancelled' ? (
                      <View style={styles.inProgressBadge}>
                        <Ionicons name="play-circle" size={12} color="#fff" />
                        <Text style={styles.inProgressBadgeText}>Live</Text>
                      </View>
                    ) : isPast && activity.status !== 'cancelled' ? (
                      <View style={styles.pastActivityBadge}>
                        <Ionicons name="time-outline" size={12} color={theme.colors.textSecondary} />
                        <Text style={styles.pastActivityBadgeText}>Past</Text>
                      </View>
                    ) : isCreator ? (
                      <View style={styles.creatorBadge}>
                        <Text style={styles.creatorBadgeText}>Creator</Text>
                      </View>
                    ) : null}
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyActivities}>
              <Ionicons name="calendar-outline" size={32} color={theme.colors.gray[300]} />
              <Text style={styles.emptyText}>No activities yet</Text>
              {isOwnProfile && (
                <TouchableOpacity
                  style={styles.createActivityButton}
                  onPress={() => navigation.navigate('Activities')}
                >
                  <Text style={styles.createActivityButtonText}>Create Activity</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Check-ins */}
        <View style={styles.checkInsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Check-ins</Text>
          </View>
          {timeline.filter(item => item.type === 'checkin').length > 0 ? (
            <View style={styles.checkInsList}>
              {timeline
                .filter(item => item.type === 'checkin')
                .map(renderTimelineItem)}
            </View>
          ) : (
            <View style={styles.emptyCheckIns}>
              <Text style={styles.emptyText}>No recent check-ins</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      {showPostModal && (
        <PostUploadModal
          visible={showPostModal}
          onClose={() => setShowPostModal(false)}
          onPostCreated={() => {
            if (profile?.id) {
              loadTimeline(profile.id);
            }
            setShowPostModal(false);
          }}
        />
      )}

      {showCheckInModal && (
        <CheckInModal
          visible={showCheckInModal}
          onClose={() => setShowCheckInModal(false)}
          onCheckIn={() => {
            if (profile?.id) {
              loadTimeline(profile.id);
              loadStats(profile.id); // Reload stats to update check-in count
            }
            setShowCheckInModal(false);
          }}
          currentLocation={settings.location}
        />
      )}

      {/* Activity Detail Modal */}
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
            // Reload activities
            if (profile?.id) {
              await loadUserActivities(profile.id);
              await loadStats(profile.id);
            }
            setSelectedActivity(null);
          }
        }}
        onViewProfile={(userId) => {
          setSelectedActivity(null);
          if (userId === currentUserId) {
            // Already on own profile, just close modal
          } else {
            navigation.navigate('UserProfile', { userId });
          }
        }}
        onCancel={async () => {
          if (selectedActivity) {
            await cancelActivity(selectedActivity.id);
            // Reload activities
            if (profile?.id) {
              await loadUserActivities(profile.id);
              await loadStats(profile.id);
            }
            setSelectedActivity(null);
          }
        }}
        fetchComments={fetchComments}
        addComment={addComment}
        deleteComment={deleteComment}
      />

      {/* Check-in Detail Modal */}
      <CheckInDetailModal
        visible={!!selectedCheckIn}
        onClose={() => setSelectedCheckIn(null)}
        checkIn={selectedCheckIn ? {
          id: selectedCheckIn.id,
          location_name: selectedCheckIn.location_name || '',
          description: selectedCheckIn.description,
          latitude: selectedCheckIn.latitude || 0,
          longitude: selectedCheckIn.longitude || 0,
          created_at: selectedCheckIn.created_at,
          expires_at: selectedCheckIn.expires_at,
          activity_tag: selectedCheckIn.activity_tag,
          profiles: selectedCheckIn.user ? {
            id: selectedCheckIn.user.id,
            name: selectedCheckIn.user.name,
            photos: selectedCheckIn.user.photos,
          } : undefined,
        } : null}
        onViewProfile={(userId) => {
          setSelectedCheckIn(null);
          if (userId === currentUserId) {
            // Already on own profile, just close modal
          } else {
            navigation.navigate('UserProfile', { userId });
          }
        }}
        onGetDirections={(lat, lng) => {
          setSelectedCheckIn(null);
          navigation.navigate('Home', {
            showCheckIn: {
              latitude: lat,
              longitude: lng,
              locationName: selectedCheckIn?.location_name || '',
              checkInId: selectedCheckIn?.id || '',
            },
          });
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editButtonInline: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPhotoContainer: {
    height: 250,
    position: 'relative',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
  },
  changeCoverButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
  },
  profileSection: {
    backgroundColor: theme.colors.surface,
    paddingBottom: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    marginTop: -100, // Pull up the section much closer to banner
  },
  profileHeader: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    paddingTop: 4, // Minimal top padding to bring content very close to banner
  },
  profilePhotoContainer: {
    marginTop: -50, // Pull the photo container up with moderate overlap
    width: 100, // Match the photo width to keep camera badge attached
    height: 100, // Match the photo height
    marginRight: theme.spacing.md, // Add some spacing from the profile info
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'white',
  },
  avatarEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
    paddingTop: theme.spacing.sm, // Reduce padding to bring info closer to banner
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  profileNameInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
    marginRight: 8,
  },
  basicInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  basicInfoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  basicInfoSeparator: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  profileBio: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  profileBioInput: {
    fontSize: 14,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  locationEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  interestsContainer: {
    marginTop: 8,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestTag: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  interestText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  interestsEditContainer: {
    marginTop: 12,
  },
  interestsEditTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  interestsEditDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  interestsEditGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestEditChip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestEditChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  interestEditText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
  interestEditTextSelected: {
    color: 'white',
  },
  profileActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: 4,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  timelineContainer: {
    paddingVertical: theme.spacing.sm,
  },
  timelineCard: {
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  timelineHeader: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  timelineAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  timelineHeaderText: {
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  timelineName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  timelineTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  timelineCaption: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  mediaContainer: {
    marginBottom: theme.spacing.md,
    position: 'relative',
  },
  postMedia: {
    width: '100%',
    height: 300,
    borderRadius: theme.borderRadius.md,
  },
  videoPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
  },
  timelineActions: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  checkInInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  checkInText: {
    fontSize: 14,
    color: theme.colors.primary,
    marginLeft: 4,
  },
  checkInDescription: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    fontStyle: 'italic',
  },
  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  checkInLocationName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    flex: 1,
  },
  viewOnMapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewOnMapText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  expiredContainer: {
    opacity: 0.6,
  },
  expiredBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[200],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    zIndex: 10,
  },
  expiredBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  expiredText: {
    color: theme.colors.textSecondary,
  },
  expiredCard: {
    borderLeftColor: theme.colors.gray[300],
  },
  expiredLocationName: {
    color: theme.colors.textSecondary,
  },
  // Simplified check-in card styles (matching activity card)
  checkInSimpleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  checkInIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkInIconExpired: {
    backgroundColor: theme.colors.gray[200],
  },
  checkInSimpleInfo: {
    flex: 1,
  },
  checkInSimpleLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  checkInSimpleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkInSimpleActivity: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  checkInSimpleDot: {
    color: theme.colors.textSecondary,
  },
  checkInSimpleDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  expiredBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[200],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  emptyTimeline: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  viewAllText: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  // Posts grid styles
  postsSection: {
    marginTop: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  viewAllLink: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  gridPostItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    position: 'relative',
  },
  gridPostImage: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  gridVideoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  gridPostStats: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    gap: 8,
  },
  gridStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
  },
  gridStatText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '500',
  },
  emptyPosts: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  skillsSection: {
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    width: '100%',
    alignSelf: 'stretch',
  },
  checkInsSection: {
    marginTop: theme.spacing.lg,
  },
  checkInsList: {
    paddingHorizontal: theme.spacing.lg,
  },
  emptyCheckIns: {
    marginHorizontal: theme.spacing.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  // Activities section styles
  activitiesSection: {
    marginTop: theme.spacing.lg,
  },
  activitiesList: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityType: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  activityDot: {
    color: theme.colors.textSecondary,
  },
  activitySpots: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  activityDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  creatorBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  creatorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  inProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  inProgressBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  pastActivityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[200],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  pastActivityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  emptyActivities: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: theme.spacing.lg,
  },
  createActivityButton: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  createActivityButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default ProfileScreenV2;
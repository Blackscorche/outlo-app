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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import { showImagePickerOptions } from '../utils/imagePicker';
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
import { useTheme } from '../contexts/ThemeContext';
import OutloLogo from '../components/OutloLogo';

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

const DEFAULT_PROFILE_PHOTO = 'https://ui-avatars.com/api/?background=FF1744&color=fff&size=200&font-size=0.5';

const { width } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - 24 * 2 - 4 * 2) / 3;
const HEADER_COLOR = '#0A1A0A';
const HEADER_COLOR_END = '#1B5E20';

const INTERESTS_OPTIONS = [
  'Travel', 'Photography', 'Music', 'Sports', 'Art', 'Reading', 'Movies', 'Dancing',
  'Cooking', 'Gaming', 'Hiking', 'Fitness', 'Fashion', 'Food', 'Animals', 'Technology',
  'Nature', 'Coffee', 'Wine', 'Yoga', 'Running', 'Swimming', 'Cycling', 'Meditation',
  'Shopping', 'Concerts', 'Theater', 'Museums', 'Beaches', 'Mountains', 'Cities',
  'Adventure', 'Learning', 'Volunteering', 'Gardening', 'DIY', 'Entrepreneurship'
];

const ProfileScreenV2 = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
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
    views: 0,
    likes: 0,
  });
  const [headerHeight, setHeaderHeight] = useState(160);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const userId = route?.params?.userId;

  useEffect(() => {
    loadProfile();
  }, [userId]);

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

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      setCurrentUserId(currentUser.id);

      const profileId = userId || currentUser.id;
      const isOwn = profileId === currentUser.id;
      setIsOwnProfile(isOwn);

      if (!isOwn) {
        const { data: blockedMe } = await supabase
          .from('blocked_users')
          .select('*')
          .eq('blocker_id', profileId)
          .eq('blocked_id', currentUser.id);

        if (blockedMe && blockedMe.length > 0) {
          Alert.alert(
            'Profile Unavailable',
            'You have been blocked by this user and cannot view their profile.',
            [{
              text: 'OK',
              onPress: () => {
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.navigate('Home');
              }
            }]
          );
          return;
        }
      }

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) throw error;

      setProfile(profileData);
      setShowAllInterests(false);

      if (!isOwn) {
        const status = getConnectionStatus(profileId);
        setIsConnected(status === 'connected');
      }

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
      const { data: createdActivities, error: createdError } = await supabase
        .from('activities')
        .select('*, creator:profiles!creator_id(id, name, photos)')
        .eq('creator_id', profileId)
        .order('scheduled_at', { ascending: false })
        .limit(6);

      if (createdError) throw createdError;

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
          .select('*, creator:profiles!creator_id(id, name, photos)')
          .in('id', activityIds)
          .neq('creator_id', profileId)
          .order('scheduled_at', { ascending: false })
          .limit(6);

        if (!joinedError && joined) joinedActivities = joined;
      }

      const allActivities = [...(createdActivities || []), ...joinedActivities];
      const activityIds = allActivities.map(a => a.id);

      if (activityIds.length > 0) {
        const { data: participants } = await supabase
          .from('activity_participants')
          .select('*, user:profiles!user_id(id, name, photos)')
          .in('activity_id', activityIds)
          .eq('status', 'joined');

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
      const { data: posts } = await supabase
        .from('posts')
        .select('*, profiles!user_id(id, name, photos), post_likes(user_id), post_comments(id)')
        .eq('user_id', profileId)
        .neq('is_deleted', true)
        .order('created_at', { ascending: false })
        .limit(6);

      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('*, profiles!user_id(id, name, photos)')
        .eq('user_id', profileId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

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
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTimeline(timelineItems);
    } catch (error) {
      console.error('Error loading timeline:', error);
    }
  };

  const loadStats = async (profileId: string) => {
    try {
      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileId)
        .neq('is_deleted', true);

      const { count: connectionsCount } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`);

      const { count: checkInsCount } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileId)
        .eq('is_active', true);

      const { count: activitiesCreatedCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', profileId)
        .in('status', ['open', 'full']);

      const { count: activitiesJoinedCount } = await supabase
        .from('activity_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileId)
        .eq('status', 'joined');

      // Count likes on user's posts
      let likesCount = 0;
      const { data: userPostIds } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', profileId)
        .eq('is_deleted', false);
      if (userPostIds && userPostIds.length > 0) {
        const { count: lc } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .in('post_id', userPostIds.map(p => p.id));
        likesCount = lc || 0;
      }

      setStats({
        posts: postsCount || 0,
        connections: connectionsCount || 0,
        checkIns: checkInsCount || 0,
        activities: (activitiesCreatedCount || 0) + (activitiesJoinedCount || 0),
        views: Math.floor(Math.random() * 1400) + 100,
        likes: likesCount,
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
          latitude: profile.current_latitude,
          longitude: profile.current_longitude,
          userId: profile.id,
        }
      });
    } else {
      Alert.alert('Location Not Available', 'This user is not currently sharing their location.');
    }
  };

  const handleEndCheckIn = async (checkIn: TimelineItem) => {
    Alert.alert(
      'End Check-in',
      `End check-in at ${checkIn.location_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('check_ins')
                .update({ is_active: false })
                .eq('id', checkIn.id);
              if (error) throw error;
              if (profile?.id) {
                await loadTimeline(profile.id);
                await loadStats(profile.id);
              }
            } catch (err) {
              console.error('Error ending check-in:', err);
              Alert.alert('Error', 'Failed to end check-in');
            }
          },
        },
      ]
    );
  };

  const uploadAvatarFromUri = async (imageUri: string) => {
    try {
      setUploadingCover(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

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

          const { data: { publicUrl } } = supabase.storage
            .from('user-photos')
            .getPublicUrl(filePath);

          const newPhotos = [...(profile.photos || [])];
          newPhotos[0] = publicUrl;

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ photos: newPhotos })
            .eq('id', user.id);
          if (updateError) throw updateError;

          setProfile(prev => ({ ...prev, photos: newPhotos }));
        } catch (error) {
          console.error('Error uploading avatar:', error);
          Alert.alert('Error', 'Failed to upload avatar');
        } finally {
          setUploadingCover(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error changing avatar:', error);
      Alert.alert('Error', 'Failed to change avatar');
      setUploadingCover(false);
    }
  };

  const handleAvatarFromLibrary = async () => {
    setShowAvatarModal(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await uploadAvatarFromUri(result.assets[0].uri);
    }
  };

  const handleAvatarFromCamera = async () => {
    setShowAvatarModal(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await uploadAvatarFromUri(result.assets[0].uri);
    }
  };

  const renderPostGridItem = (item: TimelineItem, index: number) => (
    <TouchableOpacity
      key={item.id}
      style={styles.gridPostItem}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
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

  const renderCheckInItem = (item: TimelineItem) => {
    const isExpired = item.expires_at ? new Date(item.expires_at).getTime() < Date.now() : false;
    const activityInfo = item.activity_tag ? ACTIVITY_TYPES.find(t => t.id === item.activity_tag) : null;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.checkInSimpleCard}
        onPress={() => setSelectedCheckIn(item)}
        activeOpacity={0.7}
      >
        <View style={styles.checkInIconContainer}>
          <Ionicons
            name={(activityInfo?.icon || 'location') as any}
            size={22}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.checkInSimpleInfo}>
          <Text style={styles.checkInSimpleLocation} numberOfLines={1}>
            {item.location_name}
          </Text>
          <Text style={styles.checkInSimpleActivity}>
            {activityInfo?.label || 'Check-in'}
          </Text>
          <Text style={styles.checkInSimpleDate}>
            {new Date(item.created_at).toLocaleDateString([], {
              weekday: 'short', month: 'short', day: 'numeric',
            })}
          </Text>
        </View>
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
  };

  // Derive active check-in from timeline (own profile only)
  const activeCheckIn = isOwnProfile
    ? timeline.find(item => item.type === 'checkin' && item.is_active !== false)
    : null;

  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  if (loading || !profile || !profile.id) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <AppLoading size="medium" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── NAV HEADER (same as ConnectionRequestsScreen) ── */}
      <View style={styles.navHeader}>
        {isOwnProfile ? (
          <TouchableOpacity onPress={() => navigation.navigate('Home')}>
            <OutloLogo style={styles.headerLogo} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.headerIconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.navHeaderTitle} numberOfLines={1}>
          {isOwnProfile ? 'My Profile' : (profile?.name || '')}
        </Text>
        <View style={styles.headerActions}>
          {isOwnProfile && (
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={isEditing ? cancelEditing : startEditing}
            >
              {isEditing
                ? <Ionicons name="close" size={20} color={theme.colors.primary} />
                : <Feather name="edit-2" size={18} color={theme.colors.primary} />
              }
            </TouchableOpacity>
          )}
          {!isOwnProfile && <View style={{ width: 40 }} />}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#0A0A0A' }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="white" />}
      >
        {/* ── HEADER ── */}
        <View
          style={styles.headerSection}
          onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          {/* Background: banner photo if set, otherwise gradient */}
          {profile?.cover_photo ? (
            <>
              <Image
                source={{ uri: profile.cover_photo }}
                style={{ position: 'absolute', top: 0, left: 0, width, height: headerHeight }}
                resizeMode="cover"
              />
              {/* Bottom-to-top dark gradient — stopOpacity must be separate from stopColor in react-native-svg */}
              <Svg style={{ position: 'absolute', top: 0, left: 0 }} width={width} height={headerHeight} preserveAspectRatio="none">
                <Defs>
                  <SvgLinearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#000" stopOpacity="0" />
                    <Stop offset="60%" stopColor="#000" stopOpacity="0.25" />
                    <Stop offset="100%" stopColor="#000" stopOpacity="0.65" />
                  </SvgLinearGradient>
                </Defs>
                <Rect width={width} height={headerHeight} fill="url(#overlay)" />
              </Svg>
            </>
          ) : (
            <Svg
              style={{ position: 'absolute', top: 0, left: 0 }}
              width={width}
              height={headerHeight}
              preserveAspectRatio="none"
            >
              <Defs>
                <SvgLinearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor={HEADER_COLOR} />
                  <Stop offset="100%" stopColor={HEADER_COLOR_END} />
                </SvgLinearGradient>
              </Defs>
              <Rect width={width} height={headerHeight} fill="url(#hg)" />
            </Svg>
          )}

          {/* Horizontal profile row */}
          <View style={styles.profileHorizontalRow}>
            {/* Avatar */}
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={isOwnProfile && !uploadingCover ? () => setShowAvatarModal(true) : undefined}
              activeOpacity={isOwnProfile ? 0.7 : 1}
            >
              {uploadingCover ? (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <ActivityIndicator size="large" color="white" />
                </View>
              ) : profile?.photos?.[0] ? (
                <Image
                  source={{ uri: profile.photos[0] }}
                  style={styles.avatar}
                  defaultSource={{ uri: `${DEFAULT_PROFILE_PHOTO}&name=${encodeURIComponent(profile?.name || '')}` }}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={36} color="rgba(255,255,255,0.8)" />
                </View>
              )}
              {/* Online dot – bottom right */}
              {profile?.is_online && <View style={styles.onlineDotAvatar} />}
            </TouchableOpacity>

            {/* Info column */}
            <View style={styles.profileInfoColumn}>
              {/* Name */}
              {isEditing ? (
                <TextInput
                  style={styles.nameInputHeader}
                  value={editingProfile?.name || ''}
                  onChangeText={t => setEditingProfile({ ...editingProfile, name: t })}
                  placeholder="Your name"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  maxLength={50}
                />
              ) : (
                <Text style={styles.profileNameHeader}>{profile?.name || ''}</Text>
              )}

              {/* Location · Online */}
              <View style={styles.infoMetaRow}>
                <Ionicons name="location-sharp" size={13} color="#FFD95A" />
                <Text style={styles.infoMetaText}>
                  {profile?.location || 'Location not set'}
                  {profile?.is_online ? ' • Online now' : ''}
                </Text>
              </View>

              {/* Joined */}
              {joinedDate ? (
                <View style={styles.infoMetaRow}>
                  <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.infoMetaText}>Joined {joinedDate}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Stats card — floats over gradient via negative marginTop */}
        <View style={styles.statsCardWrapper}>
          <View style={styles.statsCard}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => navigation.navigate('Connections')}
            >
              <Text style={styles.statNum}>{stats.connections}</Text>
              <Text style={styles.statLbl}>Connections</Text>
            </TouchableOpacity>
            <View style={styles.statSep} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.checkIns}</Text>
              <Text style={styles.statLbl}>Check-ins</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.views >= 1000 ? `${(stats.views / 1000).toFixed(1)}k` : stats.views}</Text>
              <Text style={styles.statLbl}>Profile Views</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.likes}</Text>
              <Text style={styles.statLbl}>Likes</Text>
            </View>
          </View>
        </View>

        {/* ── CONTENT ── */}
        <View style={styles.content}>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            {isOwnProfile ? (
              isEditing ? (
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={saveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="white" />
                      <Text style={styles.actionBtnText}>Save Changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.createPostBtn} onPress={() => setShowPostModal(true)}>
                    <Ionicons name="camera-outline" size={18} color="white" />
                    <Text style={styles.actionBtnText}>Create Post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.checkInActionBtn} onPress={() => setShowCheckInModal(true)}>
                    <Ionicons name="location-sharp" size={18} color="white" />
                    <Text style={styles.actionBtnText}>Check In</Text>
                  </TouchableOpacity>
                </>
              )
            ) : (
              <>
                {isConnected && profile?.is_online && (
                  <TouchableOpacity style={styles.createPostBtn} onPress={handleViewOnMap}>
                    <Ionicons name="map-outline" size={18} color="white" />
                    <Text style={styles.actionBtnText}>View on Map</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.checkInActionBtn}
                  onPress={async () => {
                    if (!profile?.id) { Alert.alert('Error', 'Unable to start chat.'); return; }
                    try {
                      const { data: { user: currentUser } } = await supabase.auth.getUser();
                      if (!currentUser) { Alert.alert('Error', 'You must be logged in.'); return; }
                      const { data: existingRoom } = await supabase
                        .from('chat_rooms')
                        .select('id')
                        .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${currentUser.id})`)
                        .single();
                      let roomId;
                      if (existingRoom) {
                        roomId = existingRoom.id;
                      } else {
                        const { data: newRoom, error } = await supabase
                          .from('chat_rooms')
                          .insert({ user1_id: currentUser.id, user2_id: profile.id, created_at: new Date().toISOString() })
                          .select('id').single();
                        if (error) throw error;
                        roomId = newRoom.id;
                      }
                      navigation.navigate('ChatRoom', { roomId, otherUserId: profile.id, otherUserName: profile.name });
                    } catch (error) {
                      console.error('Error creating/finding chat room:', error);
                      Alert.alert('Error', 'Unable to start chat.');
                    }
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="white" />
                  <Text style={styles.actionBtnText}>Message</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Currently Checked In */}
          {isOwnProfile && activeCheckIn && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Currently Checked In</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              </View>
              <View style={styles.card}>
                <View style={styles.checkInActiveRow}>
                  <View style={styles.checkInActiveIcon}>
                    <Ionicons name="location-sharp" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkInActiveName}>{activeCheckIn.location_name}</Text>
                    <Text style={styles.checkInActiveSub}>
                      {activeCheckIn.activity_tag
                        ? ACTIVITY_TYPES.find(t => t.id === activeCheckIn.activity_tag)?.label || 'Currently here'
                        : 'Currently here'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.endBtn} onPress={() => handleEndCheckIn(activeCheckIn)}>
                    <Text style={styles.endBtnText}>End</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* About Me */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <View style={styles.card}>
              {isEditing ? (
                <>
                  <TextInput
                    style={styles.bioEditInput}
                    value={editingProfile?.bio || ''}
                    onChangeText={t => setEditingProfile({ ...editingProfile, bio: t })}
                    placeholder="What activities do you enjoy?"
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={3}
                    maxLength={300}
                  />
                  <View style={styles.editFieldRow}>
                    <Text style={styles.editFieldLabel}>Location</Text>
                    <TextInput
                      style={styles.editFieldInput}
                      value={editingProfile?.location || ''}
                      onChangeText={t => setEditingProfile({ ...editingProfile, location: t })}
                      placeholder="City, Country"
                      placeholderTextColor={theme.colors.textSecondary}
                      maxLength={100}
                    />
                  </View>
                </>
              ) : (
                profile?.bio && profile.bio.length > 0 ? (
                  <Text style={styles.bioText}>{profile.bio}</Text>
                ) : (
                  isOwnProfile && (
                    <Text style={styles.bioPlaceholder}>No bio yet. Tap the edit button to add one!</Text>
                  )
                )
              )}

              {/* Interests */}
              {isEditing ? (
                <View style={styles.interestsEditContainer}>
                  <Text style={styles.interestsEditTitle}>
                    Interests ({editingProfile?.interests?.length || 0} selected — min 3)
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
                  <View style={styles.tagsRow}>
                    {(showAllInterests ? profile.interests : profile.interests.slice(0, 5)).map((interest, idx) => (
                      <View key={idx} style={styles.tagChip}>
                        <Text style={styles.tagText}>{interest}</Text>
                      </View>
                    ))}
                    {!showAllInterests && profile.interests.length > 5 && (
                      <TouchableOpacity style={styles.tagChip} onPress={() => setShowAllInterests(true)}>
                        <Text style={styles.tagText}>+{profile.interests.length - 5} more</Text>
                      </TouchableOpacity>
                    )}
                    {showAllInterests && profile.interests.length > 5 && (
                      <TouchableOpacity style={[styles.tagChip, { backgroundColor: '#2A2A2A' }]} onPress={() => setShowAllInterests(false)}>
                        <Text style={[styles.tagText, { color: '#B3B3B3' }]}>Show less</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              )}
            </View>
          </View>

          {/* Skills Section */}
          {isOwnProfile && (
            <View style={styles.section}>
              <SkillEditSection isEditing={isEditing} showTitle={true} />
            </View>
          )}

          {/* Posts Grid */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Posts</Text>
              {isOwnProfile && !isEditing && (
                <TouchableOpacity onPress={() => setShowPostModal(true)}>
                  <Text style={styles.addLink}>+ Add</Text>
                </TouchableOpacity>
              )}
              {(stats.posts || 0) > 6 && (
                <TouchableOpacity onPress={() => navigation.navigate('AllPosts', { userId: profile?.id, userName: profile?.name })}>
                  <Text style={styles.viewAllLink}>View All ({stats.posts})</Text>
                </TouchableOpacity>
              )}
            </View>
            {timeline.filter(item => item.type === 'post').length > 0 ? (
              <View style={styles.postsGrid}>
                {timeline.filter(item => item.type === 'post').map(renderPostGridItem)}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="images-outline" size={32} color={theme.colors.textSecondary} />
                <Text style={styles.emptyCardText}>No posts yet</Text>
                {isOwnProfile && (
                  <TouchableOpacity style={styles.emptyCardBtn} onPress={() => setShowPostModal(true)}>
                    <Text style={styles.emptyCardBtnText}>Create your first post</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Activities */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Activities</Text>
              {userActivities.length > 0 && (
                <TouchableOpacity onPress={() => navigation.navigate('Activities')}>
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
                        <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
                        <View style={styles.activityMeta}>
                          <Text style={styles.activityType}>{activityTypeInfo?.label || 'Activity'}</Text>
                          <Text style={styles.activityDot}> · </Text>
                          <Text style={styles.activitySpots}>{spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}</Text>
                        </View>
                        <Text style={styles.activityDate}>
                          {new Date(activity.scheduled_at).toLocaleDateString([], {
                            weekday: 'short', month: 'short', day: 'numeric',
                          })}
                        </Text>
                      </View>
                      {isStarted && activity.status !== 'cancelled' ? (
                        <View style={styles.liveBadgeSmall}>
                          <Text style={styles.liveBadgeSmallText}>Live</Text>
                        </View>
                      ) : isPast && activity.status !== 'cancelled' ? (
                        <View style={styles.pastBadge}>
                          <Text style={styles.pastBadgeText}>Past</Text>
                        </View>
                      ) : isCreator ? (
                        <View style={styles.creatorBadge}>
                          <Text style={styles.creatorBadgeText}>Creator</Text>
                        </View>
                      ) : null}
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="calendar-outline" size={32} color={theme.colors.textSecondary} />
                <Text style={styles.emptyCardText}>No activities yet</Text>
                {isOwnProfile && (
                  <TouchableOpacity style={styles.emptyCardBtn} onPress={() => navigation.navigate('Activities')}>
                    <Text style={styles.emptyCardBtnText}>Create Session</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Recent Check-ins */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Check-ins</Text>
            {timeline.filter(item => item.type === 'checkin').length > 0 ? (
              <View style={styles.checkInsList}>
                {timeline.filter(item => item.type === 'checkin').map(renderCheckInItem)}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="location-outline" size={32} color={theme.colors.textSecondary} />
                <Text style={styles.emptyCardText}>No recent check-ins</Text>
              </View>
            )}
          </View>

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      {/* ── AVATAR PICKER MODAL ── */}
      <Modal
        visible={showAvatarModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <TouchableOpacity
          style={styles.avatarModalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAvatarModal(false)}
        >
          <View style={styles.avatarModalSheet}>
            {/* Preview */}
            <View style={styles.avatarModalPreview}>
              {profile?.photos?.[0] ? (
                <Image source={{ uri: profile.photos[0] }} style={styles.avatarModalImage} />
              ) : (
                <View style={[styles.avatarModalImage, { backgroundColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={48} color="#9CA3AF" />
                </View>
              )}
            </View>
            <Text style={styles.avatarModalTitle}>Update Profile Photo</Text>
            <TouchableOpacity style={styles.avatarModalBtn} onPress={handleAvatarFromLibrary}>
              <Ionicons name="image-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.avatarModalBtnText}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarModalBtn} onPress={handleAvatarFromCamera}>
              <Ionicons name="camera-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.avatarModalBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarModalCancelBtn} onPress={() => setShowAvatarModal(false)}>
              <Text style={styles.avatarModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── MODALS ── */}
      {showPostModal && (
        <PostUploadModal
          visible={showPostModal}
          onClose={() => setShowPostModal(false)}
          onPostCreated={() => {
            if (profile?.id) loadTimeline(profile.id);
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
              loadStats(profile.id);
            }
            setShowCheckInModal(false);
          }}
          currentLocation={settings.location}
        />
      )}

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
            if (isParticipant) await leaveActivity(selectedActivity.id);
            else await joinActivity(selectedActivity.id);
            if (profile?.id) {
              await loadUserActivities(profile.id);
              await loadStats(profile.id);
            }
            setSelectedActivity(null);
          }
        }}
        onViewProfile={(uid) => {
          setSelectedActivity(null);
          if (uid !== currentUserId) navigation.navigate('UserProfile', { userId: uid });
        }}
        onCancel={async () => {
          if (selectedActivity) {
            await cancelActivity(selectedActivity.id);
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
        onViewProfile={(uid) => {
          setSelectedCheckIn(null);
          if (uid !== currentUserId) navigation.navigate('UserProfile', { userId: uid });
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

const makeStyles = (t: any) => StyleSheet.create({
  // ── Container ──
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },

  // ── Nav header (same as ConnectionRequestsScreen) ──
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: t.spacing.xs,
    paddingRight: t.spacing.md,
    paddingLeft: 12,
    backgroundColor: t.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  headerLogo: {
    width: 80,
    height: 26,
    marginLeft: 0,
  },
  navHeaderTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: t.colors.text,
    pointerEvents: 'none',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },

  // ── Profile card header ──
  headerSection: {
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  profileHorizontalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDotAvatar: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: 'white',
  },
  // Avatar picker modal
  avatarModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  avatarModalSheet: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
    alignItems: 'center',
  },
  avatarModalPreview: {
    marginBottom: 16,
  },
  avatarModalImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: 20,
  },
  avatarModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: t.colors.background,
    borderRadius: 12,
    marginBottom: 10,
  },
  avatarModalBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: t.colors.text,
  },
  avatarModalCancelBtn: {
    marginTop: 4,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  avatarModalCancelText: {
    fontSize: 16,
    color: t.colors.textSecondary,
  },
  profileInfoColumn: {
    flex: 1,
    gap: 5,
  },
  profileNameHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  nameInputHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
    paddingVertical: 2,
  },
  infoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoMetaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    flexShrink: 1,
  },

  // ── Content ──
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: t.colors.background,
  },

  // Stats card wrapper — pulls card up to overlap gradient
  statsCardWrapper: {
    marginTop: -14,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  // Stats card
  statsCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: t.colors.border,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '700',
    color: t.colors.text,
  },
  statLbl: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  statSep: {
    width: 1,
    backgroundColor: t.colors.border,
    marginVertical: 4,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  createPostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 13,
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: t.colors.text,
  },
  addLink: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  viewAllLink: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },

  // Card
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  // Currently Checked In
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4CAF50',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4CAF50',
  },
  checkInActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkInActiveIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkInIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkInSimpleLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: t.colors.text,
  },
  checkInActiveSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  endBtn: {
    backgroundColor: '#2A1515',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  endBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },

  // About Me
  bioText: {
    fontSize: 14,
    color: t.colors.text,
    lineHeight: 22,
  },
  bioPlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  bioEditInput: {
    fontSize: 14,
    color: t.colors.text,
    textAlignVertical: 'top',
    minHeight: 70,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  editFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  editFieldLabel: {
    fontSize: 13,
    color: '#6B7280',
    width: 70,
  },
  editFieldInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: t.colors.text,
    backgroundColor: t.colors.inputBg,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tagChip: {
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.25)',
  },
  tagText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
  },
  interestsEditContainer: {
    marginTop: 10,
  },
  interestsEditTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: t.colors.textSecondary,
    marginBottom: 8,
  },
  interestsEditGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestEditChip: {
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestEditChipSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  interestEditText: {
    fontSize: 12,
    color: t.colors.textSecondary,
    fontWeight: '500',
  },
  interestEditTextSelected: {
    color: 'white',
  },

  // Posts grid
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  gridPostItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    position: 'relative',
  },
  gridPostImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  gridVideoOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridPostStats: {
    position: 'absolute',
    bottom: 5,
    left: 5,
  },
  gridStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  gridStatText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
  },

  // Activities
  activitiesList: {
    gap: 8,
  },
  activityCard: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  activityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: t.colors.text,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  activityType: {
    fontSize: 12,
    color: '#6B7280',
  },
  activityDot: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  activitySpots: {
    fontSize: 12,
    color: '#6B7280',
  },
  activityDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  liveBadgeSmall: {
    backgroundColor: '#1A2E1A',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  liveBadgeSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  pastBadge: {
    backgroundColor: t.colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  pastBadgeText: {
    fontSize: 11,
    color: '#6B7280',
  },
  creatorBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  creatorBadgeText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
  },

  // Check-ins list
  checkInsList: {
    gap: 8,
  },
  checkInSimpleCard: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  checkInIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkInSimpleInfo: {
    flex: 1,
  },
  checkInSimpleLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  checkInSimpleActivity: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  checkInSimpleDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  expiredBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expiredBadgeText: {
    fontSize: 11,
    color: '#6B7280',
  },

  // Empty state
  emptyCard: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 12,
  },
  emptyCardBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
  },
  emptyCardBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProfileScreenV2;

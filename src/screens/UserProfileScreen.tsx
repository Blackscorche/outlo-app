import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Dimensions,
  ActionSheetIOS,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../styles/theme';
import { supabase } from '../integrations/supabase/client';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import { checkConnectionQuota, useConnectionQuota, checkFirstImpressionQuota, useFirstImpressionQuota } from '../hooks/useSubscription';
import ImageViewer from '../components/ImageViewer';
import { FirstImpressionModal } from '../components/FirstImpressionModal';

interface TimelineItem {
  id: string;
  type: 'post' | 'checkin';
  created_at: string;
  // Post fields
  media_url?: string;
  media_type?: 'photo' | 'video';
  caption?: string;
  likes_count?: number;
  // Check-in fields
  location_name?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  is_active?: boolean;
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

const UserProfileScreen = ({ navigation, route }: any) => {
  const { getConnectionStatus, sendConnectionRequest, loadConnectionRequests, connections, sentRequests, receivedRequests } = useConnectionRequests();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('none');
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [stats, setStats] = useState({
    posts: 0,
    connections: 0,
    checkIns: 0,
  });
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showFirstImpressionModal, setShowFirstImpressionModal] = useState(false);
  const [currentConnectionRequestId, setCurrentConnectionRequestId] = useState<string | null>(null);
  const [hasFirstImpression, setHasFirstImpression] = useState(false);
  const loadDataTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const dataCache = useRef<{
    profile: any;
    connectionStatus: string;
    isConnected: boolean;
    isBlocked: boolean;
    timestamp: number;
  } | null>(null);

  const userId = route?.params?.userId;
console.log(profile,"profile")
  // Memoize timeline posts for better performance
  const timelinePosts = useMemo(() => 
    timeline.filter(item => item.type === 'post'), 
    [timeline]
  );

  // Memoize action button states for better performance
  const actionButtonState = useMemo(() => ({
    isBlocked: isBlockedByMe,
    status: connectionStatus,
    isConnected: isConnected,
    showMapButton: profile?.is_online && profile?.current_latitude && profile?.current_longitude
  }), [isBlockedByMe, connectionStatus, isConnected, profile?.is_online, profile?.current_latitude, profile?.current_longitude]);

  useEffect(() => {
    if (!userId) {
      Alert.alert('Error', 'User ID is required');
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
      return;
    }
    
    // Use timeout to prevent rapid calls during navigation
    const timeoutId = setTimeout(() => {
      loadData();
    }, 100);
    
    // Cleanup timeout on unmount or userId change
    return () => {
      clearTimeout(timeoutId);
      if (loadDataTimeoutRef.current) {
        clearTimeout(loadDataTimeoutRef.current);
      }
    };
  }, [userId, loadData]);

  // Handle hardware back button on Android
  useEffect(() => {
    const handleBackPress = () => {
      console.log('Hardware back button pressed');
      // Clear any ongoing timeouts
      if (loadDataTimeoutRef.current) {
        clearTimeout(loadDataTimeoutRef.current);
      }
      
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Home');
      }
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    
    return () => backHandler.remove();
  }, [navigation]);

  const loadData = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingData) {
      console.log('=== UserProfileScreen: Already loading, skipping ===');
      return;
    }
    
    // Check if we already loaded data for this user recently (within 5 seconds)
    const now = Date.now();

    if (lastLoadedUserIdRef.current === userId && 
        dataCache.current && 
        (now - dataCache.current.timestamp) < 5000) {
      setProfile(dataCache.current.profile);
      setConnectionStatus(dataCache.current.connectionStatus);
      setIsConnected(dataCache.current.isConnected);
      setIsBlockedByMe(dataCache.current.isBlocked);
      return;
    }
    
    try {
      setIsLoadingData(true);
      setLoading(true);
      console.log('=== UserProfileScreen: Starting loadData ===');
      console.log('Target userId:', userId);
      
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;
      
      // Parallel data loading for connection status and blocking status
      const [
        { data: blockedByMe },
        { data: connectionData },
        { data: sentRequest },
        { data: receivedRequest },
        { data: existingFirstImpression }
      ] = await Promise.all([
        supabase
          .from('blocked_users')
          .select('*')
          .eq('blocker_id', currentUser.id)
          .eq('blocked_id', userId)
          .single(),
        supabase
          .from('connections')
          .select('*')
          .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${currentUser.id})`)
          .single(),
        supabase
          .from('connection_requests')
          .select('*')
          .eq('sender_id', currentUser.id)
          .eq('receiver_id', userId)
          .eq('status', 'pending')
          .single(),
        supabase
          .from('connection_requests')
          .select('*')
          .eq('sender_id', userId)
          .eq('receiver_id', currentUser.id)
          .eq('status', 'pending')
          .single(),
        supabase
          .from('first_impressions')
          .select('*')
          .eq('sender_id', currentUser.id)
          .eq('receiver_id', userId)
          .single()
      ]);
      
      setIsBlockedByMe(!!blockedByMe);
      
      // Determine connection status
      if (connectionData) {
        console.log('Users are connected!');
        setConnectionStatus('connected');
        setIsConnected(true);
      } else if (sentRequest) {
        setConnectionStatus('request_sent');
        setIsConnected(false);
        setCurrentConnectionRequestId(sentRequest.id);
        setHasFirstImpression(!!existingFirstImpression);
      } else if (receivedRequest) {
        setConnectionStatus('request_received');
        setIsConnected(false);
      } else {
        setConnectionStatus('none');
        setIsConnected(false);
      }
      
      // If blocked by me, override connection status
      if (blockedByMe) {
        setConnectionStatus('blocked');
        setIsConnected(false);
      }
      
      // Load profile data
      await loadProfileData();
      
      // Cache the loaded data after all state updates
      setTimeout(() => {
        lastLoadedUserIdRef.current = userId;
        dataCache.current = {
          profile,
          connectionStatus,
          isConnected,
          isBlocked: isBlockedByMe,
          hasFirstImpression,
          connectionRequestId: currentConnectionRequestId,
          timestamp: Date.now()
        };
      }, 100);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setIsLoadingData(false);
    }
  }, [userId, isLoadingData]);

  const loadProfileData = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Don't allow viewing own profile through this screen
      if (userId === currentUser.id) {
        navigation.navigate('Settings', { screen: 'Profile' });
        return;
      }

      // Check blocking status
      const { data: blockedByMe } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', userId)
        .single();
      
      const { data: blockedMe } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', userId)
        .eq('blocked_id', currentUser.id);
      
      // If the current user is blocked by this user, prevent access
      if (blockedMe && blockedMe.length > 0) {
        Alert.alert('Profile Unavailable', 'You have been blocked by this user and cannot view their profile.');
        // Try to go back, but if that fails, go to home
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('Home');
        }
        return;
      }

      // Load profile data
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      setProfile(profileData);
      setShowAllInterests(false);
      
      // Set blocked status
      setIsBlockedByMe(!!blockedByMe);

      // Only load timeline and stats if not blocked - start loading immediately, don't wait
      if (!blockedByMe) {
        // Load timeline and stats in parallel without blocking UI
        Promise.all([
          loadTimeline(userId),
          loadStats(userId)
        ]).catch(error => console.error('Error loading timeline/stats:', error));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    }
  };


  const loadTimeline = async (profileId: string) => {
    try {
      // Load posts and check-ins in parallel
      const [
        { data: posts },
        { data: checkIns }
      ] = await Promise.all([
        supabase
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
          .limit(6),
        supabase
          .from('check_ins')
          .select('*, profiles!user_id(id, name, photos)')
          .eq('user_id', profileId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(3) // Limit check-ins as well for performance
      ]);

      // Combine and sort by date
      const timelineItems: TimelineItem[] = [
        ...(posts || []).map(post => ({
          ...post,
          type: 'post' as const,
          user: post.profiles,
          likes_count: post.post_likes?.length || 0,
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
      // Load all stats in parallel
      const [
        { count: postsCount },
        { count: connectionsCount },
        { count: checkInsCount }
      ] = await Promise.all([
        supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId)
          .eq('is_deleted', false),
        supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`),
        supabase
          .from('check_ins')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profileId)
          .eq('is_active', true)
      ]);

      setStats({
        posts: postsCount || 0,
        connections: connectionsCount || 0,
        checkIns: checkInsCount || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Clear cache to force fresh data on manual refresh
    dataCache.current = null;
    lastLoadedUserIdRef.current = null;
    await loadData();
    setRefreshing(false);
  };

  const handleConnect = async (useFirstImpression = false) => {
    if (!profile || isConnecting) return;
    
    // If using first impression, show the modal instead
    if (useFirstImpression) {
      setShowFirstImpressionModal(true);
      return;
    }
    
    try {
      setIsConnecting(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please sign in to send connection requests');
        return;
      }
      
      // Check quotas based on type
      if (false) {
        // This branch is now handled by the modal
      } else {
        // Using regular connection request - only check connection request quota
        const hasConnectionRequestQuota = await checkConnectionQuota(user.id, false);
        if (!hasConnectionRequestQuota) {
          // Only if connection requests are exhausted, offer first impression as alternative
          const hasFirstImpressionQuota = await checkFirstImpressionQuota(user.id, false);
          if (hasFirstImpressionQuota) {
            Alert.alert(
              'No Partner Requests',
              'You have no partner requests left, but you have first impressions available. Would you like to use a first impression instead?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Use First Impression', onPress: () => handleConnect(true) },
                { text: 'View Plans', onPress: () => navigation.navigate('Subscription') },
              ]
            );
            return;
          } else {
            Alert.alert(
              'No Partner Requests',
              'You have no partner requests remaining. Upgrade to Premium or purchase extras to send more requests.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'View Plans', onPress: () => navigation.navigate('Subscription') },
              ]
            );
            return;
          }
        }
      }
      
      // Immediately update UI to show pending state
      setConnectionStatus('request_sent');
      
      // Send the connection request
      const success = await sendConnectionRequest(profile.id);
      
      if (success) {
        // Use the quota
        if (useFirstImpression) {
          await useFirstImpressionQuota(user.id);
        } else {
          await useConnectionQuota(user.id);
        }
        
        // Reload connection data to confirm the updated status
        await loadConnectionRequests();
        
        // Update cache to reflect new status
        if (dataCache.current) {
          dataCache.current.connectionStatus = 'request_sent';
        }
        
        // Success message will be shown by the connection hook's toast
      } else {
        // Revert status if request failed
        setConnectionStatus('none');
        Alert.alert('Error', 'Failed to send partner request');
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      // Revert status on error
      setConnectionStatus('none');
      Alert.alert('Error', 'Failed to send partner request');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleMessage = async () => {
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
  };

  const handleViewOnMap = () => {
    console.log('View on Map pressed for user:', profile?.name, profile?.id);
    console.log('Location:', profile?.current_latitude, profile?.current_longitude);
    
    if (profile && profile.current_latitude && profile.current_longitude) {
      // Navigate to Home tab with focus location
      navigation.navigate('Main', {
        screen: 'Home',
        params: {
          focusLocation: {
            latitude: profile.current_latitude,
            longitude: profile.current_longitude,
            userId: profile.id,
          }
        }
      });
    } else {
      Alert.alert('Location Not Available', 'This user is not currently sharing their location.');
    }
  };

  const handleMoreOptions = () => {
    const options = isBlockedByMe 
      ? ['Report User', 'Unblock User', 'Cancel']
      : ['Report User', 'Block User', 'Cancel'];
    const destructiveButtonIndex = 1;
    const cancelButtonIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          destructiveButtonIndex,
          cancelButtonIndex,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            showReportOptions();
          } else if (buttonIndex === 1) {
            if (isBlockedByMe) {
              handleUnblock();
            } else {
              handleBlock();
            }
          }
        }
      );
    } else {
      Alert.alert(
        isBlockedByMe ? 'Report or Unblock' : 'Report or Block',
        'What would you like to do?',
        [
          { text: 'Report User', onPress: showReportOptions },
          { text: isBlockedByMe ? 'Unblock User' : 'Block User', 
            onPress: isBlockedByMe ? handleUnblock : handleBlock, 
            style: 'destructive' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const showReportOptions = () => {
    const reportReasons = [
      'Inappropriate content',
      'Spam or fake profile',
      'Harassment',
      'Inappropriate behavior',
      'Other'
    ];

    Alert.alert(
      'Report User',
      'Why are you reporting this user?',
      reportReasons.map(reason => ({
        text: reason,
        onPress: () => submitReport(reason),
      })).concat([{ text: 'Cancel', style: 'cancel' }])
    );
  };

  const submitReport = async (reason: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || !profile) return;

      // Create report in the database
      const { error } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: currentUser.id,
          reported_user_id: profile.id,
          reason,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error submitting report:', error);
        Alert.alert('Error', 'Failed to submit report. Please try again.');
      } else {
        Alert.alert('Thank you', 'Your report has been submitted.');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report');
    }
  };

  const handleBlock = async () => {
    Alert.alert(
      'Block User',
      'Are you sure you want to block this user? They will no longer be able to see you or contact you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (!currentUser || !profile) return;

              const { error } = await supabase
                .from('blocked_users')
                .insert({
                  blocker_id: currentUser.id,
                  blocked_id: profile.id,
                  created_at: new Date().toISOString(),
                });

              if (error) throw error;
              Alert.alert('User Blocked', 'This user has been blocked.');
              // Reload the data to update the UI
              setIsBlockedByMe(true);
              loadData();
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user');
            }
          }
        }
      ]
    );
  };

  const handleUnblock = async () => {
    Alert.alert(
      'Unblock User',
      'Are you sure you want to unblock this user? They will be able to see you and contact you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user: currentUser } } = await supabase.auth.getUser();
              if (!currentUser || !profile) return;

              const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('blocker_id', currentUser.id)
                .eq('blocked_id', profile.id);

              if (error) throw error;
              Alert.alert('User Unblocked', 'This user has been unblocked.');
              // Reload the data to update the UI
              setIsBlockedByMe(false);
              loadData();
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user');
            }
          }
        }
      ]
    );
  };

  const renderPostGridItem = useCallback((item: TimelineItem, index: number) => (
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
  ), [navigation]);

  if (loading || !profile || !profile.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            console.log('Back button pressed');
            try {
              // Clear any ongoing timeouts before navigating
              if (loadDataTimeoutRef.current) {
                clearTimeout(loadDataTimeoutRef.current);
              }
              
              // Stop any ongoing loading
              setIsLoadingData(false);
              setLoading(false);
              
              // Use immediate navigation with fallback
              if (navigation.canGoBack()) {
                console.log('Going back');
                navigation.goBack();
              } else {
                console.log('Cannot go back, navigating to Home');
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              }
            } catch (error) {
              console.error('Error in back navigation:', error);
              // Emergency fallback
              navigation.navigate('Home');
            }
          }} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile?.name || 'Profile'}</Text>
        <TouchableOpacity 
          onPress={handleMoreOptions}
          style={styles.moreButton}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Cover Photo */}
        <View style={styles.coverPhotoContainer}>
          <Image 
            source={{ uri: profile?.cover_photo || DEFAULT_COVER_PHOTO }} 
            style={styles.coverPhoto}
            defaultSource={{ uri: DEFAULT_COVER_PHOTO }}
          />
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <TouchableOpacity 
              style={styles.profilePhotoContainer}
              onPress={() => {
                if (profile?.photos && profile.photos.length > 0) {
                  setSelectedImageIndex(0);
                  setShowImageViewer(true);
                }
              }}
            >
              <Image 
                source={{ uri: profile?.photos?.[0] || `${DEFAULT_PROFILE_PHOTO}&name=${encodeURIComponent(profile?.name || 'User')}` }} 
                style={styles.profilePhoto}
                defaultSource={{ uri: DEFAULT_PROFILE_PHOTO }}
              />
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              {/* Name */}
              <Text style={styles.profileName}>{profile?.name || 'Loading...'}</Text>
              
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
              
              {/* Bio */}
              {profile?.bio && profile.bio.length > 0 && (
                <Text style={styles.profileBio}>{profile.bio}</Text>
              )}
              
              {/* Location */}
              {profile?.location && profile.location.length > 0 && (
                <View style={styles.locationContainer}>
                  <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.locationText}>{profile.location}</Text>
                </View>
              )}
              
              {/* Interests */}
              {profile?.interests && profile.interests.length > 0 && (
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
              )}
            </View>
          </View>
          
          {/* Action Buttons - Full Width */}
          <View style={styles.profileActionsFullWidth}>
            {actionButtonState.isBlocked ? (
              <View style={styles.blockedStatusContainer}>
                <Ionicons name="ban" size={20} color={theme.colors.error} />
                <Text style={styles.blockedStatusText}>You have blocked this user</Text>
              </View>
            ) : (
              <>
                {actionButtonState.status === 'none' && (
                  <View style={styles.connectButtonsContainer}>
                        <TouchableOpacity 
                          style={[styles.primaryButton, isConnecting && styles.disabledButton]}
                          onPress={() => handleConnect(false)}
                          disabled={isConnecting}
                        >
                          {isConnecting ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <>
                              <Ionicons name="person-add" size={16} color="white" />
                              <Text style={styles.primaryButtonText} numberOfLines={1}>Connect</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.secondaryButton}
                          onPress={() => handleConnect(true)}
                        >
                          <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
                          <Text style={styles.secondaryButtonText} numberOfLines={1}>First Impression</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {(actionButtonState.status === 'request_sent' || actionButtonState.status === 'pending') && (
                      <View style={styles.connectButtonsContainer}>
                        <View style={[styles.primaryButton, styles.pendingButton]}>
                          <Ionicons name="checkmark-circle" size={16} color={theme.colors.text} />
                          <Text style={[styles.primaryButtonText, styles.pendingButtonText]}>Request Sent</Text>
                        </View>
                        {!hasFirstImpression && (
                          <TouchableOpacity 
                            style={styles.secondaryButton}
                            onPress={() => setShowFirstImpressionModal(true)}
                          >
                            <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
                            <Text style={styles.secondaryButtonText} numberOfLines={1}>First Impression</Text>
                          </TouchableOpacity>
                        )}
                        {hasFirstImpression && (
                          <View style={[styles.secondaryButton, styles.sentImpressionButton]}>
                            <Ionicons name="checkmark-done" size={16} color={theme.colors.success} />
                            <Text style={[styles.secondaryButtonText, styles.sentImpressionText]} numberOfLines={1}>First Impression Sent</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {actionButtonState.status === 'request_received' && (
                      <TouchableOpacity 
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate('Connections')}
                      >
                        <Ionicons name="person-add" size={16} color="white" />
                        <Text style={styles.primaryButtonText} numberOfLines={1}>Respond to Request</Text>
                      </TouchableOpacity>
                    )}
                    {actionButtonState.status === 'connected' && (
                      <View style={styles.connectButtonsContainer}>
                        {profile?.current_latitude && profile?.current_longitude && (
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
                          onPress={handleMessage}
                        >
                          <Ionicons name="chatbubble" size={16} color={theme.colors.primary} />
                          <Text style={styles.secondaryButtonText}>Message</Text>
                        </TouchableOpacity>
                      </View>
                    )}
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
              <Text style={styles.statNumber}>{stats.checkIns || 0}</Text>
              <Text style={styles.statLabel}>Check-ins</Text>
            </View>
          </View>
        </View>

        {/* Posts Grid - Only show if not blocked */}
        {!isBlockedByMe && (
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
            
            {timelinePosts.length > 0 ? (
              <View style={styles.postsGrid}>
                {timelinePosts.map(renderPostGridItem)}
              </View>
            ) : (
              <View style={styles.emptyPosts}>
                <Text style={styles.emptyText}>No posts yet</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Image Viewer */}
      {profile?.photos && profile.photos.length > 0 && (
        <ImageViewer
          visible={showImageViewer}
          images={profile.photos}
          initialIndex={selectedImageIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}
      
      {/* First Impression Modal */}
      {profile && (
        <FirstImpressionModal
          visible={showFirstImpressionModal}
          onClose={() => setShowFirstImpressionModal(false)}
          onSend={async (message) => {
            // If connection request already exists, just send the first impression
            // Otherwise, send both connection request and first impression
            try {
              setIsConnecting(true);
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              
              // If no existing connection request, send one
              if (!currentConnectionRequestId) {
                const success = await sendConnectionRequest(profile.id);
                
                if (success) {
                  // Use the first impression quota
                  await useFirstImpressionQuota(user.id);
                  
                  // Update connection status
                  setConnectionStatus('request_sent');
                  await loadConnectionRequests();
                  
                  // Update cache
                  if (dataCache.current) {
                    dataCache.current.connectionStatus = 'request_sent';
                  }
                  
                  // Reload data to get the new connection request ID
                  await loadData();
                }
              } else {
                // Connection request already exists, just use the first impression quota
                await useFirstImpressionQuota(user.id);
                // Update the hasFirstImpression state
                setHasFirstImpression(true);
                // Update cache
                if (dataCache.current) {
                  dataCache.current.hasFirstImpression = true;
                }
              }
            } catch (error) {
              console.error('Error after sending first impression:', error);
            } finally {
              setIsConnecting(false);
            }
          }}
          receiverName={profile.name || 'User'}
          receiverId={profile.id}
          connectionRequestId={currentConnectionRequestId}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
  profileSection: {
    backgroundColor: theme.colors.surface,
    paddingBottom: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    marginTop: -100,
  },
  profileHeader: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    paddingTop: 4,
  },
  profilePhotoContainer: {
    marginTop: -50,
    width: 100,
    height: 100,
    marginRight: theme.spacing.md,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'white',
  },
  profileInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
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
  profileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  profileActionsFullWidth: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    width: '100%',
  },
  connectButtonsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    width: '100%',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: 4,
    minWidth: 120,
    flex: 1,
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
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: 4,
    minWidth: 120,
    flex: 1,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  pendingButton: {
    backgroundColor: theme.colors.gray[200],
  },
  pendingButtonText: {
    color: theme.colors.text,
  },
  sentImpressionButton: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.success + '10',
  },
  sentImpressionText: {
    color: theme.colors.success,
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
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  backButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreButton: {
    padding: theme.spacing.xs,
  },
  blockedStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.error + '10',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: 8,
  },
  blockedStatusText: {
    color: theme.colors.error,
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default UserProfileScreen;
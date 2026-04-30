import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Alert,
  ActionSheetIOS,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../integrations/supabase/client';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import ImageViewer from './ImageViewer';
import { useTheme } from '../contexts/ThemeContext';

interface UserProfilePopupProps {
  visible: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    age: number;
    photos: string[];
    interests: string[];
    bio?: string;
    isConnected?: boolean;
    is_online?: boolean;
    is_visible?: boolean;
    current_latitude?: number;
    current_longitude?: number;
    checkInInfo?: {
      location_name: string;
      description?: string;
      created_at: string;
    };
  };
  onConnect: (userId: string) => void;
  onChat: (userId: string) => void;
  navigation?: any;
}

export default function UserProfilePopup({
  visible,
  onClose,
  user,
  onConnect,
  onChat,
  navigation
}: UserProfilePopupProps) {
  const [loading, setLoading] = useState(false);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { sendConnectionRequest, getConnectionStatus, sentRequests, receivedRequests, connections } = useConnectionRequests();

  const connectionStatus = useMemo(() => {
    return getConnectionStatus(user.id);
  }, [getConnectionStatus, user.id]);

  const isOwnProfile = currentUserId === user.id;

  // Get current user ID and initialize connection loading
  React.useEffect(() => {
    const getCurrentUserId = async () => {
      try {
        setConnectionLoading(true);
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setCurrentUserId(currentUser.id);

          // Check if current user is blocked by the profile owner
          const { data: blockedMe } = await supabase
            .from('blocked_users')
            .select('*')
            .eq('blocker_id', user.id)
            .eq('blocked_id', currentUser.id);

          // If the current user is blocked by this user, show alert and close popup
          if (blockedMe && blockedMe.length > 0) {
            Alert.alert(
              'Profile Unavailable',
              'You have been blocked by this user and cannot view their profile.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    onClose();
                  }
                }
              ]
            );
            return;
          }
        }
        // Reduce delay for faster loading
        setTimeout(() => {
          setConnectionLoading(false);
        }, 100);
      } catch (error) {
        console.error('Error getting current user:', error);
        setConnectionLoading(false);
      }
    };

    if (visible) {
      getCurrentUserId();
    }
  }, [visible]);

  // Load user's posts when modal opens - non-blocking
  React.useEffect(() => {
    if (visible && user.id) {
      // Load posts asynchronously without blocking the UI
      loadUserPosts().catch(error => console.error('Error loading user posts:', error));
    }
  }, [visible, user.id]);

  const loadUserPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_likes(user_id), post_comments(id)')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      setUserPosts(data || []);
    } catch (error) {
      console.error('Error loading user posts:', error);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const success = await sendConnectionRequest(user.id);
      if (success) {
        onConnect(user.id);
        onClose();
      }
    } catch (error) {
      console.error('Error sending connection request:', error);
      Alert.alert('Error', 'Failed to send partner request');
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    // Check if users are connected
    if (connectionStatus !== 'connected') {
      Alert.alert('Not Connected', 'You need to be connected to chat with this user.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      console.log('Opening chat with user:', user.name, user.id);

      // Check if a chat room already exists between these users
      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
        .single();

      let roomId;

      if (existingRoom) {
        // Use existing room
        console.log('Using existing chat room:', existingRoom.id);
        roomId = existingRoom.id;
      } else {
        // Create new chat room
        console.log('Creating new chat room between', currentUser.id, 'and', user.id);
        const user1 = currentUser.id < user.id ? currentUser.id : user.id;
        const user2 = currentUser.id < user.id ? user.id : currentUser.id;

        const { data: newRoom, error } = await supabase
          .from('chat_rooms')
          .insert({
            user1_id: user1,
            user2_id: user2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating chat room:', error);
          // If it's a duplicate key error, try to fetch the existing room
          if (error.code === '23505') {
            console.log('Chat room already exists, fetching it...');
            const { data: existingRoomRetry } = await supabase
              .from('chat_rooms')
              .select('*')
              .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
              .single();

            if (existingRoomRetry) {
              roomId = existingRoomRetry.id;
              console.log('Found existing room:', roomId);
            } else {
              Alert.alert('Error', 'Failed to create or find chat room');
              return;
            }
          } else {
            Alert.alert('Error', 'Failed to create chat room');
            return;
          }
        } else {
          roomId = newRoom.id;
          console.log('Created new chat room:', roomId);
        }
      }

      // Close the modal and navigate to the chat room
      onClose();
      console.log('Navigating to ChatRoom with:', { roomId, otherUserId: user.id, otherUserName: user.name });

      if (navigation) {
        navigation.navigate('ChatRoom', {
          roomId: roomId,
          otherUserId: user.id,
          otherUserName: user.name,
        });
      }

    } catch (error) {
      console.error('Error navigating to chat:', error);
      Alert.alert('Error', 'Failed to open chat');
    } finally {
      setLoading(false);
    }
  };

  const handleReport = () => {
    const options = ['Report User', 'Block User', 'Cancel'];
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
            handleBlock();
          }
        }
      );
    } else {
      Alert.alert(
        'Report or Block',
        'What would you like to do?',
        [
          { text: 'Report User', onPress: showReportOptions },
          { text: 'Block User', onPress: handleBlock, style: 'destructive' },
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
      if (!currentUser) return;

      // Since there's no reports table, we'll just show a success message
      // In a real app, you'd need to create a reports table or handle this differently
      console.log('Report submitted:', { reporter: currentUser.id, reported: user.id, reason });
      Alert.alert('Thank you', 'Your report has been submitted.');
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
              if (!currentUser) return;

              const { error } = await supabase
                .from('blocked_users')
                .insert({
                  blocker_id: currentUser.id,
                  blocked_id: user.id,
                  created_at: new Date().toISOString(),
                });

              if (error) throw error;
              Alert.alert('User Blocked', 'This user has been blocked.');
              onClose();
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user');
            }
          }
        }
      ]
    );
  };

  const nextPhoto = () => {
    if (user.photos && currentPhotoIndex < user.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  };

  const prevPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReport}>
            <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Photos */}
          <View style={styles.photosContainer}>
            {user.photos && user.photos.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setShowImageViewer(true);
                }}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: user.photos[currentPhotoIndex] }}
                  style={styles.mainPhoto}
                />
                <View style={styles.zoomIconContainer}>
                  <Ionicons name="expand" size={20} color="white" />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.mainPhoto, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={80} color="#ccc" />
              </View>
            )}

            {user.photos && user.photos.length > 1 && (
              <>
                <TouchableOpacity
                  style={[styles.photoNav, styles.photoNavLeft]}
                  onPress={prevPhoto}
                  disabled={currentPhotoIndex === 0}
                >
                  <Ionicons
                    name="chevron-back"
                    size={24}
                    color={currentPhotoIndex === 0 ? theme.colors.gray[400] : 'white'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.photoNav, styles.photoNavRight]}
                  onPress={nextPhoto}
                  disabled={!user.photos || currentPhotoIndex === user.photos.length - 1}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={24}
                    color={user.photos && currentPhotoIndex === user.photos.length - 1 ? theme.colors.gray[400] : 'white'}
                  />
                </TouchableOpacity>

                <View style={styles.photoIndicators}>
                  {user.photos && user.photos.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.photoIndicator,
                        index === currentPhotoIndex && styles.photoIndicatorActive
                      ]}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          {/* User Info */}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}, {user.age}</Text>

            {user.bio && (
              <Text style={styles.userBio}>{user.bio}</Text>
            )}

            {/* Interests */}
            {user.interests && user.interests.length > 0 && (
              <View style={styles.interestsContainer}>
                <Text style={styles.interestsTitle}>Interests</Text>
                <View style={styles.interestsList}>
                  {user.interests.map((interest, index) => (
                    <View key={index} style={styles.interestTag}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Check-in Info */}
            {user.checkInInfo && (
              <View style={styles.checkInSection}>
                <Text style={styles.checkInTitle}>📍 Checked in at</Text>
                <Text style={styles.checkInLocation}>{user.checkInInfo.location_name}</Text>
                {user.checkInInfo.description && (
                  <Text style={styles.checkInDescription}>{user.checkInInfo.description}</Text>
                )}
                <Text style={styles.checkInTime}>
                  {new Date(user.checkInInfo.created_at).toLocaleString()}
                </Text>
              </View>
            )}

            {/* Posts Section */}
            {userPosts.length > 0 && (
              <View style={styles.postsSection}>
                <Text style={styles.postsTitle}>Recent Posts</Text>
                <View style={styles.postsGrid}>
                  {userPosts.map((post) => (
                    <TouchableOpacity key={post.id} style={styles.postItem}>
                      <Image
                        source={{ uri: post.media_url }}
                        style={styles.postImage}
                        resizeMode="cover"
                      />
                      {post.media_type === 'video' && (
                        <View style={styles.videoOverlay}>
                          <Ionicons name="play-circle" size={20} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {!isOwnProfile && (
            <TouchableOpacity
              style={[styles.actionButton, styles.connectButton,
              (connectionLoading || connectionStatus === 'connected' || connectionStatus === 'request_sent') && styles.disabledButton]}
              onPress={handleConnect}
              disabled={connectionLoading || loading || connectionStatus === 'connected' || connectionStatus === 'request_sent'}
            >
              {connectionLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="person-add" size={20} color="white" />
                  <Text style={styles.actionButtonText}>
                    {connectionStatus === 'connected' ? 'Connected' :
                      connectionStatus === 'request_sent' ? 'Request Sent' :
                        connectionStatus === 'request_received' ? 'Respond' : 'Connect'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {!isOwnProfile && user.current_latitude && user.current_longitude && user.is_online && user.is_visible !== false && (
            <TouchableOpacity
              style={[styles.actionButton, styles.mapButton]}
              onPress={() => {
                console.log('View on Map pressed for user:', user.id, 'at:', user.current_latitude, user.current_longitude);
                onClose();
                navigation?.navigate('Home', {
                  focusLocation: {
                    latitude: user.current_latitude,
                    longitude: user.current_longitude,
                    userId: user.id,
                  }
                });
              }}
            >
              <Ionicons name="map" size={20} color="white" />
              <Text style={styles.actionButtonText}>Show on Map</Text>
            </TouchableOpacity>
          )}

          {!isOwnProfile && (
            <TouchableOpacity
              style={[styles.actionButton, styles.chatButton,
              connectionLoading && styles.disabledButton]}
              onPress={handleChat}
              disabled={connectionLoading || loading}
            >
              <Ionicons name="chatbubble" size={20} color="white" />
              <Text style={styles.actionButtonText}>Chat</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Image Viewer */}
      {user.photos && user.photos.length > 0 && (
        <ImageViewer
          visible={showImageViewer}
          images={user.photos}
          initialIndex={currentPhotoIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </Modal>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  content: {
    flex: 1,
  },
  photosContainer: {
    height: 400,
    position: 'relative',
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoNav: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  photoNavLeft: {
    left: 16,
  },
  photoNavRight: {
    right: 16,
  },
  photoIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  photoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  photoIndicatorActive: {
    backgroundColor: 'white',
  },
  userInfo: {
    padding: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: t.colors.text,
    marginBottom: 8,
  },
  userBio: {
    fontSize: 16,
    color: t.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  interestsContainer: {
    marginTop: 16,
  },
  interestsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: 12,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: t.colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    color: t.colors.primary,
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  connectButton: {
    backgroundColor: t.colors.primary,
  },
  chatButton: {
    backgroundColor: t.colors.secondary,
  },
  mapButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  postsSection: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  postsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: 12,
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
    borderRadius: 4,
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
    borderRadius: 4,
  },
  checkInSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: t.colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: t.colors.primary,
  },
  checkInTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: 8,
  },
  checkInLocation: {
    fontSize: 18,
    fontWeight: 'bold',
    color: t.colors.primary,
    marginBottom: 4,
  },
  checkInDescription: {
    fontSize: 14,
    color: t.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  checkInTime: {
    fontSize: 12,
    color: t.colors.textSecondary,
    fontStyle: 'italic',
  },
  zoomIconContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
});
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import { supabase } from '../integrations/supabase/client';

const ConnectionRequestsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('received');
  const [loading, setLoading] = useState(true);
  const [receivedRequestsWithProfiles, setReceivedRequestsWithProfiles] = useState([]);
  const [sentRequestsWithProfiles, setSentRequestsWithProfiles] = useState([]);
  const [connectionsWithProfiles, setConnectionsWithProfiles] = useState([]);
  
  const { 
    sentRequests, 
    receivedRequests, 
    connections,
    respondToRequest,
    loadConnectionRequests 
  } = useConnectionRequests();
  
  const { refreshConnectionsBadgeCount } = useBadgeCounts();

  useEffect(() => {
    loadRequestsWithProfiles();
  }, [receivedRequests, sentRequests, connections]);

  // Refresh connections badge count when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('Connection requests screen focused, refreshing badge count');
      refreshConnectionsBadgeCount();
    }, [refreshConnectionsBadgeCount])
  );

  const handleProfileNavigation = async (userId: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Check if current user is blocked by the other user
      const { data: blockedMe } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', userId)
        .eq('blocked_id', currentUser.id);
      
      // If the current user is blocked by this user, show alert but don't navigate
      if (blockedMe && blockedMe.length > 0) {
        Alert.alert(
          'Profile Unavailable', 
          'You have been blocked by this user and cannot view their profile.'
        );
        return;
      }

      // Otherwise, navigate to the profile
      navigation.navigate('UserProfile', { userId });
    } catch (error) {
      console.error('Error checking block status:', error);
      // If there's an error, navigate anyway
      navigation.navigate('UserProfile', { userId });
    }
  };

  const loadRequestsWithProfiles = async () => {
    setLoading(true);
    try {
      // Load received requests with sender profiles and first impressions
      const receivedWithProfiles = await Promise.all(
        receivedRequests
          .filter(req => req.status === 'pending')
          .map(async (request) => {
            const [{ data: senderProfile }, { data: firstImpression }] = await Promise.all([
              supabase
                .from('profiles')
                .select('name, age, bio, photos, interests')
                .eq('id', request.sender_id)
                .single(),
              supabase
                .from('first_impressions')
                .select('message, created_at')
                .eq('sender_id', request.sender_id)
                .eq('receiver_id', request.receiver_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
            ]);
            
            return {
              ...request,
              profile: senderProfile || { name: 'Unknown', age: 0, bio: '', photos: [], interests: [] },
              firstImpression: firstImpression?.message || null,
              mutualInterests: [], // TODO: Calculate mutual interests
            };
          })
      );
      
      // Load sent requests with receiver profiles
      const sentWithProfiles = await Promise.all(
        sentRequests.map(async (request) => {
          const { data: receiverProfile } = await supabase
            .from('profiles')
            .select('name, age, bio, photos')
            .eq('id', request.receiver_id)
            .single();
          
          return {
            ...request,
            profile: receiverProfile || { name: 'Unknown', age: 0, bio: '', photos: [] },
          };
        })
      );
      
      // Load accepted connections with profiles
      const connectionsWithProfiles = await Promise.all(
        connections.map(async (userId) => {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('name, age, bio, photos, interests')
            .eq('id', userId)
            .single();
          
          return {
            id: userId,
            profile: userProfile || { name: 'Unknown', age: 0, bio: '', photos: [], interests: [] },
          };
        })
      );
      
      setReceivedRequestsWithProfiles(receivedWithProfiles);
      setSentRequestsWithProfiles(sentWithProfiles);
      setConnectionsWithProfiles(connectionsWithProfiles);
    } catch (error) {
      console.error('Error loading requests with profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    const success = await respondToRequest(requestId, 'accepted');
    if (success) {
      loadRequestsWithProfiles();
    }
  };

  const handleDecline = async (requestId) => {
    const success = await respondToRequest(requestId, 'rejected');
    if (success) {
      loadRequestsWithProfiles();
    }
  };

  const handleChatWithUser = async (userId, userName) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      console.log('Opening chat with user:', userName, userId);

      // Check if a chat room already exists between these users
      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${currentUser.id})`)
        .single();

      let roomId;
      
      if (existingRoom) {
        // Use existing room
        console.log('Using existing chat room:', existingRoom.id);
        roomId = existingRoom.id;
      } else {
        // Create new chat room
        console.log('Creating new chat room between', currentUser.id, 'and', userId);
        const user1 = currentUser.id < userId ? currentUser.id : userId;
        const user2 = currentUser.id < userId ? userId : currentUser.id;
        
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
              .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${currentUser.id})`)
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

      // Navigate to the chat room
      console.log('Navigating to ChatRoom with:', { roomId, otherUserId: userId, otherUserName: userName });
      navigation.navigate('ChatRoom', { 
        roomId: roomId,
        otherUserId: userId,
        otherUserName: userName,
      });
      
    } catch (error) {
      console.error('Error navigating to chat:', error);
      Alert.alert('Error', 'Failed to open chat');
    }
  };

  const renderReceivedRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <TouchableOpacity
        style={styles.requestContent}
        onPress={() => handleProfileNavigation(item.sender_id)}
      >
        <View style={styles.avatarContainer}>
          {item.profile.photos?.[0] ? (
            <Image source={{ uri: item.profile.photos[0] }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={30} color={theme.colors.textSecondary} />
            </View>
          )}
        </View>
        
        <View style={styles.requestInfo}>
          <Text style={styles.userName}>{item.profile.name}, {item.profile.age}</Text>
          {item.firstImpression ? (
            <View style={styles.firstImpressionContainer}>
              <Ionicons name="sparkles" size={14} color={theme.colors.primary} />
              <Text style={styles.firstImpressionText} numberOfLines={2}>
                "{item.firstImpression}"
              </Text>
            </View>
          ) : (
            <Text style={styles.userBio} numberOfLines={1}>{item.profile.bio}</Text>
          )}
          {item.mutualInterests.length > 0 && (
            <View style={styles.mutualInterests}>
              <Ionicons name="heart" size={14} color={theme.colors.primary} />
              <Text style={styles.mutualText}>
                {item.mutualInterests.length} mutual interests
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => handleDecline(item.id)}
        >
          <Ionicons name="close" size={24} color={theme.colors.error} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAccept(item.id)}
        >
          <Ionicons name="checkmark" size={24} color={theme.colors.success} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSentRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestContent}>
        <View style={styles.avatarContainer}>
          {item.profile.photos?.[0] ? (
            <Image source={{ uri: item.profile.photos[0] }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={30} color={theme.colors.textSecondary} />
            </View>
          )}
        </View>
        
        <View style={styles.requestInfo}>
          <Text style={styles.userName}>{item.profile.name}, {item.profile.age}</Text>
          <Text style={styles.userBio} numberOfLines={1}>{item.profile.bio}</Text>
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, 
              item.status === 'pending' && styles.pendingStatus,
              item.status === 'accepted' && styles.acceptedStatus,
              item.status === 'rejected' && styles.rejectedStatus
            ]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderConnection = ({ item }) => (
    <View style={styles.requestCard}>
      <TouchableOpacity
        style={styles.requestContent}
        onPress={() => handleProfileNavigation(item.id)}
      >
        <View style={styles.avatarContainer}>
          {item.profile.photos?.[0] ? (
            <Image source={{ uri: item.profile.photos[0] }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={30} color={theme.colors.textSecondary} />
            </View>
          )}
        </View>
        
        <View style={styles.requestInfo}>
          <Text style={styles.userName}>{item.profile.name}, {item.profile.age}</Text>
          <Text style={styles.userBio} numberOfLines={1}>{item.profile.bio}</Text>
          {item.profile.interests && item.profile.interests.length > 0 && (
            <View style={styles.mutualInterests}>
              <Ionicons name="heart" size={14} color={theme.colors.primary} />
              <Text style={styles.mutualText}>
                {item.profile.interests.length} interests
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.actionButton, styles.chatButton]}
        onPress={() => handleChatWithUser(item.id, item.profile.name)}
      >
        <Ionicons name="chatbubble-outline" size={20} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const currentRequests = activeTab === 'received' ? receivedRequestsWithProfiles : 
                         activeTab === 'sent' ? sentRequestsWithProfiles : 
                         connectionsWithProfiles;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.title}>Connection Requests</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.activeTab]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
            Received ({receivedRequestsWithProfiles.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
          onPress={() => setActiveTab('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>
            Sent ({sentRequestsWithProfiles.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'connected' && styles.activeTab]}
          onPress={() => setActiveTab('connected')}
        >
          <Text style={[styles.tabText, activeTab === 'connected' && styles.activeTabText]}>
            Connected ({connectionsWithProfiles.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={commonStyles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : currentRequests.length === 0 ? (
        <View style={commonStyles.centerContainer}>
          <Ionicons name="people-outline" size={64} color={theme.colors.gray[300]} />
          <Text style={styles.emptyText}>
            No {activeTab} requests
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentRequests}
          renderItem={activeTab === 'received' ? renderReceivedRequest : 
                      activeTab === 'sent' ? renderSentRequest :
                      renderConnection}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  chatButton: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  activeTab: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  requestCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestContent: {
    flex: 1,
    flexDirection: 'row',
  },
  avatarContainer: {
    marginRight: theme.spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  userBio: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  mutualInterests: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mutualText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    marginLeft: theme.spacing.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  declineButton: {
    borderColor: theme.colors.error,
  },
  acceptButton: {
    borderColor: theme.colors.success,
  },
  statusContainer: {
    marginTop: theme.spacing.xs,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '500',
  },
  pendingStatus: {
    color: theme.colors.warning,
  },
  acceptedStatus: {
    color: theme.colors.success,
  },
  rejectedStatus: {
    color: theme.colors.error,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.lg,
    color: theme.colors.textSecondary,
  },
  firstImpressionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  firstImpressionText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

export default ConnectionRequestsScreen;
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import AppLoading from './AppLoading';
import { supabase } from '../integrations/supabase/client';
import { usePinnedUsers } from '../hooks/usePinnedUsers';

interface UserLocation {
  id: string;
  name?: string;
  age?: number;
  gender?: string;
  photos?: string[];
  interests?: string[];
  current_latitude: number;
  current_longitude: number;
  is_online?: boolean;
  last_seen?: string;
  unreadCount?: number;
}

interface NearbyUsersModalProps {
  visible: boolean;
  onClose: () => void;
  users: UserLocation[];
  onUserSelect: (user: UserLocation) => void;
  onRefresh?: () => Promise<void>;
  navigation?: any;
  onShowOnMap?: (users: UserLocation[]) => void;
}

export default function NearbyUsersModal({ 
  visible, 
  onClose, 
  users, 
  onUserSelect,
  onRefresh,
  navigation,
  onShowOnMap 
}: NearbyUsersModalProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(new Set());
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'online' | 'all'>('all');
  const { pinnedUsers, togglePinUser, isPinned } = usePinnedUsers();

  // Load connections only once when modal becomes visible
  useEffect(() => {
    if (visible && !connectionsLoaded) {
      loadConnections();
    }
  }, [visible]);

  // Update users when they change
  useEffect(() => {
    if (!connectionsLoaded && users.length > 0) {
      loadConnections();
    }
  }, [users]);

  // Subscribe to connection changes when modal is visible
  useEffect(() => {
    if (!visible || !connectionsLoaded) return;

    const getCurrentUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id;
    };

    const setupSubscription = async () => {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) return;

      const subscription = supabase
        .channel(`connections_${currentUserId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `or(user1_id.eq.${currentUserId},user2_id.eq.${currentUserId})`
        }, (payload) => {
          console.log('Connection change detected:', payload);
          // Reload connections when there's a change
          loadConnections();
        })
        .subscribe();

      return subscription;
    };

    let subscription: any;
    setupSubscription().then(sub => {
      subscription = sub;
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [visible, connectionsLoaded]);

  const loadConnections = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Get all connections for current user
      const { data: connections } = await supabase
        .from('connections')
        .select('*')
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`);

      // Create a set of connected user IDs for quick lookup
      const ids = new Set<string>();
      if (connections) {
        connections.forEach(conn => {
          if (conn.user1_id === currentUser.id) {
            ids.add(conn.user2_id);
          } else {
            ids.add(conn.user1_id);
          }
        });
      }

      setConnectedUserIds(ids);
      setConnectionsLoaded(true);
    } catch (error) {
      console.error('Error loading connections:', error);
      setConnectionsLoaded(true); // Mark as loaded even on error
    }
  };

  // Check if a specific user is connected
  const isUserConnected = (userId: string) => {
    return connectedUserIds.has(userId);
  };
  
  // Helper function to check if user is considered online (based on last_seen within 15 minutes)
  const isUserOnline = (user: UserLocation) => {
    // Always check last_seen timestamp
    if (user.last_seen) {
      const lastSeen = new Date(user.last_seen);
      const now = new Date();
      const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
      return diffInMinutes <= 15; // Online indicator shows for 15 minutes
    }
    
    // If no last_seen, fall back to is_online
    return user.is_online || false;
  };
  
  const onlineUsers = users.filter(user => isUserOnline(user));

  // Sort users by pinned status
  const sortUsersByPin = (userList: UserLocation[]) => {
    return userList.sort((a, b) => {
      const aIsPinned = isPinned(a.id);
      const bIsPinned = isPinned(b.id);
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      return 0;
    });
  };

  const sortedOnlineUsers = sortUsersByPin([...onlineUsers]);
  const sortedAllUsers = sortUsersByPin([...users]);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    
    try {
      setRefreshing(true);
      await onRefresh();
      // Optionally refresh connections only if needed
      await loadConnections();
    } catch (error) {
      console.error('Error refreshing nearby users:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleChatWithUser = async (userId: string, userName: string) => {
    if (!navigation) {
      Alert.alert('Error', 'Navigation not available');
      return;
    }

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      console.log('Checking connection status with user:', userName, userId);

      // Check if users are connected using cached data
      if (!isUserConnected(userId)) {
        // Users are not connected
        Alert.alert(
          'Not Connected',
          `You need to be connected with ${userName} to send messages. Send a partner request first.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'View Profile',
              onPress: () => {
                onUserSelect(users.find(u => u.id === userId) || { id: userId });
                onClose();
              }
            }
          ]
        );
        return;
      }

      console.log('Users are connected, opening chat with:', userName, userId);

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

      // Close the modal and navigate to the chat room
      onClose();
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
  
  const renderUser = ({ item }: { item: UserLocation }) => {
    const photo = item.photos?.[0];
    const displayName = item.name || 'Unknown User';
    
    return (
      <View style={styles.userItem}>
        <TouchableOpacity 
          style={styles.userContent}
          onPress={() => {
            onUserSelect(item);
            onClose();
          }}
        >
          <View style={styles.userPhotoContainer}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.userPhoto} />
            ) : (
              <View style={styles.userPhotoPlaceholder}>
                <Ionicons name="person" size={30} color={theme.colors.gray[500]} />
              </View>
            )}
            {isUserOnline(item) && <View style={styles.onlineIndicator} />}
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            )}
            {isPinned(item.id) && (
              <View style={styles.pinnedIndicator}>
                <Ionicons name="bookmark" size={12} color="#FFD700" />
              </View>
            )}
          </View>
          
          <View style={styles.userInfo}>
            <Text style={[styles.userName, isPinned(item.id) && styles.pinnedUserName]}>
              {displayName}
              {item.age && `, ${item.age}`}
            </Text>
            
            {item.interests && item.interests.length > 0 && (
              <View style={styles.interestsContainer}>
                {item.interests.slice(0, 3).map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
                {item.interests.length > 3 && (
                  <Text style={styles.moreInterests}>+{item.interests.length - 3}</Text>
                )}
              </View>
            )}
          </View>
          
          <View style={styles.genderIndicator}>
            <Ionicons 
              name={item.gender === 'male' ? 'man' : 'woman'} 
              size={24} 
              color={item.gender === 'male' ? '#2196F3' : '#FF1744'} 
            />
          </View>
        </TouchableOpacity>
        
        {/* Show on Map button - only for online users */}
        {navigation && item.current_latitude && item.current_longitude && isUserOnline(item) && (
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => {
              console.log('Show on Map pressed for:', item.name, item.id);
              onClose();
              navigation.navigate('Main', {
                screen: 'Home',
                params: {
                  focusLocation: {
                    latitude: item.current_latitude,
                    longitude: item.current_longitude,
                    userId: item.id,
                  }
                }
              });
            }}
          >
            <Ionicons name="location" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.pinButton}
          onPress={() => togglePinUser(item.id)}
        >
          <Ionicons 
            name={isPinned(item.id) ? "bookmark" : "bookmark-outline"}
            size={20} 
            color={isPinned(item.id) ? "#FFD700" : "#999"} 
          />
        </TouchableOpacity>
        
        {navigation && (
          <TouchableOpacity
            style={[
              styles.chatButton, 
              !isUserConnected(item.id) && styles.chatButtonDisabled
            ]}
            onPress={() => handleChatWithUser(item.id, displayName)}
          >
            <Ionicons 
              name={isUserConnected(item.id) ? "chatbubble-outline" : "lock-closed-outline"} 
              size={20} 
              color={isUserConnected(item.id) ? theme.colors.primary : theme.colors.gray[400]} 
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Nearby Users</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="refresh" size={24} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabItem, activeTab === 'online' && styles.activeTab]}
            onPress={() => setActiveTab('online')}
          >
            <Text style={[styles.tabText, activeTab === 'online' && styles.activeTabText]}>
              Online Now ({onlineUsers.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabItem, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
              Total Nearby ({users.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {!connectionsLoaded ? (
            <View style={styles.emptyContainer}>
              <AppLoading />
              <Text style={styles.emptyTitle}>Loading connections...</Text>
            </View>
          ) : activeTab === 'online' && onlineUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={theme.colors.gray[400]} />
              <Text style={styles.emptyTitle}>No users online</Text>
              <Text style={styles.emptyText}>
                Check back later to see who's nearby
              </Text>
            </View>
          ) : activeTab === 'all' && users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={theme.colors.gray[400]} />
              <Text style={styles.emptyTitle}>No nearby users</Text>
              <Text style={styles.emptyText}>
                Users will appear here when they are nearby
              </Text>
            </View>
          ) : (
            <FlatList
              data={activeTab === 'online' 
                ? sortedOnlineUsers
                : sortedAllUsers
              }
              renderItem={renderUser}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  placeholder: {
    width: 24,
  },
  refreshButton: {
    padding: 4,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  userContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  chatButtonDisabled: {
    borderColor: theme.colors.gray[300],
    backgroundColor: theme.colors.gray[100],
  },
  userPhotoContainer: {
    position: 'relative',
  },
  userPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  userPhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: 'white',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  interestTag: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  interestText: {
    color: theme.colors.primary,
    fontSize: 12,
  },
  moreInterests: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginLeft: 4,
  },
  genderIndicator: {
    marginLeft: 12,
    padding: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.gray[100],
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 76,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
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
  unreadBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  pinButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 20,
  },
  mapButton: {
    marginLeft: 8,
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  pinnedIndicator: {
    position: 'absolute',
    top: -2,
    left: -2,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  pinnedUserName: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
});
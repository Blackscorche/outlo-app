import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../integrations/supabase/client';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import { usePinnedUsers } from '../hooks/usePinnedUsers';
import AppLoading from '../components/AppLoading';

interface ChatRoom {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  other_user: {
    name?: string;
    photos?: string[];
  };
  other_user_id: string;
}

interface ConnectedUser {
  id: string;
  name: string;
  photos?: string[];
  bio?: string;
  age?: number;
  is_online?: boolean;
  last_seen?: string;
  chatRoom?: ChatRoom;
  unreadCount?: number;
}

export default function ChatScreen({ navigation }: any) {
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const { connections, isLoading: connectionsLoading } = useConnectionRequests();
  const { refreshChatBadgeCount } = useBadgeCounts();
  const { pinnedUsers, togglePinUser, isPinned } = usePinnedUsers();

  useEffect(() => {
    // Don't load if connections are still being fetched
    if (connectionsLoading) {
      return;
    }
    
    // Always set loading to true when connections change
    setLoading(true);
    loadConnectedUsersAndChats();
    
    // Subscribe to new messages for real-time updates
    const messagesSubscription = supabase
      .channel('new_messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, handleNewMessage)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'messages' 
      }, handleNewMessage)
      .subscribe();

    // Subscribe to profile updates for real-time online/offline status
    const profilesSubscription = supabase
      .channel('profiles_updates')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles' 
      }, handleProfileUpdate)
      .subscribe();

    // Set up interval to refresh unread counts and online status
    const interval = setInterval(() => {
      if (!connectionsLoading) {
        loadConnectedUsersAndChats();
      }
    }, 15000); // Refresh every 15 seconds

    return () => {
      messagesSubscription.unsubscribe();
      profilesSubscription.unsubscribe();
      clearInterval(interval);
    };
  }, [connections, connectionsLoading]);

  // Refresh chat badge count when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('Chat screen focused, refreshing badge count');
      refreshChatBadgeCount();
    }, [refreshChatBadgeCount])
  );

  const loadConnectedUsersAndChats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First, get all connected users' profiles with presence info
      const connectedUsersData = await Promise.all(
        connections.map(async (userId) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, photos, bio, age, is_online, last_seen')
            .eq('id', userId)
            .single();
          
          return profile;
        })
      );

      // Then, fetch all chat rooms
      const { data: chatRoomsData } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      // Create a map of chat rooms by other user ID
      const chatRoomsByUser = new Map<string, ChatRoom>();
      (chatRoomsData || []).forEach(room => {
        const otherUserId = room.user1_id === user.id ? room.user2_id : room.user1_id;
        chatRoomsByUser.set(otherUserId, {
          ...room,
          other_user_id: otherUserId,
          other_user: { name: '', photos: [] }, // Will be filled from profile
        });
      });

      // Fetch unread message counts and last message for each chat room
      const unreadCounts = new Map<string, number>();
      const lastMessages = new Map<string, { content: string; created_at: string; sender_id: string }>();
      
      for (const [userId, chatRoom] of chatRoomsByUser) {
        // Get unread count
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_room_id', chatRoom.id)
          .eq('sender_id', userId)
          .eq('is_read', false);
        
        if (count) {
          unreadCounts.set(userId, count);
        }
        
        // Get last non-deleted message
        const { data: lastMessageData } = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('chat_room_id', chatRoom.id)
          .or('deleted.is.null,deleted.eq.false')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (lastMessageData) {
          lastMessages.set(userId, lastMessageData);
        }
      }

      // Helper function to check if user is considered online
      const isUserOnline = (profile: any) => {
        if (!profile.is_online) return false;
        
        // Check if last_seen is within 15 minutes
        if (profile.last_seen) {
          const lastSeen = new Date(profile.last_seen);
          const now = new Date();
          const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
          return diffInMinutes <= 15;
        }
        
        return profile.is_online;
      };

      // Combine connected users with their chat rooms
      const usersWithChats = connectedUsersData
        .filter(profile => profile !== null)
        .map(profile => {
          const chatRoom = chatRoomsByUser.get(profile.id);
          const lastMessage = lastMessages.get(profile.id);
          
          // Add last message info to chat room if it exists
          if (chatRoom && lastMessage) {
            chatRoom.last_message = lastMessage.content;
            chatRoom.last_message_time = lastMessage.created_at;
          }
          
          return {
            id: profile.id,
            name: profile.name || 'Unknown',
            photos: profile.photos || [],
            bio: profile.bio || '',
            age: profile.age || 0,
            is_online: isUserOnline(profile),
            last_seen: profile.last_seen,
            chatRoom,
            unreadCount: unreadCounts.get(profile.id) || 0,
          };
        })
        .sort((a, b) => {
          // Pinned users come first
          const aIsPinned = isPinned(a.id);
          const bIsPinned = isPinned(b.id);
          if (aIsPinned && !bIsPinned) return -1;
          if (!aIsPinned && bIsPinned) return 1;
          
          // Users with unread messages come first (within pinned/unpinned groups)
          if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
          if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
          // Sort by last message time if both have chat rooms
          if (a.chatRoom && b.chatRoom) {
            const aTime = a.chatRoom.last_message_time || a.chatRoom.updated_at;
            const bTime = b.chatRoom.last_message_time || b.chatRoom.updated_at;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
          }
          // Users with chat rooms come first
          if (a.chatRoom) return -1;
          if (b.chatRoom) return 1;
          // Otherwise sort by name
          return a.name.localeCompare(b.name);
        });

      setConnectedUsers(usersWithChats);
    } catch (error) {
      console.error('Error loading connected users:', error);
      Alert.alert('Error', 'Failed to load messages. Please try again.');
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  const handleNewMessage = (payload: any) => {
    console.log('ChatScreen: New message detected, refreshing chat list');
    // Update chat rooms when new message arrives
    // This will refresh the unread counts
    loadConnectedUsersAndChats();
  };

  const handleProfileUpdate = (payload: any) => {
    const updatedProfile = payload.new;
    console.log('Profile updated:', updatedProfile.id, 'online:', updatedProfile.is_online);
    
    // Update the specific user's online status in real-time
    setConnectedUsers(prevUsers => 
      prevUsers.map(user => {
        if (user.id === updatedProfile.id) {
          // Helper function to check if user is considered online
          const isUserOnline = () => {
            if (!updatedProfile.is_online) return false;
            
            // Check if last_seen is within 15 minutes
            if (updatedProfile.last_seen) {
              const lastSeen = new Date(updatedProfile.last_seen);
              const now = new Date();
              const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
              return diffInMinutes <= 15;
            }
            
            return updatedProfile.is_online;
          };

          return {
            ...user,
            is_online: isUserOnline(),
            last_seen: updatedProfile.last_seen,
          };
        }
        return user;
      })
    );
  };

  const navigateToChat = async (user: ConnectedUser) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      let roomId = user.chatRoom?.id;
      
      // If no chat room exists in our state, check the database first
      if (!roomId) {
        // Check if a chat room already exists between these users
        const { data: existingRoom } = await supabase
          .from('chat_rooms')
          .select('*')
          .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
          .single();

        if (existingRoom) {
          roomId = existingRoom.id;
        } else {
          // Create new chat room only if it doesn't exist
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
              const { data: existingRoomRetry } = await supabase
                .from('chat_rooms')
                .select('*')
                .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${user.id}),and(user1_id.eq.${user.id},user2_id.eq.${currentUser.id})`)
                .single();
              
              if (existingRoomRetry) {
                roomId = existingRoomRetry.id;
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
          }
        }
      }

      navigation.navigate('ChatRoom', { 
        roomId: roomId,
        otherUserId: user.id,
        otherUserName: user.name,
      });
      
      // Refresh the list to update chat room info
      loadConnectedUsersAndChats();
    } catch (error) {
      console.error('Error navigating to chat:', error);
      Alert.alert('Error', 'Failed to open chat');
    }
  };

  const renderConnectedUser = ({ item }: { item: ConnectedUser }) => {
    const photo = item.photos?.[0];
    const timeAgo = item.chatRoom?.updated_at 
      ? getTimeAgo(new Date(item.chatRoom.updated_at))
      : '';

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigateToChat(item)}
      >
        <View style={styles.avatarContainer}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={24} color="#999" />
            </View>
          )}
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount}</Text>
            </View>
          )}
          {item.is_online && <View style={styles.onlineIndicator} />}
          {isPinned(item.id) && (
            <View style={styles.pinnedIndicator}>
              <Ionicons name="bookmark" size={12} color="#FFD700" />
            </View>
          )}
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[styles.userName, isPinned(item.id) && styles.pinnedUserName]}>
              {item.name}
            </Text>
            {timeAgo && <Text style={styles.timestamp}>{timeAgo}</Text>}
          </View>
          <View style={styles.lastMessageContainer}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.chatRoom?.last_message || item.bio || 'Start a conversation'}
            </Text>
            {item.chatRoom?.last_message && (
              <Text style={styles.messageStatus}>
                {item.unreadCount > 0 ? `${item.unreadCount} new` : 'Read'}
              </Text>
            )}
          </View>
        </View>
        
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
      </TouchableOpacity>
    );
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>
      
      {connectionsLoading || loading || !initialLoadComplete ? (
        <View style={styles.loadingContainer}>
          <AppLoading />
        </View>
      ) : connections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No connections yet</Text>
          <Text style={styles.emptySubtext}>
            Connect with people nearby to start chatting
          </Text>
        </View>
      ) : connectedUsers.length === 0 && connections.length > 0 ? (
        <View style={styles.loadingContainer}>
          <AppLoading />
        </View>
      ) : (
        <FlatList
          data={connectedUsers}
          renderItem={renderConnectedUser}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>Connected Users ({connectedUsers.length})</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF1744',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 84,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: 'white',
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
  },
  listHeaderText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  lastMessageContainer: {
    flex: 1,
  },
  messageStatus: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  pinButton: {
    padding: 8,
    marginLeft: 8,
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
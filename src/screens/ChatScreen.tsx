import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../integrations/supabase/client';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import { usePinnedUsers } from '../hooks/usePinnedUsers';
import AppLoading from '../components/AppLoading';
import { useTheme } from '../contexts/ThemeContext';
import OutloLogo from '../components/OutloLogo';

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
  lastMessageSenderId?: string;
  lastMessageIsRead?: boolean;
}

export default function ChatScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const { connections, isLoading: connectionsLoading } = useConnectionRequests();
  const { refreshChatBadgeCount } = useBadgeCounts();
  const { pinnedUsers, togglePinUser, isPinned } = usePinnedUsers();

  // Stable string key — only changes when actual connection IDs change,
  // not when the array reference changes. Prevents double-load.
  const connectionsKey = useMemo(
    () => [...connections].sort().join(','),
    [connections]
  );

  // Ref so subscriptions/interval can always call the latest version
  // without being recreated every time connections change.
  const loadRef = useRef<() => void>(() => { });

  // Effect 1: re-load data only when connections actually change
  useEffect(() => {
    if (connectionsLoading) return;
    setLoading(true);
    loadConnectedUsersAndChats();
  }, [connectionsKey, connectionsLoading]);

  // Effect 2: subscriptions and refresh interval — set up once
  useEffect(() => {
    const messagesSubscription = supabase
      .channel('new_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => loadRef.current())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
      }, () => loadRef.current())
      .subscribe();

    const profilesSubscription = supabase
      .channel('profiles_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
      }, handleProfileUpdate)
      .subscribe();

    const interval = setInterval(() => {
      loadRef.current();
    }, 15000);

    return () => {
      messagesSubscription.unsubscribe();
      profilesSubscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Refresh chat badge count when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('Chat screen focused, refreshing badge count');
      refreshChatBadgeCount();
    }, [refreshChatBadgeCount])
  );

  const toggleSearch = () => {
    if (searchVisible) {
      Keyboard.dismiss();
      setSearchQuery('');
      Animated.timing(searchAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => setSearchVisible(false));
    } else {
      setSearchVisible(true);
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start(() => searchInputRef.current?.focus());
    }
  };

  const filteredUsers = searchQuery.trim()
    ? connectedUsers.filter(u =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.chatRoom?.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : connectedUsers;

  const loadConnectedUsersAndChats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

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
      const lastMessages = new Map<string, { content: string; created_at: string; sender_id: string; is_read: boolean }>();

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
          .select('content, created_at, sender_id, is_read')
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
            lastMessageSenderId: lastMessage?.sender_id,
            lastMessageIsRead: lastMessage?.is_read,
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
  // Keep ref current so the subscription/interval always calls the latest version
  loadRef.current = loadConnectedUsersAndChats;

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
    const hasUnread = item.unreadCount > 0;
    const lastMsg = item.chatRoom?.last_message || 'Start a conversation';
    const iMyLastMessage = currentUserId && item.lastMessageSenderId === currentUserId;
    // For received messages: is_read = true means I have read it
    const showCheckmark = item.chatRoom?.last_message && item.lastMessageSenderId;

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
          {item.is_online && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
            {timeAgo ? <Text style={styles.timestamp}>{timeAgo}</Text> : null}
          </View>
          <View style={styles.lastMessageRow}>
            {showCheckmark && (
              <Ionicons
                name={item.lastMessageIsRead ? 'checkmark-done' : 'checkmark'}
                size={15}
                color={item.lastMessageIsRead ? '#2196F3' : '#aaa'}
                style={{ marginRight: 3 }}
              />
            )}
            <Text
              style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
              numberOfLines={1}
            >
              {lastMsg}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <OutloLogo style={styles.headerLogo} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconButton} onPress={toggleSearch}>
            <Ionicons
              name={searchVisible ? 'close' : 'search'}
              size={22}
              color={searchVisible ? theme.colors.primary : theme.colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      {searchVisible && (
        <Animated.View style={[styles.searchBar, { opacity: searchAnim }]}>
          <Ionicons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#bbb"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

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
      ) : filteredUsers.length === 0 && searchQuery.trim() ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={52} color="#ccc" />
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>Try a different name or message</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderConnectedUser}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
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
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: t.colors.text,
    pointerEvents: 'none',
  },
  headerLogo: {
    width: 80,
    height: 26,
    marginLeft: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.inputBg,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: t.colors.text,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    color: t.colors.text,
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: t.colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: t.colors.surface,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: t.colors.text,
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 14,
    color: '#888',
    flex: 1,
  },
  lastMessageUnread: {
    color: t.colors.text,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: t.colors.border,
    marginLeft: 84,
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
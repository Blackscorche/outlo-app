import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles } from '../styles/common';
import AppLoading from '../components/AppLoading';
import { useTheme } from '../contexts/ThemeContext';
import OutloLogo from '../components/OutloLogo';

const ChatRoomsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch chat rooms from Supabase
    setTimeout(() => {
      setChatRooms([
        {
          id: '1',
          name: 'Jane Doe',
          lastMessage: 'Hey, how are you?',
          timestamp: '5 min ago',
          unread: 2,
          avatar: null,
        },
        {
          id: '2',
          name: 'John Smith',
          lastMessage: 'See you tomorrow!',
          timestamp: '1 hour ago',
          unread: 0,
          avatar: null,
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const renderChatRoom = ({ item }) => (
    <TouchableOpacity
      style={styles.chatRoomItem}
      onPress={() => navigation.navigate('ChatRoom', { roomId: item.id, userName: item.name })}
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color={theme.colors.textSecondary} />
          </View>
        )}
      </View>

      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.centerContainer}>
        <AppLoading />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <OutloLogo style={styles.headerLogo} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity>
          <Ionicons name="search" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {chatRooms.length === 0 ? (
        <View style={commonStyles.centerContainer}>
          <Ionicons name="chatbubble-outline" size={64} color={theme.colors.gray[300]} />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>
            Start a conversation from the map or connections
          </Text>
        </View>
      ) : (
        <FlatList
          data={chatRooms}
          renderItem={renderChatRoom}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={commonStyles.separator} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

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
    width: 120,
    height: 40,
    marginLeft: 0,
  },
  listContent: {
    paddingHorizontal: t.spacing.lg,
  },
  chatRoomItem: {
    flexDirection: 'row',
    paddingVertical: t.spacing.md,
  },
  avatarContainer: {
    marginRight: t.spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    backgroundColor: t.colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spacing.xs,
  },
  userName: {
    fontSize: t.fontSize.base,
    fontWeight: '600',
    color: t.colors.text,
  },
  timestamp: {
    fontSize: t.fontSize.xs,
    color: t.colors.textSecondary,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    marginRight: t.spacing.sm,
  },
  unreadBadge: {
    backgroundColor: t.colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.spacing.xs,
  },
  unreadCount: {
    color: t.colors.text,
    fontSize: t.fontSize.xs,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: t.spacing.md,
    fontSize: t.fontSize.lg,
    fontWeight: '600',
    color: t.colors.text,
  },
  emptySubtext: {
    marginTop: t.spacing.xs,
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: t.spacing.xl,
  },
});

export default ChatRoomsScreen;
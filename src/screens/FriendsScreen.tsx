import React, { useState } from 'react';
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
import { useTheme } from '../contexts/ThemeContext';

const FriendsScreen = ({ navigation }) => {
  const [friends, setFriends] = useState([
    {
      id: '1',
      name: 'Alex Thompson',
      status: 'Having a great day!',
      avatar: null,
      isOnline: true,
    },
    {
      id: '2',
      name: 'Jordan Lee',
      status: 'At the gym 💪',
      avatar: null,
      isOnline: true,
    },
    {
      id: '3',
      name: 'Taylor Davis',
      status: 'Working from home',
      avatar: null,
      isOnline: false,
    },
  ]);

  const renderFriend = ({ item }) => (
    <TouchableOpacity
      style={styles.friendCard}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={30} color={theme.colors.textSecondary} />
          </View>
        )}
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendStatus} numberOfLines={1}>{item.status}</Text>
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => navigation.navigate('ChatRoom', { roomId: item.id, userName: item.name })}
      >
        <Ionicons name="chatbubble-outline" size={20} color={theme.colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.title}>Friends</Text>
        <TouchableOpacity>
          <Ionicons name="person-add-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {friends.length === 0 ? (
        <View style={commonStyles.centerContainer}>
          <Ionicons name="people-outline" size={64} color={theme.colors.gray[300]} />
          <Text style={styles.emptyText}>No friends yet</Text>
          <Text style={styles.emptySubtext}>
            Connect with people to start building your friend list
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{friends.filter(f => f.isOnline).length}</Text>
              <Text style={styles.statLabel}>Online</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{friends.length}</Text>
              <Text style={styles.statLabel}>Total Friends</Text>
            </View>
          </View>

          <FlatList
            data={friends}
            renderItem={renderFriend}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
        </>
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
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: t.spacing.lg,
    marginHorizontal: t.spacing.lg,
    marginBottom: t.spacing.md,
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: t.fontSize.xxl,
    fontWeight: 'bold',
    color: t.colors.primary,
  },
  statLabel: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    marginTop: t.spacing.xs,
  },
  listContent: {
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.lg,
  },
  friendCard: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
    padding: t.spacing.md,
    marginBottom: t.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
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
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: t.colors.success,
    borderWidth: 2,
    borderColor: t.colors.surface,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: t.fontSize.base,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: t.spacing.xs,
  },
  friendStatus: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
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

export default FriendsScreen;
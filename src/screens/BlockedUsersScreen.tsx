import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles } from '../styles/common';
import { supabase } from '../integrations/supabase/client';
import { useBlocking } from '../hooks/useBlocking';
import { useTheme } from '../contexts/ThemeContext';

interface BlockedUserProfile {
  id: string;
  name: string;
  photos: string[] | null;
}

const BlockedUsersScreen = ({ navigation }) => {
  const { blockedUsers, unblockUser, refreshBlockedUsers } = useBlocking();
  const [profiles, setProfiles] = useState<BlockedUserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const fetchProfiles = useCallback(async () => {
    if (blockedUsers.length === 0) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, photos')
        .in('id', blockedUsers);

      if (error) {
        console.error('Error fetching blocked user profiles:', error);
        return;
      }

      setProfiles(data || []);
    } catch (error) {
      console.error('Error in fetchProfiles:', error);
    } finally {
      setLoading(false);
    }
  }, [blockedUsers]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleUnblock = (user: BlockedUserProfile) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            const success = await unblockUser(user.id);
            if (success) {
              setProfiles(prev => prev.filter(p => p.id !== user.id));
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: BlockedUserProfile }) => {
    const avatar = item.photos?.[0];

    return (
      <View style={styles.card}>
        <View style={styles.avatarContainer}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={28} color={theme.colors.textSecondary} />
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
        </View>
        <TouchableOpacity style={styles.unblockButton} onPress={() => handleUnblock(item)}>
          <Text style={styles.unblockText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.title}>Blocked Users</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={commonStyles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.title}>Blocked Users</Text>
        <View style={{ width: 24 }} />
      </View>
      {profiles.length === 0 ? (
        <View style={commonStyles.centerContainer}>
          <Ionicons name="shield-outline" size={64} color={theme.colors.gray[300]} />
          <Text style={styles.emptyText}>No blocked users</Text>
          <Text style={styles.emptySubtext}>
            Users you block will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
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
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  listContent: {
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.lg,
  },
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
    padding: t.spacing.md,
    marginBottom: t.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
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
  info: {
    flex: 1,
  },
  name: {
    fontSize: t.fontSize.md,
    fontWeight: '600',
    color: t.colors.text,
  },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.colors.primary,
  },
  unblockText: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: t.colors.primary,
  },
  emptyText: {
    fontSize: t.fontSize.lg,
    fontWeight: '600',
    color: t.colors.text,
    marginTop: t.spacing.lg,
  },
  emptySubtext: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    marginTop: t.spacing.sm,
    textAlign: 'center',
  },
});

export default BlockedUsersScreen;

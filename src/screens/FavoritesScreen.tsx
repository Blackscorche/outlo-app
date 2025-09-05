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
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';

const FavoritesScreen = ({ navigation }) => {
  const [favorites, setFavorites] = useState([
    {
      id: '1',
      name: 'Emma Wilson',
      age: 25,
      location: '2 km away',
      avatar: null,
      isOnline: true,
    },
    {
      id: '2',
      name: 'Olivia Martinez',
      age: 27,
      location: '5 km away',
      avatar: null,
      isOnline: false,
    },
  ]);

  const renderFavorite = ({ item }) => (
    <TouchableOpacity
      style={styles.favoriteCard}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={40} color={theme.colors.textSecondary} />
          </View>
        )}
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      
      <View style={styles.favoriteInfo}>
        <Text style={styles.favoriteName}>{item.name}, {item.age}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.messageButton}
        onPress={() => navigation.navigate('ChatRoom', { roomId: item.id, userName: item.name })}
      >
        <Ionicons name="chatbubble" size={20} color={theme.colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={commonStyles.title}>Favorites</Text>
        <View style={{ width: 24 }} />
      </View>

      {favorites.length === 0 ? (
        <View style={commonStyles.centerContainer}>
          <Ionicons name="heart-outline" size={64} color={theme.colors.gray[300]} />
          <Text style={styles.emptyText}>No favorites yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the heart icon on profiles you like
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderFavorite}
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
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  favoriteCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  favoriteInfo: {
    flex: 1,
  },
  favoriteName: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  messageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  emptySubtext: {
    marginTop: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
});

export default FavoritesScreen;
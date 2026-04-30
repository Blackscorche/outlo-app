import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles } from '../styles/common';
import { supabase } from '../integrations/supabase/client';
import AppLoading from '../components/AppLoading';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../styles/theme';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - theme.spacing.lg * 2 - theme.spacing.xs * 2) / 3;

interface Post {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption?: string;
  created_at: string;
  likes_count?: number;
}

const AllPostsScreen = ({ navigation, route }) => {
  const { userId, userName } = route.params || {};
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const POSTS_PER_PAGE = 21; // Multiple of 3 for grid
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  useEffect(() => {
    loadPosts();
  }, [userId]);

  const loadPosts = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setPage(0);
        setHasMore(true);
      }

      const currentPage = isRefresh ? 0 : page;
      const from = currentPage * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      let query = supabase
        .from('posts')
        .select(`
          *,
          post_likes(user_id)
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedPosts = data?.map(post => ({
        ...post,
        likes_count: post.post_likes?.length || 0,
      })) || [];

      if (isRefresh) {
        setPosts(formattedPosts);
      } else {
        setPosts(prev => [...prev, ...formattedPosts]);
      }

      setHasMore(formattedPosts.length === POSTS_PER_PAGE);
      setPage(currentPage + 1);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadPosts(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadPosts();
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={styles.postItem}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.media_url }}
        style={styles.postImage}
        resizeMode="cover"
      />
      {item.media_type === 'video' && (
        <View style={styles.videoOverlay}>
          <Ionicons name="play-circle" size={30} color="white" />
        </View>
      )}
      <View style={styles.postStats}>
        <View style={styles.statItem}>
          <Ionicons name="heart" size={14} color="white" />
          <Text style={styles.statText}>{item.likes_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="camera-outline" size={60} color={theme.colors.textSecondary} />
      <Text style={styles.emptyText}>No posts yet</Text>
      {userId && (
        <Text style={styles.emptySubtext}>
          {userName ? `${userName} hasn't posted anything yet` : 'Start sharing your moments!'}
        </Text>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loading || !hasMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  if (loading && posts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.title}>
            {userId ? (userName ? `${userName}'s Posts` : 'Posts') : 'All Posts'}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <AppLoading />
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
        <Text style={commonStyles.title}>
          {userId ? (userName ? `${userName}'s Posts` : 'Posts') : 'All Posts'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.sm,
    paddingBottom: t.spacing.xl,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: t.spacing.xs,
  },
  postItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
    borderRadius: t.borderRadius.sm,
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
    borderRadius: t.borderRadius.sm,
  },
  postStats: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: t.spacing.xxxl * 2,
  },
  emptyText: {
    fontSize: t.fontSize.lg,
    fontWeight: '600',
    color: t.colors.textSecondary,
    marginTop: t.spacing.md,
  },
  emptySubtext: {
    fontSize: t.fontSize.base,
    color: t.colors.textSecondary,
    marginTop: t.spacing.xs,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: t.spacing.lg,
    alignItems: 'center',
  },
});

export default AllPostsScreen;
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../styles/theme";
import { commonStyles } from "../styles/common";
import { supabase } from "../integrations/supabase/client";
import AppLoading from "../components/AppLoading";

const DEFAULT_PROFILE_PHOTO =
  "https://ui-avatars.com/api/?background=FF1744&color=fff&size=200&font-size=0.5";

interface Post {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption?: string;
  created_at: string;
  likes_count?: number;
  profiles?: {
    id: string;
    name: string;
    photos: string[];
  };
}

const PostDetailScreen = ({ navigation, route }) => {
  const { postId } = route.params;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    loadPost();
    checkIfLiked();
  }, [postId]);

  const loadPost = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles!user_id(id, name, photos),
          post_likes(user_id)
        `,
        )
        .eq("id", postId)
        .single();

      if (error) throw error;

      const formattedPost = {
        ...data,
        likes_count: data.post_likes?.length || 0,
      };

      setPost(formattedPost);
      setLikesCount(formattedPost.likes_count);
    } catch (error) {
      console.error("Error loading post:", error);
      Alert.alert("Error", "Failed to load post");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleReportPost = () => {
    if (!post?.id) return;

    Alert.alert("Report Post", "Why are you reporting this post?", [
      {
        text: "Spam",
        onPress: () => submitPostReport("spam"),
      },
      {
        text: "Harassment or Abuse",
        onPress: () => submitPostReport("harassment"),
      },
      {
        text: "Inappropriate Content",
        onPress: () => submitPostReport("inappropriate_content"),
      },
      {
        text: "Fake or Misleading",
        onPress: () => submitPostReport("fake_content"),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const submitPostReport = async (reason: string) => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser || !post) return;

      const { error } = await supabase.from("user_reports").insert({
        reporter_id: currentUser.id,
        reported_user_id: post.user_id,
        reported_post_id: post.id,
        reason,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      Alert.alert(
        "Report Submitted",
        "Thank you. This post has been reported to our moderation team for review.",
      );
    } catch (error) {
      console.error("Error reporting post:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    }
  };

  const checkIfLiked = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .single();

      setIsLiked(!!data);
    } catch (error) {
      // Not liked
    }
  };

  const toggleLike = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        if (!error) {
          setIsLiked(false);
          setLikesCount((prev) => prev - 1);
        }
      } else {
        // Like
        const { error } = await supabase.from("post_likes").insert({
          post_id: postId,
          user_id: user.id,
        });

        if (!error) {
          setIsLiked(true);
          setLikesCount((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.title}>Post</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <AppLoading />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
         <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={commonStyles.title}>Post</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Post not found</Text>
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
        <Text style={commonStyles.title}>Post</Text>
        <TouchableOpacity onPress={handleReportPost}>
          <Ionicons name="flag-outline" size={22} color="#F59E0B" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* User info */}
        <View style={styles.userHeader}>
          <Image
            source={{
              uri:
                post.profiles?.photos?.[0] ||
                `${DEFAULT_PROFILE_PHOTO}&name=${encodeURIComponent(post.profiles?.name || "User")}`,
            }}
            style={styles.userAvatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{post.profiles?.name || "User"}</Text>
            <Text style={styles.postTime}>
              {new Date(post.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Post media */}
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: post.media_url }}
            style={styles.postMedia}
            resizeMode="cover"
          />
          {post.media_type === "video" && (
            <View style={styles.videoOverlay}>
              <Ionicons name="play-circle" size={60} color="white" />
            </View>
          )}
        </View>

        {/* Post actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={toggleLike}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={24}
              color={isLiked ? "#FF1744" : theme.colors.text}
            />
            <Text style={styles.actionText}>{likesCount} Likes</Text>
          </TouchableOpacity>
        </View>

        {/* Caption */}
        {post.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption}>{post.caption}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.lg,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: theme.spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.fontSize.base,
    fontWeight: "600",
    color: theme.colors.text,
  },
  postTime: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  mediaContainer: {
    position: "relative",
  },
  postMedia: {
    width: "100%",
    aspectRatio: 1,
  },
  videoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionsContainer: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  actionText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: "500",
  },
  captionContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  caption: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    lineHeight: 22,
  },
  commentInputContainer: {
    flexDirection: "row",
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: "flex-end",
    gap: theme.spacing.sm,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    maxHeight: 100,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.textSecondary,
  },
  commentsSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  commentsTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  commentsLoading: {
    alignItems: "center",
    paddingVertical: theme.spacing.md,
  },
  commentItem: {
    flexDirection: "row",
    marginBottom: theme.spacing.md,
    alignItems: "flex-start",
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: theme.spacing.sm,
  },
  commentContent: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
    color: theme.colors.text,
  },
  commentTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  commentText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 18,
  },
  noComments: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
  },
  noCommentsText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
});

export default PostDetailScreen;

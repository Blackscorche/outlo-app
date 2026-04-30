import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  BackHandler,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import { supabase } from "../integrations/supabase/client";
import { useConnectionRequests } from "../hooks/useConnectionRequests";
import {
  checkConnectionQuota,
  useConnectionQuota,
  checkFirstImpressionQuota,
  useFirstImpressionQuota,
} from "../hooks/useSubscription";
import ImageViewer from "../components/ImageViewer";
import { FirstImpressionModal } from "../components/FirstImpressionModal";
import AppLoading from "../components/AppLoading";
import { ACTIVITY_TYPES } from "../constants/activityTypes";
import { validateSafeText } from "../utils/contentModeration";
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../styles/theme';

interface TimelineItem {
  id: string;
  type: "post" | "checkin";
  created_at: string;
  // Post fields
  media_url?: string;
  media_type?: "photo" | "video";
  caption?: string;
  likes_count?: number;
  // Check-in fields
  location_name?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  is_active?: boolean;
  expires_at?: string;
  activity_tag?: string;
  // User info
  user?: {
    id: string;
    name: string;
    photos: string[];
  };
}

// Default images
const DEFAULT_COVER_PHOTO =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=400&fit=crop";
const DEFAULT_PROFILE_PHOTO =
  "https://ui-avatars.com/api/?background=FF1744&color=fff&size=200&font-size=0.5";

const { width } = Dimensions.get("window");
const GRID_ITEM_SIZE =
  (width - theme.spacing.lg * 2 - theme.spacing.xs * 2) / 3;
const HEADER_COLOR = "#0A1A0A";
const HEADER_COLOR_END = "#1B5E20";

const UserProfileScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const {
    getConnectionStatus,
    sendConnectionRequest,
    loadConnectionRequests,
    connections,
    sentRequests,
    receivedRequests,
  } = useConnectionRequests();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("none");
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [stats, setStats] = useState({
    posts: 0,
    connections: 0,
    checkIns: 0,
  });
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showFirstImpressionModal, setShowFirstImpressionModal] =
    useState(false);
  const [currentConnectionRequestId, setCurrentConnectionRequestId] = useState<
    string | null
  >(null);
  const [hasFirstImpression, setHasFirstImpression] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(200);
  const loadDataTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const dataCache = useRef<{
    profile: any;
    connectionStatus: string;
    isConnected: boolean;
    isBlocked: boolean;
    hasFirstImpression: boolean;
    connectionRequestId: string | null;
    timestamp: number;
  } | null>(null);

  const userId = route?.params?.userId;
  console.log(profile, "profile");
  // Memoize timeline posts for better performance
  const timelinePosts = useMemo(
    () => timeline.filter((item) => item.type === "post"),
    [timeline],
  );

  const timelineCheckIns = useMemo(
    () => timeline.filter((item) => item.type === "checkin"),
    [timeline],
  );

  // Memoize action button states for better performance
  const actionButtonState = useMemo(
    () => ({
      isBlocked: isBlockedByMe,
      status: connectionStatus,
      isConnected: isConnected,
      showMapButton:
        profile?.is_online &&
        profile?.current_latitude &&
        profile?.current_longitude,
    }),
    [
      isBlockedByMe,
      connectionStatus,
      isConnected,
      profile?.is_online,
      profile?.current_latitude,
      profile?.current_longitude,
    ],
  );

  useEffect(() => {
    if (!userId) {
      Alert.alert("Error", "User ID is required");
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("Home");
      }
      return;
    }

    // Use timeout to prevent rapid calls during navigation
    const timeoutId = setTimeout(() => {
      loadData();
    }, 100);

    // Cleanup timeout on unmount or userId change
    return () => {
      clearTimeout(timeoutId);
      if (loadDataTimeoutRef.current) {
        clearTimeout(loadDataTimeoutRef.current);
      }
    };
  }, [userId, loadData]);

  // Handle hardware back button on Android
  useEffect(() => {
    const handleBackPress = () => {
      console.log("Hardware back button pressed");
      // Clear any ongoing timeouts
      if (loadDataTimeoutRef.current) {
        clearTimeout(loadDataTimeoutRef.current);
      }

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("Home");
      }
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );

    return () => backHandler.remove();
  }, [navigation]);

  const loadData = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isLoadingData) {
      console.log("=== UserProfileScreen: Already loading, skipping ===");
      return;
    }

    // Check if we already loaded data for this user recently (within 5 seconds)
    const now = Date.now();

    if (
      lastLoadedUserIdRef.current === userId &&
      dataCache.current &&
      now - dataCache.current.timestamp < 5000
    ) {
      setProfile(dataCache.current.profile);
      setConnectionStatus(dataCache.current.connectionStatus);
      setIsConnected(dataCache.current.isConnected);
      setIsBlockedByMe(dataCache.current.isBlocked);
      return;
    }

    try {
      setIsLoadingData(true);
      setLoading(true);
      console.log("=== UserProfileScreen: Starting loadData ===");
      console.log("Target userId:", userId);

      // Get current user
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Parallel data loading for connection status and blocking status
      const [
        { data: blockedByMe },
        { data: connectionData },
        { data: sentRequest },
        { data: receivedRequest },
        { data: existingFirstImpression },
      ] = await Promise.all([
        supabase
          .from("blocked_users")
          .select("*")
          .eq("blocker_id", currentUser.id)
          .eq("blocked_id", userId)
          .single(),
        supabase
          .from("connections")
          .select("*")
          .or(
            `and(user1_id.eq.${currentUser.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${currentUser.id})`,
          )
          .single(),
        supabase
          .from("connection_requests")
          .select("*")
          .eq("sender_id", currentUser.id)
          .eq("receiver_id", userId)
          .eq("status", "pending")
          .single(),
        supabase
          .from("connection_requests")
          .select("*")
          .eq("sender_id", userId)
          .eq("receiver_id", currentUser.id)
          .eq("status", "pending")
          .single(),
        supabase
          .from("first_impressions")
          .select("*")
          .eq("sender_id", currentUser.id)
          .eq("receiver_id", userId)
          .single(),
      ]);

      setIsBlockedByMe(!!blockedByMe);

      // Determine connection status
      if (connectionData) {
        console.log("Users are connected!");
        setConnectionStatus("connected");
        setIsConnected(true);
      } else if (sentRequest) {
        setConnectionStatus("request_sent");
        setIsConnected(false);
        setCurrentConnectionRequestId(sentRequest.id);
        setHasFirstImpression(!!existingFirstImpression);
      } else if (receivedRequest) {
        setConnectionStatus("request_received");
        setIsConnected(false);
      } else {
        setConnectionStatus("none");
        setIsConnected(false);
      }

      // If blocked by me, override connection status
      if (blockedByMe) {
        setConnectionStatus("blocked");
        setIsConnected(false);
      }

      // Load profile data
      await loadProfileData();

      // Cache the loaded data after all state updates
      setTimeout(() => {
        lastLoadedUserIdRef.current = userId;
        dataCache.current = {
          profile,
          connectionStatus,
          isConnected,
          isBlocked: isBlockedByMe,
          hasFirstImpression,
          connectionRequestId: currentConnectionRequestId,
          timestamp: Date.now(),
        };
      }, 100);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
      setIsLoadingData(false);
    }
  }, [userId, isLoadingData]);

  const loadProfileData = async () => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Don't allow viewing own profile through this screen
      if (userId === currentUser.id) {
        navigation.navigate("Settings", { screen: "Profile" });
        return;
      }

      // Check blocking status
      const { data: blockedByMe } = await supabase
        .from("blocked_users")
        .select("*")
        .eq("blocker_id", currentUser.id)
        .eq("blocked_id", userId)
        .single();

      const { data: blockedMe } = await supabase
        .from("blocked_users")
        .select("*")
        .eq("blocker_id", userId)
        .eq("blocked_id", currentUser.id);

      // If the current user is blocked by this user, prevent access
      if (blockedMe && blockedMe.length > 0) {
        Alert.alert(
          "Profile Unavailable",
          "You have been blocked by this user and cannot view their profile.",
        );
        // Try to go back, but if that fails, go to home
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate("Home");
        }
        return;
      }

      // Load profile data
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      setProfile(profileData);
      setShowAllInterests(false);

      // Set blocked status
      setIsBlockedByMe(!!blockedByMe);

      // Only load timeline and stats if not blocked - start loading immediately, don't wait
      if (!blockedByMe) {
        // Load timeline and stats in parallel without blocking UI
        Promise.all([loadTimeline(userId), loadStats(userId)]).catch((error) =>
          console.error("Error loading timeline/stats:", error),
        );
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", "Failed to load profile");
    }
  };

  const loadTimeline = async (profileId: string) => {
    try {
      // Load posts and check-ins in parallel
      const [{ data: posts }, { data: checkIns }] = await Promise.all([
        supabase
          .from("posts")
          .select(
            `
            *, 
            profiles!user_id(id, name, photos),
            post_likes(user_id),
            post_comments(id)
          `,
          )
          .eq("user_id", profileId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("check_ins")
          .select("*, profiles!user_id(id, name, photos)")
          .eq("user_id", profileId)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(3), // Limit check-ins as well for performance
      ]);

      // Combine and sort by date
      const timelineItems: TimelineItem[] = [
        ...(posts || []).map((post) => ({
          ...post,
          type: "post" as const,
          user: post.profiles,
          likes_count: post.post_likes?.length || 0,
        })),
        ...(checkIns || []).map((checkIn) => ({
          ...checkIn,
          type: "checkin" as const,
          user: checkIn.profiles,
        })),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      setTimeline(timelineItems);
    } catch (error) {
      console.error("Error loading timeline:", error);
    }
  };

  const loadStats = async (profileId: string) => {
    try {
      // Load all stats in parallel
      const [
        { count: postsCount },
        { count: connectionsCount },
        { count: checkInsCount },
      ] = await Promise.all([
        supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profileId)
          .eq("is_deleted", false),
        supabase
          .from("connections")
          .select("*", { count: "exact", head: true })
          .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`),
        supabase
          .from("check_ins")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profileId)
          .eq("is_active", true),
      ]);

      setStats({
        posts: postsCount || 0,
        connections: connectionsCount || 0,
        checkIns: checkInsCount || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Clear cache to force fresh data on manual refresh
    dataCache.current = null;
    lastLoadedUserIdRef.current = null;
    await loadData();
    setRefreshing(false);
  };

  const handleConnect = async (useFirstImpression = false) => {
    if (!profile || isConnecting) return;

    // If using first impression, show the modal instead
    if (useFirstImpression) {
      setShowFirstImpressionModal(true);
      return;
    }

    try {
      setIsConnecting(true);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "Please sign in to send connection requests");
        return;
      }

      // Check quotas based on type
      if (false) {
        // This branch is now handled by the modal
      } else {
        // Using regular connection request - only check connection request quota
        const hasConnectionRequestQuota = await checkConnectionQuota(
          user.id,
          false,
        );
        if (!hasConnectionRequestQuota) {
          // Only if connection requests are exhausted, offer first impression as alternative
          const hasFirstImpressionQuota = await checkFirstImpressionQuota(
            user.id,
            false,
          );
          if (hasFirstImpressionQuota) {
            Alert.alert(
              "No Partner Requests",
              "You have no partner requests left, but you have first impressions available. Would you like to use a first impression instead?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Use First Impression",
                  onPress: () => handleConnect(true),
                },
                {
                  text: "View Plans",
                  onPress: () => navigation.navigate("Subscription"),
                },
              ],
            );
            return;
          } else {
            Alert.alert(
              "No Partner Requests",
              "You have no partner requests remaining. Upgrade to Premium or purchase extras to send more requests.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "View Plans",
                  onPress: () => navigation.navigate("Subscription"),
                },
              ],
            );
            return;
          }
        }
      }

      // Immediately update UI to show pending state
      setConnectionStatus("request_sent");

      // Send the connection request
      const success = await sendConnectionRequest(profile.id);

      if (success) {
        // Use the quota
        if (useFirstImpression) {
          await useFirstImpressionQuota(user.id);
        } else {
          await useConnectionQuota(user.id);
        }

        // Reload connection data to confirm the updated status
        await loadConnectionRequests();

        // Update cache to reflect new status
        if (dataCache.current) {
          dataCache.current.connectionStatus = "request_sent";
        }

        // Success message will be shown by the connection hook's toast
      } else {
        // Revert status if request failed
        setConnectionStatus("none");
        Alert.alert("Error", "Failed to send partner request");
      }
    } catch (error) {
      console.error("Error sending connection request:", error);
      // Revert status on error
      setConnectionStatus("none");
      Alert.alert("Error", "Failed to send partner request");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleMessage = async () => {
    if (!profile?.id) {
      Alert.alert("Error", "Unable to start chat. Please try again.");
      return;
    }

    try {
      // Get current user
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) {
        Alert.alert("Error", "You must be logged in to start a chat.");
        return;
      }

      // Create or find existing chat room
      const { data: existingRoom } = await supabase
        .from("chat_rooms")
        .select("id")
        .or(
          `and(user1_id.eq.${currentUser.id},user2_id.eq.${profile.id}),and(user1_id.eq.${profile.id},user2_id.eq.${currentUser.id})`,
        )
        .single();

      let roomId;
      if (existingRoom) {
        roomId = existingRoom.id;
      } else {
        // Create new chat room
        const { data: newRoom, error } = await supabase
          .from("chat_rooms")
          .insert({
            user1_id: currentUser.id,
            user2_id: profile.id,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (error) throw error;
        roomId = newRoom.id;
      }

      navigation.navigate("ChatRoom", {
        roomId: roomId,
        otherUserId: profile.id,
        otherUserName: profile.name,
      });
    } catch (error) {
      console.error("Error creating/finding chat room:", error);
      Alert.alert("Error", "Unable to start chat. Please try again.");
    }
  };

  const handleViewOnMap = () => {
    console.log("View on Map pressed for user:", profile?.name, profile?.id);
    console.log(
      "Location:",
      profile?.current_latitude,
      profile?.current_longitude,
    );

    if (profile && profile.current_latitude && profile.current_longitude) {
      // Navigate to Home tab with focus location
      navigation.navigate("Main", {
        screen: "Home",
        params: {
          focusLocation: {
            latitude: profile.current_latitude,
            longitude: profile.current_longitude,
            userId: profile.id,
          },
        },
      });
    } else {
      Alert.alert(
        "Location Not Available",
        "This user is not currently sharing their location.",
      );
    }
  };

  const handleBlockToggle = () => {
    if (isBlockedByMe) {
      handleUnblock();
    } else {
      handleBlock();
    }
  };

  const handleBlock = async () => {
    Alert.alert(
      "Block User",
      "Are you sure you want to block this user? They will no longer be able to see you or contact you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              const {
                data: { user: currentUser },
              } = await supabase.auth.getUser();
              if (!currentUser || !profile) return;

              const { error } = await supabase.from("blocked_users").insert({
                blocker_id: currentUser.id,
                blocked_id: profile.id,
                created_at: new Date().toISOString(),
              });

              if (error) throw error;

              // Notify moderation / developer side
              await supabase.from("user_reports").insert({
                reporter_id: currentUser.id,
                reported_user_id: profile.id,
                reason: "blocked_user",
                status: "pending",
                created_at: new Date().toISOString(),
              });

              setIsBlockedByMe(true);
              setConnectionStatus("blocked");
              setIsConnected(false);

              Alert.alert(
                "User Blocked",
                "This user has been blocked and reported to our moderation team.",
              );

              loadData();
            } catch (error) {
              console.error("Error blocking user:", error);
              Alert.alert("Error", "Failed to block user");
            }
          },
        },
      ],
    );
  };

  const handleReportUser = () => {
    if (!profile?.id) return;

    Alert.alert("Report User", "Why are you reporting this user?", [
      {
        text: "Spam",
        onPress: () => submitUserReport("spam"),
      },
      {
        text: "Harassment or Abuse",
        onPress: () => submitUserReport("harassment"),
      },
      {
        text: "Inappropriate Content",
        onPress: () => submitUserReport("inappropriate_content"),
      },
      {
        text: "Fake Profile",
        onPress: () => submitUserReport("fake_profile"),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  };

  const submitUserReport = async (reason: string) => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser || !profile) return;

      const { error } = await supabase.from("user_reports").insert({
        reporter_id: currentUser.id,
        reported_user_id: profile.id,
        reason,
        created_at: new Date().toISOString(),
        status: "pending",
      });

      if (error) throw error;

      Alert.alert(
        "Report Submitted",
        "Thank you. This report has been sent to our moderation team for review.",
      );
    } catch (error) {
      console.error("Error reporting user:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    }
  };

  const handleUnblock = async () => {
    Alert.alert(
      "Unblock User",
      "Are you sure you want to unblock this user? They will be able to see you and contact you again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "destructive",
          onPress: async () => {
            try {
              const {
                data: { user: currentUser },
              } = await supabase.auth.getUser();
              if (!currentUser || !profile) return;

              const { error } = await supabase
                .from("blocked_users")
                .delete()
                .eq("blocker_id", currentUser.id)
                .eq("blocked_id", profile.id);

              if (error) throw error;
              Alert.alert("User Unblocked", "This user has been unblocked.");
              // Reload the data to update the UI
              setIsBlockedByMe(false);
              loadData();
            } catch (error) {
              console.error("Error unblocking user:", error);
              Alert.alert("Error", "Failed to unblock user");
            }
          },
        },
      ],
    );
  };

  const renderPostGridItem = useCallback(
    (item: TimelineItem, index: number) => (
      <TouchableOpacity
        key={item.id}
        style={styles.gridPostItem}
        onPress={() =>
          navigation.navigate("PostDetail", {
            postId: item.id,
          })
        }
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.media_url }}
          style={styles.gridPostImage}
          resizeMode="cover"
        />
        {item.media_type === "video" && (
          <View style={styles.gridVideoOverlay}>
            <Ionicons name="play-circle" size={24} color="white" />
          </View>
        )}
        <View style={styles.gridPostStats}>
          <View style={styles.gridStatItem}>
            <Ionicons name="heart" size={12} color="white" />
            <Text style={styles.gridStatText}>{item.likes_count || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [navigation],
  );

  const renderCheckInItem = useCallback((item: TimelineItem) => {
    const isExpired = item.expires_at
      ? new Date(item.expires_at).getTime() < Date.now()
      : false;
    const activityInfo = item.activity_tag
      ? ACTIVITY_TYPES.find((t) => t.id === item.activity_tag)
      : null;

    return (
      <View key={item.id} style={styles.checkInSimpleCard}>
        <View style={styles.checkInIconContainer}>
          <Ionicons
            name={(activityInfo?.icon || "location") as any}
            size={22}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.checkInSimpleInfo}>
          <Text style={styles.checkInSimpleLocation} numberOfLines={1}>
            {item.location_name}
          </Text>
          <Text style={styles.checkInSimpleActivity}>
            {activityInfo?.label || "Check-in"}
          </Text>
          <Text style={styles.checkInSimpleDate}>
            {new Date(item.created_at).toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
        {isExpired ? (
          <View style={styles.expiredBadgeInline}>
            <Ionicons
              name="time-outline"
              size={12}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.expiredBadgeText}>Expired</Text>
          </View>
        ) : (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.colors.textSecondary}
          />
        )}
      </View>
    );
  }, []);

  if (loading || !profile || !profile.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <AppLoading />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Nav Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => {
            try {
              if (loadDataTimeoutRef.current) {
                clearTimeout(loadDataTimeoutRef.current);
              }
              setIsLoadingData(false);
              setLoading(false);
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.reset({ index: 0, routes: [{ name: "Home" }] });
              }
            } catch (error) {
              console.error("Error in back navigation:", error);
              navigation.navigate("Home");
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.navHeaderTitle} numberOfLines={1}>
          {profile?.name || ""}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleReportUser}
          >
            <Ionicons name="flag-outline" size={20} color="#F59E0B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleBlockToggle}
          >
            <Ionicons
              name={isBlockedByMe ? "shield-checkmark" : "ban"}
              size={20}
              color="#EF4444"
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: "#0A0A0A" }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Gradient Header */}
        <View
          style={styles.headerSection}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          {profile?.cover_photo ? (
            <>
              <Image
                source={{ uri: profile.cover_photo }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width,
                  height: headerHeight,
                }}
                resizeMode="cover"
              />
              <Svg
                style={{ position: "absolute", top: 0, left: 0 }}
                width={width}
                height={headerHeight}
                preserveAspectRatio="none"
              >
                <Defs>
                  <SvgLinearGradient
                    id="overlay"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <Stop offset="0%" stopColor="#000" stopOpacity="0" />
                    <Stop offset="60%" stopColor="#000" stopOpacity="0.25" />
                    <Stop offset="100%" stopColor="#000" stopOpacity="0.65" />
                  </SvgLinearGradient>
                </Defs>
                <Rect
                  width={width}
                  height={headerHeight}
                  fill="url(#overlay)"
                />
              </Svg>
            </>
          ) : (
            <Svg
              style={{ position: "absolute", top: 0, left: 0 }}
              width={width}
              height={headerHeight}
              preserveAspectRatio="none"
            >
              <Defs>
                <SvgLinearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor={HEADER_COLOR} />
                  <Stop offset="100%" stopColor={HEADER_COLOR_END} />
                </SvgLinearGradient>
              </Defs>
              <Rect width={width} height={headerHeight} fill="url(#hg)" />
            </Svg>
          )}

          {/* Horizontal profile row */}
          <View style={styles.profileHorizontalRow}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={() => {
                if (profile?.photos && profile.photos.length > 0) {
                  setSelectedImageIndex(0);
                  setShowImageViewer(true);
                }
              }}
              activeOpacity={0.7}
            >
              {profile?.photos?.[0] ? (
                <Image
                  source={{ uri: profile.photos[0] }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons
                    name="person"
                    size={36}
                    color="rgba(255,255,255,0.8)"
                  />
                </View>
              )}
              {profile?.is_online && <View style={styles.onlineDotAvatar} />}
            </TouchableOpacity>

            <View style={styles.profileInfoColumn}>
              <Text style={styles.profileNameHeader}>
                {profile?.name || ""}
              </Text>
              <View style={styles.infoMetaRow}>
                <Ionicons name="location-sharp" size={13} color="#FFD95A" />
                <Text style={styles.infoMetaText}>
                  {profile?.location || "Location not set"}
                  {profile?.is_online ? " • Online now" : ""}
                </Text>
              </View>
              {(profile?.age > 0 || profile?.gender) && (
                <View style={styles.infoMetaRow}>
                  <Ionicons
                    name="person-outline"
                    size={13}
                    color="rgba(255,255,255,0.75)"
                  />
                  <Text style={styles.infoMetaText}>
                    {profile?.age > 0 ? `${profile.age} years` : ""}
                    {profile?.age > 0 && profile?.gender ? " • " : ""}
                    {profile?.gender
                      ? profile.gender === "male"
                        ? "Man"
                        : profile.gender === "female"
                          ? "Woman"
                          : profile.gender.charAt(0).toUpperCase() +
                          profile.gender.slice(1)
                      : ""}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Floating Stats Card */}
        <View style={styles.statsCardWrapper}>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.connections}</Text>
              <Text style={styles.statLbl}>Connections</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.checkIns}</Text>
              <Text style={styles.statLbl}>Check-ins</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.posts}</Text>
              <Text style={styles.statLbl}>Posts</Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Action Buttons */}
          {actionButtonState.isBlocked ? (
            <View style={styles.blockedCard}>
              <Ionicons name="ban" size={20} color="#EF4444" />
              <Text style={styles.blockedCardText}>
                You have blocked this user
              </Text>
            </View>
          ) : (
            <View style={styles.actionRow}>
              {actionButtonState.status === "none" && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.primaryActionBtn,
                      isConnecting && { opacity: 0.6 },
                    ]}
                    onPress={() => handleConnect(false)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="person-add" size={18} color="white" />
                        <Text style={styles.actionBtnText}>Connect</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    onPress={() => handleConnect(true)}
                  >
                    <Ionicons name="sparkles" size={18} color="#4CAF50" />
                    <Text style={styles.secondaryActionBtnText}>
                      First Impression
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              {(actionButtonState.status === "request_sent" ||
                actionButtonState.status === "pending") && (
                  <>
                    <View style={styles.pendingActionBtn}>
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#6B7280"
                      />
                      <Text style={styles.pendingActionBtnText}>
                        Request Sent
                      </Text>
                    </View>
                    {!hasFirstImpression && (
                      <TouchableOpacity
                        style={styles.secondaryActionBtn}
                        onPress={() => setShowFirstImpressionModal(true)}
                      >
                        <Ionicons name="sparkles" size={18} color="#4CAF50" />
                        <Text style={styles.secondaryActionBtnText}>
                          First Impression
                        </Text>
                      </TouchableOpacity>
                    )}
                    {hasFirstImpression && (
                      <View style={styles.sentImpressionBtn}>
                        <Ionicons
                          name="checkmark-done"
                          size={18}
                          color="#10B981"
                        />
                        <Text style={styles.sentImpressionBtnText}>
                          Impression Sent
                        </Text>
                      </View>
                    )}
                  </>
                )}
              {actionButtonState.status === "request_received" && (
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => navigation.navigate("Connections")}
                >
                  <Ionicons name="person-add" size={18} color="white" />
                  <Text style={styles.actionBtnText}>Respond to Request</Text>
                </TouchableOpacity>
              )}
              {actionButtonState.status === "connected" && (
                <>
                  {profile?.current_latitude && profile?.current_longitude && (
                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={handleViewOnMap}
                    >
                      <Ionicons name="map-outline" size={18} color="white" />
                      <Text style={styles.actionBtnText}>View on Map</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.messageActionBtn}
                    onPress={handleMessage}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={18}
                      color="white"
                    />
                    <Text style={styles.actionBtnText}>Message</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* About Me */}
          {!isBlockedByMe && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>
                About Me
              </Text>
              <View style={styles.card}>
                {profile?.bio && profile.bio.length > 0 ? (
                  <Text style={styles.bioText}>{profile.bio}</Text>
                ) : (
                  <Text style={styles.bioPlaceholder}>No bio available</Text>
                )}
                {profile?.interests && profile.interests.length > 0 && (
                  <View style={styles.tagsRow}>
                    {(showAllInterests
                      ? profile.interests
                      : profile.interests.slice(0, 5)
                    ).map((interest: string, idx: number) => (
                      <View key={idx} style={styles.tagChip}>
                        <Text style={styles.tagText}>{interest}</Text>
                      </View>
                    ))}
                    {!showAllInterests && profile.interests.length > 5 && (
                      <TouchableOpacity
                        style={styles.tagChip}
                        onPress={() => setShowAllInterests(true)}
                      >
                        <Text style={styles.tagText}>
                          +{profile.interests.length - 5} more
                        </Text>
                      </TouchableOpacity>
                    )}
                    {showAllInterests && profile.interests.length > 5 && (
                      <TouchableOpacity
                        style={[styles.tagChip, { backgroundColor: "#2A2A2A" }]}
                        onPress={() => setShowAllInterests(false)}
                      >
                        <Text style={[styles.tagText, { color: "#B3B3B3" }]}>
                          Show less
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Posts Grid */}
          {!isBlockedByMe && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Posts</Text>
                {(stats.posts || 0) > 6 && (
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("AllPosts", {
                        userId: profile?.id,
                        userName: profile?.name,
                      })
                    }
                  >
                    <Text style={styles.viewAllLink}>
                      View All ({stats.posts})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {timelinePosts.length > 0 ? (
                <View style={styles.postsGrid}>
                  {timelinePosts.map(renderPostGridItem)}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons
                    name="images-outline"
                    size={32}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.emptyCardText}>No posts yet</Text>
                </View>
              )}
            </View>
          )}

          {/* Recent Check-ins */}
          {!isBlockedByMe && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>
                Recent Check-ins
              </Text>
              {timelineCheckIns.length > 0 ? (
                <View style={styles.checkInsList}>
                  {timelineCheckIns.map(renderCheckInItem)}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons
                    name="location-outline"
                    size={32}
                    color={theme.colors.textSecondary}
                  />
                  <Text style={styles.emptyCardText}>No recent check-ins</Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      {/* Image Viewer */}
      {profile?.photos && profile.photos.length > 0 && (
        <ImageViewer
          visible={showImageViewer}
          images={profile.photos}
          initialIndex={selectedImageIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {/* First Impression Modal */}
      {profile && (
        <FirstImpressionModal
          visible={showFirstImpressionModal}
          onClose={() => setShowFirstImpressionModal(false)}
          onSend={async (message) => {
            const contentCheck = validateSafeText(message, "message");
            if (!contentCheck.valid) {
              Alert.alert("Not Allowed", contentCheck.message);
              return;
            }
            try {
              setIsConnecting(true);
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) return;

              if (!currentConnectionRequestId) {
                const success = await sendConnectionRequest(profile.id);
                if (success) {
                  await useFirstImpressionQuota(user.id);
                  setConnectionStatus("request_sent");
                  await loadConnectionRequests();
                  if (dataCache.current) {
                    dataCache.current.connectionStatus = "request_sent";
                  }
                  await loadData();
                }
              } else {
                await useFirstImpressionQuota(user.id);
                setHasFirstImpression(true);
                if (dataCache.current) {
                  dataCache.current.hasFirstImpression = true;
                }
              }
            } catch (error) {
              console.error("Error after sending first impression:", error);
            } finally {
              setIsConnecting(false);
            }
          }}
          receiverName={profile.name || "User"}
          receiverId={profile.id}
          connectionRequestId={currentConnectionRequestId}
        />
      )}
    </SafeAreaView>
  );
};

const makeStyles = (t: any) => StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },

  // Nav header
  navHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: t.spacing.xs,
    paddingRight: t.spacing.md,
    paddingLeft: t.spacing.sm,
    backgroundColor: t.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
    zIndex: 1,
  },
  navHeaderTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
    color: t.colors.text,
    pointerEvents: "none",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },

  // Profile card header
  headerSection: {
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  profileHorizontalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarWrapper: {
    position: "relative",
    flexShrink: 0,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.6)",
  },
  avatarFallback: {
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineDotAvatar: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "white",
  },
  profileInfoColumn: {
    flex: 1,
    gap: 5,
  },
  profileNameHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
  },
  infoMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  infoMetaText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    flexShrink: 1,
  },

  // Stats card
  statsCardWrapper: {
    marginTop: -14,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  statsCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    flexDirection: "row",
    paddingVertical: 16,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNum: {
    fontSize: 20,
    fontWeight: "700",
    color: t.colors.text,
  },
  statLbl: {
    fontSize: 11,
    color: t.colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  statSep: {
    width: 1,
    backgroundColor: t.colors.border,
    marginVertical: 4,
  },

  // Content
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: t.colors.background,
  },

  // Action buttons
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 13,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: t.colors.surface,
    borderRadius: 12,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: "#4CAF50",
  },
  secondaryActionBtnText: {
    color: "#4CAF50",
    fontSize: 15,
    fontWeight: "600",
  },
  messageActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 13,
  },
  pendingActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: t.colors.inputBg,
    borderRadius: 12,
    paddingVertical: 13,
  },
  pendingActionBtnText: {
    color: t.colors.textSecondary,
    fontSize: 15,
    fontWeight: "600",
  },
  sentImpressionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#1A2E1A",
    borderRadius: 12,
    paddingVertical: 13,
  },
  sentImpressionBtnText: {
    color: "#4CAF50",
    fontSize: 15,
    fontWeight: "600",
  },
  actionBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },
  blockedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#2A1515",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#5A2020",
  },
  blockedCardText: {
    color: "#EF4444",
    fontWeight: "600",
    fontSize: 14,
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: t.colors.text,
  },
  viewAllLink: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
  },

  // White card
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
  },

  // About Me
  bioText: {
    fontSize: 14,
    color: t.colors.text,
    lineHeight: 22,
  },
  bioPlaceholder: {
    fontSize: 14,
    color: t.colors.textSecondary,
    lineHeight: 22,
    fontStyle: "italic",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  tagChip: {
    backgroundColor: "rgba(76, 175, 80, 0.12)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.25)",
  },
  tagText: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "500",
  },

  // Posts grid
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  gridPostItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    position: "relative",
  },
  gridPostImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
  },
  gridVideoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  gridPostStats: {
    position: "absolute",
    bottom: 5,
    left: 5,
  },
  gridStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  gridStatText: {
    color: "white",
    fontSize: 11,
    fontWeight: "500",
  },

  // Check-ins list
  checkInsList: {
    gap: 8,
  },
  checkInSimpleCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  checkInIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(76, 175, 80, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkInSimpleInfo: {
    flex: 1,
  },
  checkInSimpleLocation: {
    fontSize: 14,
    fontWeight: "600",
    color: t.colors.text,
  },
  checkInSimpleActivity: {
    fontSize: 12,
    color: t.colors.textSecondary,
    marginTop: 2,
  },
  checkInSimpleDate: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  expiredBadgeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: t.colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expiredBadgeText: {
    fontSize: 11,
    color: t.colors.textSecondary,
  },

  // Empty state
  emptyCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  emptyCardText: {
    fontSize: 14,
    color: t.colors.textSecondary,
    marginTop: 8,
  },
});

export default UserProfileScreen;

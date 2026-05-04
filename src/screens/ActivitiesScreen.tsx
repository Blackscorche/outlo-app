import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { commonStyles } from "../styles/common";
import { useActivities, Activity } from "../hooks/useActivities";
import { ACTIVITY_TYPES } from "../constants/activityTypes";
import AppLoading from "../components/AppLoading";
import ActivityCard from "../components/ActivityCard";
import CreateActivityModal from "../components/CreateActivityModal";
import ActivityDetailModal from "../components/ActivityDetailModal";
import { supabase } from "../integrations/supabase/client";
import { useTheme } from '../contexts/ThemeContext';

type TabType = "all" | "my" | "joined";
type DistanceFilter = "all" | "1" | "5" | "10" | "25";
type DateFilter = "all" | "today" | "week" | "nextweek";

const DISTANCE_OPTIONS: { value: DistanceFilter; label: string }[] = [
  { value: "all", label: "Any Distance" },
  { value: "1", label: "1 km" },
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" },
  { value: "25", label: "25 km" },
];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "Any Date" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "nextweek", label: "Next Week" },
];

// Calculate distance between two coordinates in km
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function ActivitiesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const {
    activities,
    myActivities,
    joinedActivities,
    loading,
    refreshing,
    refreshActivities,
    joinActivity,
    leaveActivity,
    completeActivity,
    cancelActivity,
    fetchComments,
    addComment,
    deleteComment,
  } = useActivities();

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null,
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    getCurrentUser();
    getUserLocation();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshActivities();
    }, [refreshActivities])
  );

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          lat: location.coords.latitude,
          lon: location.coords.longitude,
        });
      }
    } catch (error) {
      console.log("Could not get user location:", error);
    }
  };

  const isDateInRange = (dateString: string, filter: DateFilter): boolean => {
    if (filter === "all") return true;

    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));

    const startOfNextWeek = new Date(endOfWeek);
    startOfNextWeek.setDate(startOfNextWeek.getDate() + 1);
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(endOfNextWeek.getDate() + 6);

    switch (filter) {
      case "today":
        return date >= today && date < tomorrow;
      case "week":
        return date >= today && date <= endOfWeek;
      case "nextweek":
        return date >= startOfNextWeek && date <= endOfNextWeek;
      default:
        return true;
    }
  };

  const applyFilters = (list: Activity[]) => {
    let filtered = list;

    // Filter by activity type
    if (selectedFilter) {
      filtered = filtered.filter((a) => a.activity_type === selectedFilter);
    }

    // Filter by date
    if (dateFilter !== "all") {
      filtered = filtered.filter((a) =>
        isDateInRange(a.scheduled_at, dateFilter),
      );
    }

    // Filter by distance
    if (distanceFilter !== "all" && userLocation) {
      const maxDistance = parseInt(distanceFilter);
      filtered = filtered.filter((a) => {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lon,
          a.latitude,
          a.longitude,
        );
        return distance <= maxDistance;
      });
    }

    // Filter by available spots
    if (showOnlyAvailable) {
      filtered = filtered.filter(
        (a) => a.current_participants < a.max_participants,
      );
    }

    return filtered;
  };

  const getFilteredActivities = () => {
    switch (activeTab) {
      case "my":
        return applyFilters(myActivities);
      case "joined":
        return applyFilters(joinedActivities);
      default:
        return applyFilters(activities);
    }
  };

  const handleJoinActivity = async (activity: Activity) => {
    if (activity.is_paid) {
      navigation.navigate("TicketCheckout", { activityId: activity.id });
      return;
    }

    const isParticipant = activity.participants?.some(
      (p) => p.user_id === currentUserId && p.status === "joined",
    );

    if (isParticipant) {
      await leaveActivity(activity.id);
    } else {
      await joinActivity(activity.id);
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (distanceFilter !== "all") count++;
    if (dateFilter !== "all") count++;
    if (showOnlyAvailable) count++;
    return count;
  };

  const renderActivityCard = ({ item }: { item: Activity }) => {
    // Calculate distance if user location is available
    let distance: number | undefined;
    if (userLocation) {
      distance = calculateDistance(
        userLocation.lat,
        userLocation.lon,
        item.latitude,
        item.longitude,
      );
    }

    return (
      <ActivityCard
        activity={item}
        currentUserId={currentUserId || undefined}
        onPress={() => setSelectedActivity(item)}
        onJoin={() => handleJoinActivity(item)}
        showJoinButton={activeTab === "all"}
        distance={distance}
      />
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="calendar-outline"
        size={64}
        color={theme.colors.gray[300]}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === "my"
          ? "No sessions created yet"
          : activeTab === "joined"
            ? "No sessions joined yet"
            : "No learning sessions available"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === "all"
          ? "Create a session to teach, learn, or collaborate nearby."
          : "Explore skill-based sessions and join one nearby."}
      </Text>
      {activeTab === "all" && (
        <TouchableOpacity
          style={styles.createButtonEmpty}
          onPress={() => navigation.navigate("CreateActivity")}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.createButtonEmptyText}>Create Activity</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const filteredActivities = getFilteredActivities();
  const filteredAllCount = applyFilters(activities).length;
  const filteredJoinedCount = applyFilters(joinedActivities).length;
  const filteredMyCount = applyFilters(myActivities).length;
  const activeFiltersCount = getActiveFiltersCount();
  const hasPaidActivities = myActivities.some(a => a.is_paid);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Home")}>
          <Image
            source={require('../../assets/logos/darkmode_logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Skill Activities</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="funnel" size={20} color="#4CAF50" />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate("CreateActivity")}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "all" && styles.activeTab]}
          onPress={() => setActiveTab("all")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "all" && styles.activeTabText,
            ]}
          >
            Explore ({filteredAllCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "joined" && styles.activeTab]}
          onPress={() => setActiveTab("joined")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "joined" && styles.activeTabText,
            ]}
          >
            Joined ({filteredJoinedCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "my" && styles.activeTab]}
          onPress={() => setActiveTab("my")}
        >
          <Text
            style={[styles.tabText, activeTab === "my" && styles.activeTabText]}
          >
            Hosting ({filteredMyCount})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'my' && hasPaidActivities && (
        <TouchableOpacity
          style={styles.earningsButton}
          onPress={() => navigation.navigate('CreatorWallet')}
          activeOpacity={0.8}
        >
          <View style={styles.earningsIconWrap}>
            <Ionicons name="wallet" size={20} color="#4CAF50" />
          </View>
          <View style={styles.earningsTextWrap}>
            <Text style={styles.earningsTitle}>View Earnings</Text>
            <Text style={styles.earningsSubtitle}>Track ticket sales & payouts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#4CAF50" />
        </TouchableOpacity>
      )}

      {/* Filter Row */}
      <View style={styles.filterRow}>
        {/* Activity Type Filter */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { id: null, label: "All", icon: "apps-outline" },
            ...ACTIVITY_TYPES,
          ]}
          keyExtractor={(item) => item.id || "all"}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive =
              selectedFilter === item.id ||
              (!selectedFilter && item.id === null);
            const chipColor =
              "color" in item && item.color ? item.color : theme.colors.primary;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { borderColor: chipColor },
                  isActive && {
                    backgroundColor: chipColor,
                    borderColor: chipColor,
                  },
                ]}
                onPress={() => setSelectedFilter(item.id)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={16}
                  color={isActive ? "white" : chipColor}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: chipColor },
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Activities List */}
      {loading && activities.length === 0 ? (
        <View style={styles.loadingContainer}>
          <AppLoading />
        </View>
      ) : (
        <FlatList
          data={filteredActivities}
          renderItem={renderActivityCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshActivities}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.filterModal}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Distance Filter */}
            <Text style={styles.filterSectionTitle}>Distance</Text>
            <View style={styles.filterOptions}>
              {DISTANCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterOption,
                    distanceFilter === option.value &&
                    styles.filterOptionActive,
                  ]}
                  onPress={() => setDistanceFilter(option.value)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      distanceFilter === option.value &&
                      styles.filterOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date Filter */}
            <Text style={styles.filterSectionTitle}>Date</Text>
            <View style={styles.filterOptions}>
              {DATE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterOption,
                    dateFilter === option.value && styles.filterOptionActive,
                  ]}
                  onPress={() => setDateFilter(option.value)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      dateFilter === option.value &&
                      styles.filterOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Available Spots */}
            <TouchableOpacity
              style={styles.availableToggle}
              onPress={() => setShowOnlyAvailable(!showOnlyAvailable)}
            >
              <Ionicons
                name={showOnlyAvailable ? "checkbox" : "square-outline"}
                size={24}
                color={theme.colors.primary}
              />
              <Text style={styles.availableToggleText}>
                Only show sessions with available spots
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create Activity Modal */}
      <CreateActivityModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          refreshActivities();
        }}
      />

      {/* Activity Detail Modal */}
      <ActivityDetailModal
        visible={!!selectedActivity}
        activity={selectedActivity}
        currentUserId={currentUserId || undefined}
        onClose={() => setSelectedActivity(null)}
        onJoin={() => {
          if (selectedActivity) {
            handleJoinActivity(selectedActivity);
          }
        }}
        onViewProfile={(userId) => {
          setSelectedActivity(null);
          if (userId === currentUserId) {
            navigation.navigate("Main", { screen: "Profile" });
          } else {
            navigation.navigate("UserProfile", { userId });
          }
        }}
        onComplete={() => {
          if (selectedActivity) {
            completeActivity(selectedActivity.id);
          }
        }}
        onCancel={() => {
          if (selectedActivity) {
            cancelActivity(selectedActivity.id);
          }
        }}
        fetchComments={fetchComments}
        addComment={addComment}
        deleteComment={deleteComment}
      />
    </SafeAreaView>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: t.spacing.xs,
    paddingRight: t.spacing.md,
    paddingLeft: 12,
    backgroundColor: t.colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "bold",
    color: t.colors.text,
    pointerEvents: "none",
  },
  headerLogo: {
    width: 120,
    height: 40,
    marginLeft: 0,
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
  filterBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  createButton: {
    backgroundColor: t.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: t.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: t.spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#4CAF50",
  },
  tabText: {
    fontSize: 14,
    color: t.colors.textSecondary,
    fontWeight: "500",
  },
  activeTabText: {
    color: "#4CAF50",
    fontWeight: "600",
  },
  filterRow: {
    backgroundColor: t.colors.surface,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  filterList: {
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#4CAF50",
    backgroundColor: "transparent",
    marginRight: t.spacing.sm,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  filterChipText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "white",
  },
  additionalFilters: {
    flexDirection: "row",
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
    backgroundColor: t.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    gap: t.spacing.sm,
    flexWrap: "wrap",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: 4,
  },
  filterButtonActive: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  filterButtonText: {
    fontSize: 12,
    color: t.colors.textSecondary,
    fontWeight: "500",
  },
  filterButtonTextActive: {
    color: "white",
  },
  clearFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  clearFiltersText: {
    fontSize: 12,
    color: t.colors.error,
    fontWeight: "500",
  },
  listContent: {
    padding: t.spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: t.spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: t.colors.text,
    marginTop: t.spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: t.colors.textSecondary,
    marginTop: t.spacing.sm,
    textAlign: "center",
  },
  createButtonEmpty: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    marginTop: t.spacing.lg,
    gap: t.spacing.sm,
  },
  createButtonEmptyText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  filterModal: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: t.spacing.lg,
    paddingBottom: t.spacing.xl * 2,
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: t.spacing.lg,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: t.colors.text,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: t.colors.text,
    marginTop: t.spacing.md,
    marginBottom: t.spacing.sm,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.spacing.sm,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.background,
  },
  filterOptionActive: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primary + "15",
  },
  filterOptionText: {
    fontSize: 14,
    color: t.colors.textSecondary,
  },
  filterOptionTextActive: {
    color: t.colors.primary,
    fontWeight: "600",
  },
  availableToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: t.spacing.lg,
    gap: t.spacing.sm,
  },
  availableToggleText: {
    fontSize: 14,
    color: t.colors.text,
  },
  applyButton: {
    backgroundColor: t.colors.primary,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    alignItems: "center",
    marginTop: t.spacing.lg,
  },
  applyButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  earningsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
    gap: 12,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  earningsIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#4CAF5018',
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningsTextWrap: {
    flex: 1,
  },
  earningsTitle: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: 15,
  },
  earningsSubtitle: {
    color: t.colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
});

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Linking,
} from "react-native";
import Slider from "@react-native-community/slider";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../styles/theme";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../hooks/useAuth";
import { useSettings } from "../contexts/SettingsContext";
import { clearStoredSettings } from "../utils/settingsStorage";
import { useSubscription } from "../hooks/useSubscription";
import engagementNotificationService from "../services/engagementNotificationService";

const SettingsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const {
    settings,
    updateLocationEnabled,
    startManualCheckIn,
    endManualCheckIn,
    updateKeepScreenOn,
    updateFilters,
  } = useSettings();
  const { isInvisibleMode, isPremium } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{
    name: string;
    photos: string[];
  } | null>(null);

  // Notification toggles
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifConnections, setNotifConnections] = useState(true);
  const [notifActivity, setNotifActivity] = useState(false);

  // Extract from settings context
  const { isLocationEnabled, isVisible, visibleUntil, activeFilters } =
    settings;
  const [distance, setDistance] = useState(activeFilters.distance ?? 10);
  const [minAge, setMinAge] = useState(activeFilters.ageRange?.[0] ?? 18);
  const [maxAge, setMaxAge] = useState(activeFilters.ageRange?.[1] ?? 35);
  const [gender, setGender] = useState<"all" | "male" | "female">(
    activeFilters.gender ?? "all",
  );

  useEffect(() => {
    loadProfile();
    loadNotificationSettings();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("name, photos")
      .eq("id", user.id)
      .single();
    if (error) console.error("Error loading profile:", error);
    if (data) setProfile(data);
  };

  const loadNotificationSettings = async () => {
    try {
      const s = await engagementNotificationService.getSettings();
      setNotifActivity(s.enabled);
    } catch (e) {
      console.error("Error loading notification settings:", e);
    }
  };

  const saveFilters = async (newFilters: {
    distance?: number;
    minAge?: number;
    maxAge?: number;
    gender?: string;
  }) => {
    try {
      await updateFilters({
        genderPreference: newFilters.gender ?? gender,
        maxDistance: newFilters.distance ?? distance,
        minAge: newFilters.minAge ?? minAge,
        maxAge: newFilters.maxAge ?? maxAge,
      });
    } catch (e) {
      console.error("Error saving filters:", e);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            const {
              data: { user: u },
            } = await supabase.auth.getUser();
            if (u) {
              await supabase
                .from("profiles")
                .update({
                  is_online: false,
                  last_seen: new Date().toISOString(),
                })
                .eq("id", u.id);
            }
            await clearStoredSettings();
            await supabase.auth.signOut();
          } catch (e) {
            console.error("Error during logout:", e);
            await clearStoredSettings();
            await supabase.auth.signOut();
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final Confirmation",
              "This will permanently delete your account and all associated data.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Confirm Delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      setLoading(true);
                      const {
                        data: { user: u },
                      } = await supabase.auth.getUser();
                      if (!u) {
                        Alert.alert("Error", "User not found");
                        return;
                      }
                      const { error } = await supabase.functions.invoke(
                        "delete-account",
                        { body: { userId: u.id } },
                      );
                      if (error) {
                        Alert.alert(
                          "Deletion Failed",
                          "We could not delete your account right now. Please try again shortly.",
                        );
                        return;
                      }
                      await clearStoredSettings();
                      await supabase.auth.signOut();
                    } catch (e) {
                      Alert.alert(
                        "Error",
                        "Failed to delete account. Please contact support@lovemapapp.com",
                      );
                    } finally {
                      setLoading(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const avatarUri = profile?.photos?.[0];
  const genderLabel =
    gender === "all" ? "Everyone" : gender === "male" ? "Men" : "Women";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("Home")}>
          <Image
            source={require("../../assets/favicon.png")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatarContainer}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={28} color="#ccc" />
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile?.name ?? ""}</Text>
              <Text style={styles.profileEmail}>{user?.email ?? ""}</Text>
              {isPremium && (
                <View style={styles.premiumBadge}>
                  <View style={styles.premiumDot} />
                  <Text style={styles.premiumText}>Premium Member</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Location Settings */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color="#FF1744" />
            <Text style={styles.sectionTitle}>Location Settings</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Enable Location</Text>
              <Text style={styles.toggleSubtitle}>
                Allow location access to discover nearby users and activities
              </Text>
            </View>
            <Switch
              value={isLocationEnabled}
              onValueChange={async (v) => {
                try {
                  setLoading(true);
                  await updateLocationEnabled(v);
                } catch (e) {
                } finally {
                  setLoading(false);
                }
              }}
              trackColor={{ false: "#E0E0E0", true: "#4CAF50" }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.divider} />
          {/* <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Show on Map</Text>
              <Text style={styles.toggleSubtitle}>
                Make yourself visible to others
              </Text>
            </View>
            <Switch
              value={isVisible}
              onValueChange={async (v) => {
                try {
                  if (!v && !isInvisibleMode) {
                    Alert.alert(
                      "Premium Feature",
                      "Invisible mode requires Premium.",
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
                  setLoading(true);
                  await updateVisibility(v);
                } catch (e) {
                } finally {
                  setLoading(false);
                }
              }}
              trackColor={{ false: "#E0E0E0", true: "#4CAF50" }}
              thumbColor="#fff"
            />
          </View> */}

          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Map Check-In</Text>
              <Text style={styles.toggleSubtitle}>
                {isVisible && visibleUntil
                  ? `Visible until ${new Date(visibleUntil).toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}`
                  : "Manually check in to appear on the map"}
              </Text>
            </View>

            {isVisible ? (
              <TouchableOpacity
                style={styles.checkInEndButton}
                onPress={async () => {
                  try {
                    setLoading(true);
                    await endManualCheckIn();
                  } catch (e) {
                    Alert.alert("Error", "Failed to end check-in.");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={styles.checkInEndButtonText}>End</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.checkInStartButton}
                onPress={async () => {
                  try {
                    setLoading(true);
                    await startManualCheckIn(60);
                  } catch (e: any) {
                    Alert.alert(
                      "Error",
                      e?.message || "Failed to start check-in.",
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={styles.checkInStartButtonText}>Check In</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Discovery Filters */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="funnel" size={20} color="#2979FF" />
            <Text style={styles.sectionTitle}>Discovery Filters</Text>
          </View>
          <View style={styles.divider} />

          {/* Distance */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderLabel}>Distance Range</Text>
              <Text style={styles.sliderValue}>{Math.round(distance)} km</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={25}
              value={distance}
              onValueChange={setDistance}
              onSlidingComplete={(v) =>
                saveFilters({ distance: Math.round(v) })
              }
              minimumTrackTintColor="#FF1744"
              maximumTrackTintColor="#E0E0E0"
              thumbTintColor="#2979FF"
            />
            <View style={styles.sliderRange}>
              <Text style={styles.sliderRangeText}>1km</Text>
              <Text style={styles.sliderRangeText}>25km</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Age Range */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderLabelRow}>
              <Text style={styles.sliderLabel}>Age Range</Text>
              <Text style={styles.sliderValue}>
                {Math.round(minAge)}-{Math.round(maxAge)}
              </Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={18}
              maximumValue={65}
              value={minAge}
              onValueChange={setMinAge}
              onSlidingComplete={(v) => saveFilters({ minAge: Math.round(v) })}
              minimumTrackTintColor="#2979FF"
              maximumTrackTintColor="#FF1744"
              thumbTintColor="#2979FF"
            />
            <View style={styles.sliderRange}>
              <Text style={styles.sliderRangeText}>18</Text>
              <Text style={styles.sliderRangeText}>65</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Gender */}
          <View style={styles.sliderSection}>
            <Text style={styles.sliderLabel}>Gender Preference</Text>
            <View style={styles.genderButtons}>
              {(["all", "male", "female"] as const).map((g) => {
                const label =
                  g === "all" ? "Everyone" : g === "male" ? "Men" : "Women";
                const active = gender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderBtn, active && styles.genderBtnActive]}
                    onPress={() => {
                      setGender(g);
                      saveFilters({ gender: label });
                    }}
                  >
                    <Text
                      style={[
                        styles.genderBtnText,
                        active && styles.genderBtnTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={20} color="#7C3AED" />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>New Messages</Text>
              <Text style={styles.toggleSubtitle}>
                Get notified of new chat messages
              </Text>
            </View>
            <Switch
              value={notifMessages}
              onValueChange={setNotifMessages}
              trackColor={{ false: "#E0E0E0", true: "#4CAF50" }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Connection Requests</Text>
              <Text style={styles.toggleSubtitle}>
                When someone wants to connect
              </Text>
            </View>
            <Switch
              value={notifConnections}
              onValueChange={setNotifConnections}
              trackColor={{ false: "#E0E0E0", true: "#4CAF50" }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Activity Updates</Text>
              <Text style={styles.toggleSubtitle}>
                New activities and events nearby
              </Text>
            </View>
            <Switch
              value={notifActivity}
              onValueChange={async (v) => {
                try {
                  await engagementNotificationService.updateSettings({
                    enabled: v,
                  });
                  setNotifActivity(v);
                } catch (e) {}
              }}
              trackColor={{ false: "#E0E0E0", true: "#4CAF50" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Privacy & Safety */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#00C853" />
            <Text style={styles.sectionTitle}>Privacy & Safety</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate("BlockedUsers")}
          >
            <View style={styles.menuRowLeft}>
              <Ionicons
                name="people-outline"
                size={20}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.menuRowText}>Blocked Users</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.gray[400]}
            />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              const url =
                "https://youthful-bath-564.notion.site/LoveMap-Privacy-Policy-32f2528e6c4180028ae7d72d7cc9a2b7";
              Linking.openURL(url).catch(() =>
                Alert.alert("Error", "Unable to open link"),
              );
            }}
          >
            <View style={styles.menuRowLeft}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.menuRowText}>Privacy Policy</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.gray[400]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              const url =
                "https://youthful-bath-564.notion.site/LoveMap-Terms-of-Service-32f2528e6c418020b72de5f727b05da2";
              Linking.openURL(url).catch(() =>
                Alert.alert("Error", "Unable to open link"),
              );
            }}
          >
            <View style={styles.menuRowLeft}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.menuRowText}>Terms of Service</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.gray[400]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              const email = "support@lovemapapp.com";
              Linking.openURL(`mailto:${email}`).catch(() =>
                Alert.alert("Error", "Unable to open email app"),
              );
            }}
          >
            <View style={styles.menuRowLeft}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.menuRowText}>Contact Support</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.gray[400]}
            />
          </TouchableOpacity>
        </View>

        {/* Premium Banner */}
        <View style={styles.premiumBanner}>
          <View style={styles.premiumBannerContent}>
            <Text style={styles.premiumBannerTitle}>Premium Features</Text>
            <Text style={styles.premiumBannerSubtitle}>
              Unlock unlimited connections & more
            </Text>
          </View>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => navigation.navigate("Subscription")}
          >
            <Text style={styles.upgradeBtnText}>Upgrade</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <View style={styles.card}>
          <Text style={styles.accountHeader}>Account</Text>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate("ChangePassword")}
          >
            <View style={styles.menuRowLeft}>
              <Ionicons
                name="key-outline"
                size={20}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.menuRowText}>Change Password</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.gray[400]}
            />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => navigation.navigate("ChangeEmail")}
          >
            <View style={styles.menuRowLeft}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.menuRowText}>Change Email</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.gray[400]}
            />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleDeleteAccount}
          >
            <View style={styles.menuRowLeft}>
              <Ionicons
                name="trash-outline"
                size={20}
                color={theme.colors.error}
              />
              <Text style={[styles.menuRowText, { color: theme.colors.error }]}>
                Delete Account
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.gray[400]}
            />
          </TouchableOpacity>
        </View>

        {/* Log Out */}
        <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
          <Ionicons
            name="log-out-outline"
            size={22}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 16,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1,
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
    color: theme.colors.text,
    pointerEvents: "none",
  },
  headerLogo: {
    width: 150,
    height: 50,
    marginLeft: -25,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  // Profile
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.text,
  },
  profileEmail: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  premiumDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  premiumText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600",
  },
  editButton: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FF1744",
  },
  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginVertical: 2,
  },
  // Toggle rows
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.text,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  // Sliders
  sliderSection: {
    paddingVertical: 10,
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sliderLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.text,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FF1744",
  },
  slider: {
    width: "100%",
    height: 36,
  },
  sliderRange: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  sliderRangeText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  // Gender buttons
  genderButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  genderBtnActive: {
    borderColor: "#2979FF",
    backgroundColor: "#2979FF",
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  genderBtnTextActive: {
    color: "#FFFFFF",
  },
  // Menu rows
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  menuRowText: {
    fontSize: 15,
    color: theme.colors.text,
  },
  // Premium banner
  premiumBanner: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#C44BFF",
  },
  premiumBannerContent: {
    flex: 1,
  },
  premiumBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  premiumBannerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 3,
  },
  upgradeBtn: {
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    marginLeft: 12,
  },
  upgradeBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  // Account
  accountHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 4,
  },
  // Logout
  logoutRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  checkInStartButton: {
    backgroundColor: "#FF1744",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  checkInStartButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  checkInEndButton: {
    backgroundColor: "#F5F5F5",
    borderColor: "#FF1744",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  checkInEndButtonText: {
    color: "#FF1744",
    fontWeight: "700",
    fontSize: 13,
  },
});

export default SettingsScreen;

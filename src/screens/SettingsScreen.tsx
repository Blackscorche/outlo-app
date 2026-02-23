import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';
import { supabase } from '../integrations/supabase/client';
import MapFilters from '../components/MapFilters';
import { useSettings } from '../contexts/SettingsContext';
import { clearStoredSettings } from '../utils/settingsStorage';
import { useSubscription } from '../hooks/useSubscription';
import engagementNotificationService from '../services/engagementNotificationService';

const SettingsScreen = ({ navigation }) => {
  const { settings, updateLocationEnabled, updateVisibility, updateKeepScreenOn, updateFilters } = useSettings();
  const { isInvisibleMode } = useSubscription();
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [smartNotificationsEnabled, setSmartNotificationsEnabled] = useState(true);
  
  // Extract values from settings context
  const { isLocationEnabled, isVisible, keepScreenOn, activeFilters } = settings;
  const genderPreference = activeFilters.gender === 'all' ? 'Everyone' :
                          activeFilters.gender === 'male' ? 'Men' : 'Women';
  const [minAge, maxAge] = activeFilters.ageRange;
  const maxDistance = activeFilters.distance;

  // Load smart notification settings on mount
  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const settings = await engagementNotificationService.getSettings();
      setSmartNotificationsEnabled(settings.enabled);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get current user ID before signing out
              const { data: { user } } = await supabase.auth.getUser();
              
              if (user) {
                // Update user status to offline
                await supabase
                  .from('profiles')
                  .update({
                    is_online: false,
                    last_seen: new Date().toISOString(),
                  })
                  .eq('id', user.id);
              }
              
              // Clear stored settings before signing out
              await clearStoredSettings();
              
              // Sign out
              await supabase.auth.signOut();
              // Navigation will be handled by auth state change
            } catch (error) {
              console.error('Error during logout:', error);
              // Clear settings and sign out anyway even if status update fails
              try {
                await clearStoredSettings();
              } catch (clearError) {
                console.error('Error clearing settings during logout:', clearError);
              }
              await supabase.auth.signOut();
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'This will permanently delete your account and all associated data. Type DELETE to confirm.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setLoading(true);
                      const { data: { user } } = await supabase.auth.getUser();
                      
                      if (!user) {
                        Alert.alert('Error', 'User not found');
                        return;
                      }

                      // Call the delete account function
                      const { error: deleteError } = await supabase.functions.invoke('delete-account', {
                        body: { userId: user.id }
                      });

                      if (deleteError) {
                        console.error('Error deleting account:', deleteError);
                        Alert.alert(
                          'Account Deletion',
                          'We were unable to automatically delete your account. Please contact support at support@lovemapapp.com to complete your account deletion request.',
                          [
                            { 
                              text: 'Email Support', 
                              onPress: () => {
                                const email = 'support@lovemapapp.com';
                                const subject = 'Account Deletion Request';
                                const body = `Please delete my account (User ID: ${user.id})`;
                                const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                Linking.openURL(url);
                              }
                            },
                            { text: 'OK' }
                          ]
                        );
                        return;
                      }

                      // Clear local data
                      await clearStoredSettings();
                      
                      // Sign out
                      await supabase.auth.signOut();
                      
                      Alert.alert(
                        'Account Deleted',
                        'Your account has been successfully deleted. We hope to see you again in the future!'
                      );
                    } catch (error) {
                      console.error('Error deleting account:', error);
                      Alert.alert(
                        'Error',
                        'Failed to delete account. Please contact support at support@lovemapapp.com for assistance.'
                      );
                    } finally {
                      setLoading(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const SettingItem = ({ icon, title, subtitle, value, onValueChange, type = 'switch' }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={24} color={theme.colors.primary} />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {type === 'switch' ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
          thumbColor="#FFFFFF"
        />
      ) : (
        <TouchableOpacity onPress={onValueChange}>
          <Ionicons name="chevron-forward" size={24} color={theme.colors.gray[400]} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={commonStyles.title}>Settings</Text>
        </View>

        {/* My Profile */}
        <TouchableOpacity
          style={styles.profileNavItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.profileNavLeft}>
            <View style={styles.profileNavIcon}>
              <Ionicons name="person" size={24} color="#FF4A6E" />
            </View>
            <View>
              <Text style={styles.profileNavTitle}>My Profile</Text>
              <Text style={styles.profileNavSubtitle}>View and edit your profile</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color={theme.colors.gray[400]} />
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Map Settings</Text>
          <SettingItem
            icon={isLocationEnabled ? "location" : "location-outline"}
            title="Location Tracking"
            subtitle={isLocationEnabled ? "Your location is being shared" : "Your location is hidden"}
            value={isLocationEnabled}
            onValueChange={async (value) => {
              try {
                setLoading(true);
                await updateLocationEnabled(value);
                
                // Show feedback message
                if (value) {
                  Alert.alert('Location Enabled', 'You can now see and be seen by others on the map');
                } else {
                  Alert.alert('Location Disabled', 'You are now hidden and cannot see others on the map');
                }
              } catch (error) {
                console.error('Error updating location:', error);
                Alert.alert('Error', 'Failed to update location setting. Please try again.');
              } finally {
                setLoading(false);
              }
            }}
          />
          <SettingItem
            icon={isVisible ? "eye" : "eye-off"}
            title="Visibility"
            subtitle={isVisible ? "You are visible to other users" : "You are hidden from other users"}
            value={isVisible}
            onValueChange={async (value) => {
              try {
                // If trying to go invisible, check subscription
                if (!value && !isInvisibleMode) {
                  Alert.alert(
                    'Premium Feature',
                    'Invisible mode is a premium feature. Upgrade to Premium or purchase invisible mode to hide your location.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'View Plans', onPress: () => navigation.navigate('Subscription') },
                    ]
                  );
                  return;
                }
                
                setLoading(true);
                await updateVisibility(value);
                
                // Show feedback message
                if (value) {
                  Alert.alert('Visibility Enabled', 'You are now visible to others on the map');
                } else {
                  Alert.alert('Visibility Disabled', 'You are hidden but can still see others on the map');
                }
              } catch (error) {
                console.error('Error updating visibility:', error);
                Alert.alert('Error', 'Failed to update visibility setting. Please try again.');
              } finally {
                setLoading(false);
              }
            }}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          <SettingItem
            icon={keepScreenOn ? "sunny" : "sunny-outline"}
            title="Keep Screen On"
            subtitle={keepScreenOn ? "Screen stays on while app is active" : "Screen follows system timeout"}
            value={keepScreenOn}
            onValueChange={async (value) => {
              try {
                setLoading(true);
                await updateKeepScreenOn(value);
                Alert.alert(
                  value ? 'Screen Keep-Awake Enabled' : 'Screen Keep-Awake Disabled',
                  value ? 'Your screen will stay on while using the app' : 'Your screen will follow system timeout settings'
                );
              } catch (error) {
                console.error('Error updating keep screen on setting:', error);
                Alert.alert('Error', 'Failed to update keep screen on setting. Please try again.');
              } finally {
                setLoading(false);
              }
            }}
          />
          <SettingItem
            icon={smartNotificationsEnabled ? "notifications" : "notifications-outline"}
            title="Smart Notifications"
            subtitle={smartNotificationsEnabled ? "Get reminders to check the app" : "No engagement reminders"}
            value={smartNotificationsEnabled}
            onValueChange={async (value) => {
              try {
                setLoading(true);
                await engagementNotificationService.updateSettings({ enabled: value });
                setSmartNotificationsEnabled(value);
                Alert.alert(
                  value ? 'Smart Notifications Enabled' : 'Smart Notifications Disabled',
                  value ? 'You will receive occasional reminders to check the app' : 'You will not receive engagement reminders'
                );
              } catch (error) {
                console.error('Error updating smart notifications:', error);
                Alert.alert('Error', 'Failed to update smart notifications. Please try again.');
              } finally {
                setLoading(false);
              }
            }}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Preferences</Text>
          <TouchableOpacity 
            style={styles.preferenceItem}
            onPress={() => setShowFilters(true)}
          >
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>Prefer to connect with</Text>
              <Text style={styles.preferenceValue}>{genderPreference}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.gray[400]} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.preferenceItem}
            onPress={() => setShowFilters(true)}
          >
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>Age Range</Text>
              <Text style={styles.preferenceValue}>{minAge} - {maxAge}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.gray[400]} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.preferenceItem}
            onPress={() => setShowFilters(true)}
          >
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceTitle}>Maximum Distance</Text>
              <Text style={styles.preferenceValue}>{maxDistance} km</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.gray[400]} />
          </TouchableOpacity>
        </View>

        {/* Community Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community</Text>
          <TouchableOpacity
            style={styles.accountItem}
            onPress={() => navigation.navigate('SkillMatching')}
          >
            <View style={styles.accountItemLeft}>
              <Ionicons name="school-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.accountItemText}>Skill Exchange</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.gray[400]} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.accountItem}
            onPress={() => navigation.navigate('Subscription')}
          >
            <View style={styles.accountItemLeft}>
              <Ionicons name="card" size={24} color={theme.colors.primary} />
              <Text style={styles.accountItemText}>Manage Subscription</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.gray[400]} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.accountItem}
            onPress={handleDeleteAccount}
          >
            <View style={styles.accountItemLeft}>
              <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
              <Text style={[styles.accountItemText, { color: theme.colors.error }]}>Delete Account</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.gray[400]} />
          </TouchableOpacity>

          {/* Terms of Use */}
          <TouchableOpacity 
            style={styles.accountItem}
            onPress={() => {
              const url = 'https://www.lovemap.biz/terms';
              Linking.canOpenURL(url).then(supported => {
                if (supported) {
                  Linking.openURL(url);
                } else {
                  Alert.alert('Unable to open link', 'Please visit our website: https://www.lovemap.biz/terms');
                }
              }).catch(err => {
                console.error('Error opening Terms URL', err);
                Alert.alert('Error', 'Unable to open Terms link at this time');
              });
            }}
          >
            <View style={styles.accountItemLeft}>
              <Ionicons name="document-text-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.accountItemText}>Terms of Use</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.gray[400]} />
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity 
            style={styles.accountItem}
            onPress={() => {
              const url = 'https://www.lovemap.biz/privacy';
              Linking.canOpenURL(url).then(supported => {
                if (supported) {
                  Linking.openURL(url);
                } else {
                  Alert.alert('Unable to open link', 'Please visit our website: https://www.lovemap.biz/privacy');
                }
              }).catch(err => {
                console.error('Error opening Privacy URL', err);
                Alert.alert('Error', 'Unable to open Privacy link at this time');
              });
            }}
          >
            <View style={styles.accountItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.accountItemText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={theme.colors.gray[400]} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>LoveMap v1.0</Text>
        </View>
      </ScrollView>
      
      {showFilters && (
        <MapFilters
          visible={showFilters}
          onClose={() => setShowFilters(false)}
          filters={{
            genderPreference,
            maxDistance,
            minAge,
            maxAge,
          }}
          onFiltersChange={async (newFilters) => {
            try {
              setLoading(true);
              await updateFilters(newFilters);
              setShowFilters(false);
            } catch (error) {
              console.error('Error updating filters:', error);
              Alert.alert('Error', 'Failed to update filters. Please try again.');
            } finally {
              setLoading(false);
            }
          }}
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
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  section: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: '500',
    color: theme.colors.text,
  },
  settingSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  preferenceInfo: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: '500',
    color: theme.colors.text,
  },
  preferenceValue: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    marginTop: 2,
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  accountItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountItemText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  logoutButton: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
  },
  versionInfo: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  versionText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  profileNavItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  profileNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileNavIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF4A6E' + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  profileNavTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
  },
  profileNavSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});

export default SettingsScreen;
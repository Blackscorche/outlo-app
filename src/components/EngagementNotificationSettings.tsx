import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import engagementNotificationService from '../services/engagementNotificationService';
import { theme } from '../styles/theme';

export default function EngagementNotificationSettings() {
  const [settings, setSettings] = useState({
    enabled: true,
    minInterval: 3,
    maxInterval: 12,
    quietHoursStart: 22,
    quietHoursEnd: 9,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentSettings = await engagementNotificationService.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    try {
      await engagementNotificationService.updateSettings({ [key]: value });
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const sendTestNotification = async () => {
    try {
      await engagementNotificationService.sendTestNotification();
      Alert.alert('Success', 'Test notification sent! Check your notifications.');
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="notifications-outline" size={24} color={theme.colors.primary} />
        <Text style={styles.title}>Smart Notifications</Text>
      </View>

      <Text style={styles.description}>
        Get reminded to check the app when you might be missing connections
      </Text>

      <View style={styles.setting}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Enable Smart Notifications</Text>
          <Switch
            value={settings.enabled}
            onValueChange={(value) => handleSettingChange('enabled', value)}
            trackColor={{ false: '#767577', true: theme.colors.primary + '40' }}
            thumbColor={settings.enabled ? theme.colors.primary : '#f4f3f4'}
          />
        </View>
      </View>

      {settings.enabled && (
        <>
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>
              Minimum Interval: {settings.minInterval} hours
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={24}
              step={1}
              value={settings.minInterval}
              onSlidingComplete={(value) => handleSettingChange('minInterval', value)}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor="#000000"
            />
            <Text style={styles.helperText}>
              Minimum time between notifications
            </Text>
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>
              Maximum Interval: {settings.maxInterval} hours
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={48}
              step={1}
              value={settings.maxInterval}
              onSlidingComplete={(value) => handleSettingChange('maxInterval', value)}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor="#000000"
            />
            <Text style={styles.helperText}>
              Maximum time between notifications
            </Text>
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>
              Quiet Hours Start: {settings.quietHoursStart}:00
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={23}
              step={1}
              value={settings.quietHoursStart}
              onSlidingComplete={(value) => handleSettingChange('quietHoursStart', value)}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor="#000000"
            />
          </View>

          <View style={styles.setting}>
            <Text style={styles.settingLabel}>
              Quiet Hours End: {settings.quietHoursEnd}:00
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={23}
              step={1}
              value={settings.quietHoursEnd}
              onSlidingComplete={(value) => handleSettingChange('quietHoursEnd', value)}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor="#000000"
            />
            <Text style={styles.helperText}>
              No notifications during quiet hours
            </Text>
          </View>

          <TouchableOpacity style={styles.testButton} onPress={sendTestNotification}>
            <Ionicons name="send" size={20} color="white" />
            <Text style={styles.testButtonText}>Send Test Notification</Text>
          </TouchableOpacity>
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  description: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
  },
  setting: {
    marginBottom: theme.spacing.xl,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    fontWeight: '500',
    marginBottom: theme.spacing.sm,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  helperText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  testButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
  },
  testButtonText: {
    color: 'white',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    marginLeft: theme.spacing.sm,
  },
});
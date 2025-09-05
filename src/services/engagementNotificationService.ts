import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../integrations/supabase/client';

const LAST_NOTIFICATION_KEY = 'last_engagement_notification';
const NOTIFICATION_SETTINGS_KEY = 'engagement_notification_settings';

interface NotificationSettings {
  enabled: boolean;
  minInterval: number; // in hours
  maxInterval: number; // in hours
  quietHoursStart: number; // hour of day (0-23)
  quietHoursEnd: number; // hour of day (0-23)
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  minInterval: 3, // Minimum 3 hours between notifications
  maxInterval: 12, // Maximum 12 hours between notifications
  quietHoursStart: 22, // 10 PM
  quietHoursEnd: 9, // 9 AM
};

const INITIAL_DELAY_MINUTES = 10; // Start notifications 10 minutes after app closes

class EngagementNotificationService {
  private appStateSubscription: any;
  private lastActiveTime: Date | null = null;
  private isAppActive: boolean = true;
  private notificationTimer: NodeJS.Timeout | null = null;

  // Pool of engagement messages
  private readonly engagementMessages = [
    // Activity prompts
    { title: '💕 New Activity', body: 'Someone new just joined near your area!' },
    { title: '🗺️ Check the Map', body: 'Several people are active nearby right now' },
    { title: '💬 Stay Connected', body: "Don't miss potential connections in your area" },
    { title: '✨ Perfect Match?', body: 'New profiles matching your preferences are available' },
    { title: '🔥 Hot Spot Alert', body: 'Your area is buzzing with activity!' },
    
    // Connection prompts
    { title: '💝 Love is Near', body: 'Someone special might be waiting for you' },
    { title: '🌟 Discover Now', body: 'Explore who is around you today' },
    { title: '💫 Magic Moment', body: 'The perfect time to find your match' },
    { title: '🎯 Your Turn', body: 'Take the first step and connect with someone' },
    { title: '💘 Cupid Calling', body: "Don't let love pass you by" },
    
    // Time-based prompts
    { title: '☀️ Good Morning!', body: 'Start your day by checking who is nearby' },
    { title: '🌅 Evening Connections', body: 'Perfect time to meet someone new' },
    { title: '🌙 Night Owls Unite', body: 'Other night owls are active now' },
    { title: '☕ Coffee Break?', body: 'Someone nearby might want to chat' },
    { title: '🍽️ Lunch Hour Love', body: 'Connect with people on their break' },
    
    // Curiosity prompts
    { title: '👀 Curious?', body: 'See who viewed your profile recently' },
    { title: '🎲 Feeling Lucky?', body: 'Your next great connection is one tap away' },
    { title: '💭 Wonder Who?', body: 'Someone interesting is nearby' },
    { title: '🔮 Destiny Awaits', body: 'Open the app to see what fate has in store' },
    { title: '🎪 Something Special', body: 'A surprise awaits you in the app' },
    
    // FOMO (Fear of Missing Out) prompts
    { title: '⏰ Limited Time', body: "Active users online now - don't miss out!" },
    { title: '🚨 Alert', body: 'Unusual activity in your area - check it out!' },
    { title: '📍 Right Now', body: 'Multiple people are looking for connections' },
    { title: '⚡ Quick!', body: 'Someone just expressed interest nearby' },
    { title: '🎉 Happening Now', body: 'Join the conversation while it\'s hot' },
  ];

  async initialize() {
    // Load settings
    const settings = await this.getSettings();
    if (!settings.enabled) {
      console.log('Engagement notifications are disabled');
      return;
    }

    // Set up app state listener
    this.setupAppStateListener();
    
    // Don't schedule anything initially - wait for app to go to background
    console.log('Smart notifications initialized - will start 10 minutes after app is closed');

    // Register background task (placeholder)
    await this.registerBackgroundTask();
  }

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasActive = this.isAppActive;
      this.isAppActive = nextAppState === 'active';

      if (wasActive && !this.isAppActive) {
        // App went to background
        this.lastActiveTime = new Date();
        this.startInactivityTimer();
      } else if (!wasActive && this.isAppActive) {
        // App came to foreground
        this.stopInactivityTimer();
        this.lastActiveTime = null;
      }
    });
  }

  private startInactivityTimer() {
    this.stopInactivityTimer();

    // First notification starts after 10 minutes
    const initialDelay = INITIAL_DELAY_MINUTES * 60 * 1000; // 10 minutes in milliseconds
    
    this.notificationTimer = setTimeout(async () => {
      // After the initial 10-minute delay, send first notification
      await this.sendEngagementNotification();
      
      // Then schedule subsequent notifications at random intervals
      this.scheduleSubsequentNotifications();
    }, initialDelay);
  }
  
  private scheduleSubsequentNotifications() {
    // For subsequent notifications, use random intervals
    const randomDelay = this.getRandomInterval();
    
    this.notificationTimer = setTimeout(async () => {
      await this.sendEngagementNotification();
    }, randomDelay);
  }

  private stopInactivityTimer() {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }
  }

  private getRandomInterval(): number {
    const settings = this.getSettingsSync();
    const minMs = settings.minInterval * 60 * 60 * 1000;
    const maxMs = settings.maxInterval * 60 * 60 * 1000;
    return Math.random() * (maxMs - minMs) + minMs;
  }

  private async sendEngagementNotification() {
    // Check if we're in quiet hours
    if (await this.isInQuietHours()) {
      // Reschedule for after quiet hours
      await this.scheduleAfterQuietHours();
      return;
    }

    // Check last notification time
    const lastNotificationTime = await this.getLastNotificationTime();
    const settings = await this.getSettings();
    const minInterval = settings.minInterval * 60 * 60 * 1000;

    if (lastNotificationTime) {
      const timeSinceLastNotification = Date.now() - lastNotificationTime.getTime();
      if (timeSinceLastNotification < minInterval) {
        // Too soon, reschedule
        const delay = minInterval - timeSinceLastNotification;
        setTimeout(() => this.sendEngagementNotification(), delay);
        return;
      }
    }

    // Get random message
    const message = this.getRandomMessage();

    // Check if user has any actual nearby users for context
    const nearbyCount = await this.getNearbyUserCount();
    
    // Customize message based on actual data
    let customizedMessage = { ...message };
    if (nearbyCount > 0) {
      // Add actual count to some messages
      if (message.body.includes('Several')) {
        customizedMessage.body = message.body.replace('Several', `${nearbyCount}`);
      }
    }

    // Send notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: customizedMessage.title,
        body: customizedMessage.body,
        data: { 
          type: 'engagement',
          timestamp: Date.now()
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Immediate
    });

    // Update last notification time
    await this.setLastNotificationTime(new Date());

    // Schedule next notification
    await this.scheduleNextNotification();
  }

  private getRandomMessage() {
    const hour = new Date().getHours();
    
    // Filter messages based on time of day
    let appropriateMessages = [...this.engagementMessages];
    
    if (hour >= 5 && hour < 12) {
      // Morning - prioritize morning messages
      appropriateMessages = appropriateMessages.filter(msg => 
        msg.title.includes('Morning') || 
        msg.title.includes('☀️') ||
        !msg.title.includes('Evening') && 
        !msg.title.includes('Night')
      );
    } else if (hour >= 17 && hour < 22) {
      // Evening - prioritize evening messages
      appropriateMessages = appropriateMessages.filter(msg => 
        msg.title.includes('Evening') || 
        msg.title.includes('🌅') ||
        !msg.title.includes('Morning')
      );
    } else if (hour >= 22 || hour < 5) {
      // Night - prioritize night messages
      appropriateMessages = appropriateMessages.filter(msg => 
        msg.title.includes('Night') || 
        msg.title.includes('🌙') ||
        !msg.title.includes('Morning') && 
        !msg.title.includes('Lunch')
      );
    }

    // If we filtered out all messages, use the full list
    if (appropriateMessages.length === 0) {
      appropriateMessages = this.engagementMessages;
    }

    return appropriateMessages[Math.floor(Math.random() * appropriateMessages.length)];
  }

  private async getNearbyUserCount(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .neq('id', user.id)
        .not('current_latitude', 'is', null)
        .not('current_longitude', 'is', null)
        .gte('last_seen', new Date(Date.now() - 15 * 60 * 1000).toISOString());

      return count || 0;
    } catch (error) {
      console.error('Error getting nearby user count:', error);
      return 0;
    }
  }

  private async isInQuietHours(): Promise<boolean> {
    const settings = await this.getSettings();
    const now = new Date();
    const currentHour = now.getHours();

    if (settings.quietHoursStart > settings.quietHoursEnd) {
      // Quiet hours span midnight
      return currentHour >= settings.quietHoursStart || currentHour < settings.quietHoursEnd;
    } else {
      // Quiet hours within same day
      return currentHour >= settings.quietHoursStart && currentHour < settings.quietHoursEnd;
    }
  }

  private async scheduleAfterQuietHours() {
    const settings = await this.getSettings();
    const now = new Date();
    const currentHour = now.getHours();
    
    let hoursUntilEnd: number;
    if (currentHour < settings.quietHoursEnd) {
      hoursUntilEnd = settings.quietHoursEnd - currentHour;
    } else {
      hoursUntilEnd = (24 - currentHour) + settings.quietHoursEnd;
    }

    const msUntilEnd = hoursUntilEnd * 60 * 60 * 1000;
    
    setTimeout(() => this.sendEngagementNotification(), msUntilEnd);
  }

  async scheduleNextNotification() {
    // Use the subsequent notification scheduling with random intervals
    this.scheduleSubsequentNotifications();
  }

  private async registerBackgroundTask() {
    // Background tasks removed due to compatibility issues
    // The service will rely on app state changes and timers instead
    console.log('Background task registration skipped - using app state monitoring');
  }

  // Settings management
  async getSettings(): Promise<NotificationSettings> {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  private getSettingsSync(): NotificationSettings {
    // For synchronous operations, use default settings
    // In production, you might want to cache settings in memory
    return DEFAULT_SETTINGS;
  }

  async updateSettings(settings: Partial<NotificationSettings>) {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updated));
    
    // Restart notification scheduling if enabled state changed
    if (settings.enabled !== undefined) {
      if (settings.enabled) {
        await this.scheduleNextNotification();
      } else {
        this.stopInactivityTimer();
      }
    }
  }

  private async getLastNotificationTime(): Promise<Date | null> {
    try {
      const stored = await AsyncStorage.getItem(LAST_NOTIFICATION_KEY);
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  }

  private async setLastNotificationTime(time: Date) {
    await AsyncStorage.setItem(LAST_NOTIFICATION_KEY, time.toISOString());
  }

  // Test notification (for debugging)
  async sendTestNotification() {
    const message = this.getRandomMessage();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        data: { type: 'engagement_test' },
        sound: true,
      },
      trigger: null,
    });
  }

  cleanup() {
    this.stopInactivityTimer();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }
}

export default new EngagementNotificationService();
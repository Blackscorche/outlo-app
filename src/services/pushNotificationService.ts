import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../integrations/supabase/client';
import { createNavigationContainerRef } from '@react-navigation/native';

// Create navigation reference for use outside of React components
export const navigationRef = createNavigationContainerRef();

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class PushNotificationService {
  private notificationListener: any;
  private responseListener: any;

  async initialize() {
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    // Get push token
    const token = await this.getExpoPushToken();
    if (token) {
      await this.savePushToken(token);
    }

    // Set up notification listeners
    this.setupNotificationListeners();
  }

  async getExpoPushToken() {
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        console.log('Project ID not found');
        return null;
      }
      
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      
      return pushTokenString;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  async savePushToken(token: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save token to user profile
      await supabase
        .from('profiles')
        .update({ 
          push_token: token,
          push_token_updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  setupNotificationListeners() {
    // Handle notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Handle notification taps
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      if (data?.type === 'message') {
        // Navigate to chat room
        if (data.roomId && data.otherUserId && navigationRef.isReady()) {
          navigationRef.navigate('AuthenticatedApp' as never, {
            screen: 'ChatRoom',
            params: {
              roomId: data.roomId,
              otherUserId: data.otherUserId,
              otherUserName: data.senderName || 'User',
            }
          } as never);
        }
      } else if (data?.type === 'connection_request') {
        // Navigate to connections tab to see connection requests
        if (navigationRef.isReady()) {
          navigationRef.navigate('AuthenticatedApp' as never, {
            screen: 'Main',
            params: {
              screen: 'Connections'
            }
          } as never);
        }
      } else if (data?.type === 'connection_accepted') {
        // Navigate to connections tab
        if (navigationRef.isReady()) {
          navigationRef.navigate('AuthenticatedApp' as never, {
            screen: 'Main',
            params: {
              screen: 'Connections'
            }
          } as never);
        }
      } else if (data?.type === 'nearby_users') {
        // Navigate to home/map screen
        if (navigationRef.isReady()) {
          navigationRef.navigate('AuthenticatedApp' as never, {
            screen: 'Main',
            params: {
              screen: 'Home'
            }
          } as never);
        }
      } else if (data?.type === 'engagement') {
        // Navigate to home screen for engagement notifications
        if (navigationRef.isReady()) {
          navigationRef.navigate('AuthenticatedApp' as never, {
            screen: 'Main',
            params: {
              screen: 'Home'
            }
          } as never);
        }
      }
    });
  }

  // Schedule nearby users notification
  async scheduleNearbyUsersNotification(nearbyCount: number) {
    const messages = [
      `${nearbyCount} people are available near you. Check it out!`,
      `Your love may be near you. Check it out!`,
      `${nearbyCount} potential matches are nearby. Don't miss out!`,
      `Someone special might be close by. Open the map to see!`,
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Outlo',
        body: randomMessage,
        data: { type: 'nearby_users', count: nearbyCount },
        sound: true,
      },
      trigger: {
        seconds: 60 * 30, // 30 minutes
      },
    });
  }

  // Send immediate notification
  async sendNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Immediate
    });
  }

  // Queue notification in database
  async queueNotification(userId: string, title: string, body: string, data?: any, scheduledFor?: Date) {
    try {
      await supabase
        .from('push_notification_queue')
        .insert({
          user_id: userId,
          title,
          body,
          data,
          scheduled_for: scheduledFor || new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error queuing notification:', error);
    }
  }

  // Process notification queue (should be run by a background job)
  async processNotificationQueue() {
    try {
      // Get pending notifications
      const { data: notifications } = await supabase
        .from('push_notification_queue')
        .select('*, profiles!user_id(push_token)')
        .is('sent_at', null)
        .lte('scheduled_for', new Date().toISOString())
        .limit(100);

      if (!notifications || notifications.length === 0) return;

      for (const notification of notifications) {
        if (!notification.profiles?.push_token) continue;

        try {
          // Send via Expo push notification service
          const message = {
            to: notification.profiles.push_token,
            sound: 'default',
            title: notification.title,
            body: notification.body,
            data: notification.data,
          };

          const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
          });

          if (response.ok) {
            // Mark as sent
            await supabase
              .from('push_notification_queue')
              .update({ sent_at: new Date().toISOString() })
              .eq('id', notification.id);
          } else {
            throw new Error('Failed to send notification');
          }
        } catch (error) {
          // Mark as failed
          await supabase
            .from('push_notification_queue')
            .update({ 
              failed_at: new Date().toISOString(),
              error_message: error.message
            })
            .eq('id', notification.id);
        }
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    }
  }

  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

export default new PushNotificationService();
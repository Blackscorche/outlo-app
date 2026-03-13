import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../contexts/ToastContext';
import { useNavigation } from '@react-navigation/native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const useInAppNotifications = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { showToast } = useToast();
  const navigation = useNavigation();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Request notification permissions
    const requestPermissions = async () => {
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          return;
        }
        
      } else {
      }
      
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });
      }
    };

    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        await requestPermissions(); // Request permissions after user is set
      }
    };

    getCurrentUser();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;


    // Subscribe to new messages (messages table only)
    const messagesSubscription = supabase
      .channel(`user_messages_${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=neq.${currentUserId}` // Only messages not sent by current user
      }, async (payload) => {
        await handleNewMessage(payload.new);
      })
      .subscribe();

    // Subscribe to new connection requests
    const connectionRequestsSubscription = supabase
      .channel(`user_connection_requests_${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'connection_requests',
        filter: `receiver_id=eq.${currentUserId}`
      }, async (payload) => {
        await handleNewConnectionRequest(payload.new);
      })
      .subscribe();

    // Subscribe to connection request status changes (accepted)
    const connectionStatusSubscription = supabase
      .channel(`user_connection_status_${currentUserId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'connection_requests',
        filter: `sender_id=eq.${currentUserId}`
      }, async (payload) => {
        if (payload.new.status === 'accepted' && payload.old.status !== 'accepted') {
          await handleConnectionAccepted(payload.new);
        }
      })
      .subscribe();

    return () => {
      messagesSubscription.unsubscribe();
      connectionRequestsSubscription.unsubscribe();
      connectionStatusSubscription.unsubscribe();
    };
  }, [currentUserId]);

  const handleNewMessage = async (message: any) => {
    try {
      // Check if the message is in a chat room where current user is a participant
      const { data: chatRoom } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', message.chat_room_id)
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .single();

      if (!chatRoom) return; // Not a message for current user

      // Get sender's profile
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('name, photos')
        .eq('id', message.sender_id)
        .single();

      const senderName = senderProfile?.name || 'Someone';
      const senderPhoto = senderProfile?.photos?.[0];
      const messageContent = message.content || '';
      
      // Show in-app notification if app is in foreground
      if (appState.current === 'active') {
        showToast({
          type: 'message',
          title: `New message from ${senderName}`,
          message: messageContent.length > 80 ? `${messageContent.substring(0, 80)}...` : messageContent,
          senderName,
          senderPhoto,
          duration: 8000,
          onPress: () => {
            navigation.navigate('ChatRoom' as never, {
              roomId: message.chat_room_id,
              otherUserId: message.sender_id,
              otherUserName: senderName,
            } as never);
          },
        });
      } else {
        // Show system notification if app is in background
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `New message from ${senderName}`,
            body: messageContent.length > 80 ? `${messageContent.substring(0, 80)}...` : messageContent,
            data: { 
              type: 'message',
              roomId: message.chat_room_id,
              otherUserId: message.sender_id,
              senderName 
            },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // Immediate
        });
      }
    } catch (error) {
      console.error('Error handling new message notification:', error);
    }
  };

  const handleNewConnectionRequest = async (request: any) => {
    try {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('name, photos')
        .eq('id', request.sender_id)
        .single();

      const senderName = senderProfile?.name || 'Someone';
      const senderPhoto = senderProfile?.photos?.[0];

      // Show in-app notification if app is in foreground
      if (appState.current === 'active') {
        showToast({
          type: 'connection_request',
          title: 'New Partner Request',
          message: `${senderName} wants to connect with you`,
          senderName,
          senderPhoto,
          duration: 8000,
          onPress: () => {
            navigation.navigate('Connections' as never);
          },
        });
      } else {
        // Show system notification if app is in background
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'New Partner Request',
            body: `${senderName} wants to connect with you`,
            data: { 
              type: 'connection_request',
              senderId: request.sender_id,
              senderName 
            },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // Immediate
        });
      }
    } catch (error) {
      console.error('Error handling connection request notification:', error);
    }
  };

  const handleConnectionAccepted = async (request: any) => {
    try {
      const { data: receiverProfile } = await supabase
        .from('profiles')
        .select('name, photos')
        .eq('id', request.receiver_id)
        .single();

      const receiverName = receiverProfile?.name || 'Someone';
      const receiverPhoto = receiverProfile?.photos?.[0];

      // Show in-app notification if app is in foreground
      if (appState.current === 'active') {
        showToast({
          type: 'connection_accepted',
          title: 'Connection Accepted! 🎉',
          message: `${receiverName} accepted your partner request`,
          senderName: receiverName,
          senderPhoto: receiverPhoto,
          duration: 8000,
          onPress: () => {
            navigation.navigate('Connections' as never);
          },
        });
      } else {
        // Show system notification if app is in background
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Connection Accepted! 🎉',
            body: `${receiverName} accepted your partner request`,
            data: { 
              type: 'connection_accepted',
              receiverId: request.receiver_id,
              receiverName 
            },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // Immediate
        });
      }
    } catch (error) {
      console.error('Error handling connection accepted notification:', error);
    }
  };

  return {
    currentUserId,
  };
};
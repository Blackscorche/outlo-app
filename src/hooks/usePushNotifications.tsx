
import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const { isFriend } = useFriends();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const channelRef = useRef<any>(null);

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = () => {
      const supported = 'Notification' in window && 'serviceWorker' in navigator;
      setIsSupported(supported);
      if (supported) {
        setPermission(Notification.permission);
      }
    };
    
    checkSupport();
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.log('Push notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        // Register service worker for background notifications
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
          } catch (error) {
            console.error('Service Worker registration failed:', error);
          }
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((title: string, body: string, data?: any) => {
    if (permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    // Check if the page is visible
    const isPageVisible = !document.hidden;
    
    // Only show notification if page is not visible (app is in background)
    if (!isPageVisible) {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: data?.type || 'app-notification',
          requireInteraction: true,
          data: data
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          
          // Navigate to appropriate page based on notification type
          if (data?.type === 'message' && data?.senderId) {
            window.location.href = `/chat/${data.senderId}`;
          } else if (data?.type === 'connection_request') {
            // Focus on the app - user can check connection requests
            window.location.href = '/';
          } else if (data?.type === 'friend_message') {
            window.location.href = `/chat/${data.senderId}`;
          }
        };

        // Auto-close after 10 seconds
        setTimeout(() => {
          notification.close();
        }, 10000);

      } catch (error) {
        console.error('Error showing notification:', error);
      }
    }
  }, [permission]);

  // Listen for new messages and connection requests - stable subscription
  useEffect(() => {
    if (!user || permission !== 'granted') {
      // Clean up existing channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    console.log('Setting up push notification subscriptions for user:', user.id);

    const channel = supabase
      .channel('user_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `sender_id=neq.${user.id}`
        },
        async (payload) => {
          console.log('New message received for notification:', payload);
          
          // Get sender info for notification
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', payload.new.sender_id)
            .single();

          const senderName = senderProfile?.name || 'Someone';
          const message = payload.new.message;
          
          // Check if sender is a friend for different notification handling
          const messageType = isFriend(payload.new.sender_id) ? 'friend_message' : 'message';
          const notificationTitle = isFriend(payload.new.sender_id) 
            ? 'New Message from Friend' 
            : 'New Message';
          
          sendNotification(
            notificationTitle,
            `${senderName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
            { type: messageType, senderId: payload.new.sender_id }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connection_requests',
          filter: `receiver_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('New connection request for notification:', payload);
          
          // Get sender info for notification
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', payload.new.sender_id)
            .single();

          const senderName = senderProfile?.name || 'Someone';
          
          sendNotification(
            'New Partner Request',
            `${senderName} wants to connect with you!`,
            { type: 'connection_request', senderId: payload.new.sender_id }
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      console.log('Cleaning up push notification subscriptions');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, permission, sendNotification, isFriend]);

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification
  };
};

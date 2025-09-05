import React, { createContext, useContext, useState, useCallback } from 'react';
import { Alert, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import ToastNotification, { ToastNotificationData } from '../components/ToastNotification';

interface ToastContextType {
  showToast: (notification: Omit<ToastNotificationData, 'id'>) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [currentNotification, setCurrentNotification] = useState<ToastNotificationData | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<ToastNotificationData[]>([]);

  const playNotificationFeedback = useCallback(async (type: ToastNotificationData['type']) => {
    try {
      // Play sound based on notification type
      let soundFile;
      switch (type) {
        case 'message':
          soundFile = require('../../assets/sounds/message.mp3');
          Vibration.vibrate(100);
          break;
        case 'connection_request':
        case 'connection_accepted':
          soundFile = require('../../assets/sounds/notification.mp3');
          Vibration.vibrate([0, 100, 100, 100]);
          break;
        default:
          soundFile = require('../../assets/sounds/notification.mp3');
          Vibration.vibrate(100);
      }

      // Play sound
      const { sound } = await Audio.Sound.createAsync(soundFile);
      await sound.playAsync();
      
      // Unload sound after playing to free memory
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log('Error playing notification sound/vibration:', error);
      // Fallback to vibration only if sound fails
      try {
        switch (type) {
          case 'message':
            Vibration.vibrate(100);
            break;
          case 'connection_request':
          case 'connection_accepted':
            Vibration.vibrate([0, 100, 100, 100]);
            break;
          default:
            Vibration.vibrate(100);
        }
      } catch (vibrationError) {
        console.log('Error playing vibration fallback:', vibrationError);
      }
    }
  }, []);

  const showToast = useCallback((notification: Omit<ToastNotificationData, 'id'>) => {
    const newNotification: ToastNotificationData = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };

    if (currentNotification) {
      setNotificationQueue(prev => [...prev, newNotification]);
    } else {
      setCurrentNotification(newNotification);
      playNotificationFeedback(newNotification.type);
    }
  }, [currentNotification, playNotificationFeedback]);

  const hideToast = useCallback(() => {
    setCurrentNotification(null);
    
    setTimeout(() => {
      setNotificationQueue(prev => {
        if (prev.length > 0) {
          const [nextNotification, ...remaining] = prev;
          setCurrentNotification(nextNotification);
          playNotificationFeedback(nextNotification.type);
          return remaining;
        }
        return prev;
      });
    }, 100);
  }, [playNotificationFeedback]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {currentNotification && (
        <ToastNotification
          notification={currentNotification}
          visible={!!currentNotification}
          onDismiss={hideToast}
        />
      )}
    </ToastContext.Provider>
  );
};
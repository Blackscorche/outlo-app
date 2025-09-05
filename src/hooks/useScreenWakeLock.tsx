
import { useEffect, useRef } from 'react';

export const useScreenWakeLock = (shouldKeepAwake: boolean = true) => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = async () => {
    try {
      // Check if Wake Lock API is supported
      if ('wakeLock' in navigator) {
        // Release any existing wake lock first
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
        }
        
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('🔒 Screen wake lock activated');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('🔓 Screen wake lock released');
          wakeLockRef.current = null;
        });
      } else {
        console.log('⚠️ Wake Lock API not supported in this browser');
      }
    } catch (error) {
      console.error('❌ Failed to request wake lock:', error);
      // If wake lock fails, try again after a short delay
      setTimeout(() => {
        if (shouldKeepAwake && !wakeLockRef.current) {
          console.log('🔄 Retrying wake lock request...');
          requestWakeLock();
        }
      }, 2000);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('🔓 Screen wake lock manually released');
      } catch (error) {
        console.error('❌ Failed to release wake lock:', error);
      }
    }
  };

  useEffect(() => {
    if (shouldKeepAwake) {
      console.log('🔒 Requesting wake lock - shouldKeepAwake:', shouldKeepAwake);
      requestWakeLock();
    } else {
      console.log('🔓 Releasing wake lock - shouldKeepAwake:', shouldKeepAwake);
      releaseWakeLock();
    }

    // Handle visibility change - reacquire wake lock when app becomes visible
    const handleVisibilityChange = () => {
      console.log('👁️ Visibility changed:', document.visibilityState, 'shouldKeepAwake:', shouldKeepAwake);
      
      if (shouldKeepAwake && document.visibilityState === 'visible' && !wakeLockRef.current) {
        console.log('🔒 App became visible, reacquiring wake lock');
        requestWakeLock();
      }
    };

    // Handle user interaction to ensure wake lock is active
    const handleUserInteraction = () => {
      if (shouldKeepAwake && !wakeLockRef.current) {
        console.log('🔒 User interaction detected, ensuring wake lock is active');
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      releaseWakeLock();
    };
  }, [shouldKeepAwake]);

  // Periodic check to ensure wake lock stays active
  useEffect(() => {
    if (!shouldKeepAwake) return;

    const intervalId = setInterval(() => {
      if (shouldKeepAwake && !wakeLockRef.current && document.visibilityState === 'visible') {
        console.log('🔄 Periodic check: reacquiring wake lock');
        requestWakeLock();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [shouldKeepAwake]);

  return {
    isWakeLockActive: !!wakeLockRef.current,
    requestWakeLock,
    releaseWakeLock
  };
};

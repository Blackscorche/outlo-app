
import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { validateMessageContent } from '@/utils/inputValidation';
import { securityManager, enhancedRateLimit } from '@/utils/securityEnhancements';

export const useSecureChat = (roomId: string | null) => {
  const { user } = useAuth();
  const { sendMessage } = useChat();
  const [isBlocked, setIsBlocked] = useState(false);
  const [hasRoomAccess, setHasRoomAccess] = useState<boolean | null>(null);

  // Validate chat room access when roomId changes
  useEffect(() => {
    const validateAccess = async () => {
      if (!user || !roomId) {
        setHasRoomAccess(false);
        return;
      }

      const hasAccess = await securityManager.validateChatRoomAccess(roomId, user.id);
      setHasRoomAccess(hasAccess);
    };

    validateAccess();
  }, [user, roomId]);

  const secureSendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!user || !roomId) {
      console.error('🔒 Security: Attempted to send message without authentication or room');
      return false;
    }

    // Check room access first
    if (hasRoomAccess === false) {
      console.error('🔒 Security: User does not have access to this chat room');
      return false;
    }

    // Get user's IP for enhanced rate limiting (if available)
    const userIP = await getUserIP().catch(() => null);

    // Enhanced rate limiting with IP tracking
    if (!enhancedRateLimit.isAllowed(user.id, userIP || undefined)) {
      console.warn('🔒 Security: Enhanced rate limit exceeded');
      setIsBlocked(true);
      setTimeout(() => setIsBlocked(false), 60000); // Block for 1 minute
      return false;
    }

    // Input validation with enhanced sanitization
    const validation = validateMessageContent(content);
    if (!validation.isValid) {
      console.warn('🔒 Security: Invalid message content:', validation.error);
      return false;
    }

    // Additional security checks
    const suspiciousActivity = securityManager.detectSuspiciousActivity([
      {
        type: 'send_message',
        timestamp: new Date(),
        userId: user.id,
        metadata: { roomId, contentLength: content.length }
      }
    ]);

    if (suspiciousActivity.isSuspicious) {
      console.warn('🔒 Security: Suspicious activity detected:', suspiciousActivity.reason);
      return false;
    }

    try {
      const success = await sendMessage(roomId, content);
      
      if (success) {
        console.log('✅ Message sent successfully:', {
          userId: user.id,
          roomId,
          timestamp: new Date(),
          contentLength: content.length
        });
      }
      
      return success;
    } catch (error) {
      console.error('🔒 Security: Message send error:', error);
      return false;
    }
  }, [user, roomId, sendMessage, hasRoomAccess]);

  return {
    secureSendMessage,
    isBlocked,
    hasRoomAccess
  };
};

// Helper function to get user's IP address (optional)
async function getUserIP(): Promise<string | null> {
  try {
    // This is optional and may not work in all environments
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return null;
  }
}

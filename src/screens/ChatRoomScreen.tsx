import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../styles/theme';
import { supabase } from '../integrations/supabase/client';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import EmoticonPicker from '../components/EmoticonPicker';

interface Message {
  id: string;
  chat_room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  deleted?: boolean;
}

interface OtherUserProfile {
  id: string;
  name: string;
  photos?: string[];
  is_online?: boolean;
  last_seen?: string;
}

const ChatRoomScreen = ({ route, navigation }) => {
  const { roomId, otherUserId, otherUserName } = route.params;
  
  // Validate required parameters
  if (!otherUserId) {
    console.error('ChatRoomScreen: otherUserId is required');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invalid chat parameters</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserProfile, setOtherUserProfile] = useState<OtherUserProfile | null>(null);
  const [showEmoticonPicker, setShowEmoticonPicker] = useState(false);
  const [isBlockedByOtherUser, setIsBlockedByOtherUser] = useState(false);
  const [hasBlockedOtherUser, setHasBlockedOtherUser] = useState(false);
  const flatListRef = useRef(null);
  const { refreshChatBadgeCount } = useBadgeCounts();

  useEffect(() => {
    // Load other user's profile
    loadOtherUserProfile();
    
    // Get current user first, then load messages
    getCurrentUser().then((userId) => {
      if (userId) {
        loadMessages(); // This will also mark messages as read
      }
    });
    
    // Subscribe to new messages and updates
    const channelName = `room:${roomId}:${Date.now()}`;
    console.log('Subscribing to channel:', channelName);
    
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `chat_room_id=eq.${roomId}`
      }, (payload) => handleNewMessage({ ...payload, eventType: 'INSERT' }))
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'messages',
        filter: `chat_room_id=eq.${roomId}`
      }, (payload) => handleNewMessage({ ...payload, eventType: 'UPDATE' }))
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'messages',
        filter: `chat_room_id=eq.${roomId}`
      }, (payload) => handleNewMessage({ ...payload, eventType: 'DELETE' }))
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });
      
    // Poll for read status updates periodically (backup for realtime)
    const pollInterval = setInterval(async () => {
      if (currentUserId && otherUserId) {
        // Check for your sent messages that have been read
        const { data: myMessages } = await supabase
          .from('messages')
          .select('id, is_read')
          .eq('chat_room_id', roomId)
          .eq('sender_id', currentUserId);
          
        if (myMessages && myMessages.length > 0) {
          let hasChanges = false;
          setMessages(prev => prev.map(msg => {
            if (msg.sender_id === currentUserId) {
              const updated = myMessages.find(u => u.id === msg.id);
              if (updated && updated.is_read !== msg.is_read) {
                hasChanges = true;
                return { ...msg, is_read: updated.is_read };
              }
            }
            return msg;
          }));
          
          if (hasChanges) {
            console.log('Read status updated for sent messages');
          }
        }
      }
    }, 5000); // Check every 5 seconds

    return () => {
      subscription.unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
      // Mark messages as read when leaving the chat
      markMessagesAsRead();
    };
  }, [roomId, otherUserId, currentUserId]);

  // Hide default navigation header
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Subscribe to profile updates for online status
  useEffect(() => {
    if (!otherUserId) return;

    const profileSubscription = supabase
      .channel(`profile_${otherUserId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${otherUserId}`
      }, (payload) => {
        console.log('Other user profile updated:', payload.new);
        setOtherUserProfile(prev => ({
          ...prev,
          ...payload.new,
        }));
      })
      .subscribe();

    return () => {
      profileSubscription.unsubscribe();
    };
  }, [otherUserId]);

  // Mark messages as read when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (currentUserId && otherUserId && roomId) {
        console.log('Chat screen focused, marking messages as read');
        markMessagesAsRead();
      }
      
      // Refresh badge count when leaving the screen
      return () => {
        console.log('Leaving chat screen, refreshing badge count');
        refreshChatBadgeCount();
      };
    }, [currentUserId, otherUserId, roomId, refreshChatBadgeCount])
  );

  const getCurrentUser = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      setCurrentUserId(authData.user.id);
      return authData.user.id;
    }
    return null;
  };

  const loadOtherUserProfile = async () => {
    try {
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      // Check if current user is blocked by the other user
      const { data: blockedMe } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', otherUserId)
        .eq('blocked_id', currentUser.id);
      
      // Set the blocked state
      if (blockedMe && blockedMe.length > 0) {
        setIsBlockedByOtherUser(true);
      }

      // Check if current user has blocked the other user
      const { data: blockedByMe } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', otherUserId);
      
      // Set the blocker state
      if (blockedByMe && blockedByMe.length > 0) {
        setHasBlockedOtherUser(true);
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name, photos, is_online, last_seen')
        .eq('id', otherUserId)
        .single();

      if (error) throw error;

      if (profile) {
        setOtherUserProfile(profile);
      }
    } catch (error) {
      console.error('Error loading other user profile:', error);
    }
  };

  const isUserOnline = (profile: OtherUserProfile) => {
    if (!profile.is_online) return false;
    
    // Check if last_seen is within 15 minutes
    if (profile.last_seen) {
      const lastSeen = new Date(profile.last_seen);
      const now = new Date();
      const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
      return diffInMinutes <= 15;
    }
    
    return profile.is_online;
  };

  const getLastSeenText = (lastSeen?: string) => {
    if (!lastSeen) return 'Offline';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m ago`;
    
    const diffInHours = diffInMinutes / 60;
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    
    const diffInDays = diffInHours / 24;
    if (diffInDays < 7) return `${Math.floor(diffInDays)}d ago`;
    
    return date.toLocaleDateString();
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Filter out deleted messages
      const activeMessages = (data || []).filter(msg => !msg.deleted);
      setMessages(activeMessages);
      
      // After loading messages, mark unread ones as read
      if (data && data.length > 0) {
        setTimeout(() => {
          markMessagesAsRead();
        }, 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      
      console.log('Marking messages as read for room:', roomId, 'from user:', otherUserId);
      
      // Get all unread messages from the other user
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_room_id', roomId)
        .eq('sender_id', otherUserId)
        .eq('is_read', false);
        
      if (fetchError) {
        console.error('Error fetching unread messages:', fetchError);
        return;
      }
        
      if (unreadMessages && unreadMessages.length > 0) {
        console.log('Found', unreadMessages.length, 'unread messages to mark as read');
        
        // Try to update all messages at once first
        const { data: updatedMessages, error: updateError } = await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('chat_room_id', roomId)
          .eq('sender_id', otherUserId)
          .eq('is_read', false)
          .select();
          
        if (updateError) {
          console.error('Bulk update failed:', updateError);
          
          // If bulk update fails, try individual updates
          console.log('Trying individual updates...');
          for (const message of unreadMessages) {
            const { error: individualError } = await supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', message.id);
              
            if (individualError) {
              console.error('Error updating message', message.id, ':', individualError);
            } else {
              console.log('Successfully updated message', message.id);
            }
          }
        } else {
          console.log('Bulk update successful, updated', updatedMessages?.length || 0, 'messages');
        }
        
        // Update local state for all messages
        const unreadIds = unreadMessages.map(m => m.id);
        setMessages(prev => prev.map(msg => 
          unreadIds.includes(msg.id) ? { ...msg, is_read: true } : msg
        ));
        
        console.log('Local state updated for', unreadMessages.length, 'messages');
        
        // Immediately refresh badge count after marking messages as read
        await refreshChatBadgeCount();
        
        // Verify the update by checking the database
        setTimeout(async () => {
          const { data: verifyMessages } = await supabase
            .from('messages')
            .select('id, is_read')
            .in('id', unreadIds);
            
          const stillUnread = verifyMessages?.filter(m => !m.is_read) || [];
          if (stillUnread.length > 0) {
            console.warn('Warning:', stillUnread.length, 'messages still unread after update');
          } else {
            console.log('Verification: All messages successfully marked as read');
          }
        }, 1000);
      } else {
        console.log('No unread messages found');
      }
    } catch (error) {
      console.error('Error in markMessagesAsRead:', error);
    }
  };

  const handleNewMessage = async (payload: any) => {
    console.log('Received real-time event:', payload.eventType, payload);
    
    if (payload.eventType === 'DELETE') {
      // Handle deleted message
      const deletedMessage = payload.old;
      console.log('Message deleted:', deletedMessage);
      setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id));
      return;
    }
    
    const newMessage = payload.new as Message;
    
    if (payload.eventType === 'UPDATE') {
      // Check if message was deleted
      if (newMessage.deleted) {
        // Remove deleted message from view
        setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
      } else {
        // Update message (read status, etc)
        setMessages(prev => prev.map(msg => 
          msg.id === newMessage.id ? newMessage : msg
        ));
      }
    } else if (payload.eventType === 'INSERT') {
      // Don't add if it's our own message (already added optimistically)
      if (newMessage.sender_id !== currentUserId) {
        // Add the new message to the chat
        setMessages(prev => [...prev, newMessage]);
        
        // Mark as read immediately since we're viewing the chat
        console.log('Marking new message as read:', newMessage.id);
        const { error } = await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('id', newMessage.id);
          
        if (error) {
          console.error('Error marking new message as read:', error);
        } else {
          // Update local state immediately
          setMessages(prev => prev.map(msg => 
            msg.id === newMessage.id ? { ...msg, is_read: true } : msg
          ));
          // Immediately refresh badge count
          await refreshChatBadgeCount();
        }
      }
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUserId || sending) return;

    const messageContent = inputText.trim();
    console.log('Sending message content:', messageContent);

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      chat_room_id: roomId,
      sender_id: currentUserId,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    // Add message to UI immediately
    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    setSending(true);

    try {
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert({
          chat_room_id: roomId,
          sender_id: currentUserId,
          content: messageContent,
          created_at: tempMessage.created_at,
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace temp message with real one
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id ? newMessage : msg
      ));

      // Update chat room's last message
      await supabase
        .from('chat_rooms')
        .update({ 
          updated_at: new Date().toISOString(),
          last_message: messageContent,
        })
        .eq('id', roomId);

    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      Alert.alert('Error', 'Failed to send message');
      setInputText(messageContent); // Restore input
    } finally {
      setSending(false);
    }
  };

  const handleEmoticonSelect = (emoticon: string) => {
    console.log('Selected emoticon:', emoticon);
    setInputText(prevText => {
      const newText = prevText + emoticon;
      console.log('New input text:', newText);
      return newText;
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      console.log('Deleting message:', messageId);
      
      // Soft delete - update the message with deleted flag
      const { error } = await supabase
        .from('messages')
        .update({ 
          deleted: true
        })
        .eq('id', messageId)
        .eq('sender_id', currentUserId); // Only allow deleting own messages

      if (error) {
        console.error('Error deleting message:', error);
        Alert.alert('Error', 'Failed to delete message');
        return;
      }

      console.log('Message deleted successfully');
      
      // Remove from local state immediately
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const handleLongPressMessage = (message: Message) => {
    // Only allow deleting own messages
    if (message.sender_id !== currentUserId) return;

    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteMessage(message.id)
        }
      ]
    );
  };

  const formatDateSeparator = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const messageDate = new Date(date);
    messageDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    
    if (messageDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric',
        year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Function to check if message contains only a single emoticon
  const isSingleEmoticonOnly = (content: string) => {
    const trimmedContent = content.trim();
    // Check if the content is a single emoticon (1-2 characters for most emoticons)
    // This regex matches most common emoticons
    const emoticonRegex = /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u;
    
    // Count the number of emoticon characters
    const emoticonCount = Array.from(trimmedContent).length;
    
    // Only show large if it's a single emoticon (max 2 characters due to some emoji using surrogate pairs)
    return emoticonRegex.test(trimmedContent) && emoticonCount <= 2;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === currentUserId;
    const messageTime = new Date(item.created_at);
    const isLargeEmoticon = isSingleEmoticonOnly(item.content);
    
    // Check if we need to show a date separator
    let showDateSeparator = false;
    if (index === 0) {
      showDateSeparator = true;
    } else {
      const prevMessage = messages[index - 1];
      const prevDate = new Date(prevMessage.created_at);
      if (prevDate.toDateString() !== messageTime.toDateString()) {
        showDateSeparator = true;
      }
    }

    return (
      <>
        {showDateSeparator && (
          <View style={styles.dateSeparatorContainer}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(messageTime)}
            </Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )}
        <View style={[styles.messageContainer, isMe && styles.myMessageContainer]}>
          {isLargeEmoticon ? (
            // Large emoticon display without bubble
            <TouchableOpacity 
              onLongPress={() => handleLongPressMessage(item)}
              style={styles.largeEmoticonContainer}
            >
              <Text style={styles.largeEmoticonText}>
                {item.content}
              </Text>
            </TouchableOpacity>
          ) : (
            // Regular message with bubble
            <TouchableOpacity 
              onLongPress={() => handleLongPressMessage(item)}
              style={[styles.messageBubble, isMe ? styles.myMessage : styles.otherMessage]}
            >
              <Text style={[styles.messageText, isMe && styles.myMessageText]}>
                {item.content}
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.messageInfo}>
            <Text style={styles.timestamp}>
              {messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && (
              <View style={styles.readStatus}>
                {item.is_read ? (
                  <Ionicons name="checkmark-done" size={16} color={theme.colors.primary} />
                ) : (
                  <Ionicons name="checkmark" size={16} color={theme.colors.gray[500]} />
                )}
              </View>
            )}
          </View>
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom header with user info */}
      <View style={styles.customHeader}>
        <TouchableOpacity 
          onPress={async () => {
            // Refresh badge count before navigating back
            await refreshChatBadgeCount();
            navigation.goBack();
          }} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.userInfoContainer}
          onPress={() => {
            navigation.navigate('UserProfile', { userId: otherUserId });
          }}
        >
          <View style={styles.avatarContainer}>
            {otherUserProfile?.photos && otherUserProfile.photos[0] ? (
              <Image source={{ uri: otherUserProfile.photos[0] }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={20} color="#999" />
              </View>
            )}
            {otherUserProfile && isUserOnline(otherUserProfile) && (
              <View style={styles.onlineIndicator} />
            )}
          </View>
          
          <View style={styles.userTextInfo}>
            <Text style={styles.userName}>{otherUserProfile?.name || otherUserName}</Text>
            <Text style={styles.userStatus}>
              {otherUserProfile ? 
                (isUserOnline(otherUserProfile) ? 'Online' : getLastSeenText(otherUserProfile.last_seen))
                : 'Loading...'
              }
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
          ListFooterComponent={
            false ? ( // Typing indicator disabled for now
              <View style={styles.typingIndicator}>
                <Text style={styles.typingText}>{otherUserName} is typing...</Text>
              </View>
            ) : null
          }
        />

        <View style={styles.inputContainer}>
          {isBlockedByOtherUser || hasBlockedOtherUser ? (
            <View style={styles.blockedMessageContainer}>
              <Ionicons name="ban" size={20} color={theme.colors.error} />
              <Text style={styles.blockedMessageText}>
                {isBlockedByOtherUser 
                  ? "You have been blocked by this user and cannot send messages."
                  : "You have blocked this user. Unblock them to send messages."}
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.attachButton}
                onPress={() => setShowEmoticonPicker(true)}
              >
                <Ionicons name="happy-outline" size={28} color={theme.colors.primary} />
              </TouchableOpacity>
              
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor={theme.colors.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxHeight={100}
                textContentType="none"
                autoCorrect={false}
                spellCheck={false}
              />

              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons
                    name="send"
                    size={24}
                    color={inputText.trim() ? theme.colors.primary : theme.colors.gray[400]}
                  />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
      
      <EmoticonPicker
        visible={showEmoticonPicker}
        onClose={() => setShowEmoticonPicker(false)}
        onSelectEmoticon={handleEmoticonSelect}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  messagesList: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  messageContainer: {
    marginBottom: theme.spacing.md,
    alignItems: 'flex-start',
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
  myMessage: {
    backgroundColor: theme.colors.primary,
  },
  otherMessage: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  messageText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  readStatus: {
    marginLeft: 2,
  },
  typingIndicator: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  typingText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  attachButton: {
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  blockedMessageContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
  },
  blockedMessageText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  userInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: theme.spacing.sm,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  userTextInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
  },
  userStatus: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  dateSeparatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dateSeparatorText: {
    marginHorizontal: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  largeEmoticonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xs,
  },
  largeEmoticonText: {
    fontSize: 48,
    lineHeight: 56,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  backButtonText: {
    color: 'white',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
  },
});

export default ChatRoomScreen;
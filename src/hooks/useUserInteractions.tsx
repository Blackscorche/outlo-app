
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/types';

export const useUserInteractions = (isVisible: boolean) => {
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showOtherUserProfile, setShowOtherUserProfile] = useState(false);

  const handleUserSelect = (user: User) => {
    console.log('Index handleUserSelect called for user:', user.name, 'ID:', user.id);
    setSelectedUser(user);
    setShowOtherUserProfile(true);
    console.log('Profile modal should now be visible');
  };

  const handleConnect = (user: User) => {
    if (!isVisible) {
      console.log('Cannot connect while hidden');
      return;
    }
    console.log('Connecting with:', user.name);
  };

  const handleChat = (user: User) => {
    console.log('Index handleChat called for user:', user.name);
    console.log('Navigating to chat room');
    
    // Navigate to chat room instead of opening modal
    navigate(`/chat/${user.id}`);
    setShowOtherUserProfile(false); // Close profile modal if open
  };

  const handleChatWithUser = (user: User) => {
    console.log('Index handleChatWithUser called for user:', user.name);
    console.log('Navigating to chat room');
    
    // Navigate to chat room
    navigate(`/chat/${user.id}`);
  };

  const handleSendMessage = (message: string) => {
    if (!isVisible) {
      console.log('Cannot send message while hidden');
      return;
    }
    console.log('Sending message:', message);
  };

  const handleCloseOtherUserProfile = () => {
    console.log('Closing other user profile modal');
    setShowOtherUserProfile(false);
    setSelectedUser(null);
  };

  return {
    selectedUser,
    showOtherUserProfile,
    handleUserSelect,
    handleConnect,
    handleChat,
    handleChatWithUser,
    handleSendMessage,
    handleCloseOtherUserProfile
  };
};

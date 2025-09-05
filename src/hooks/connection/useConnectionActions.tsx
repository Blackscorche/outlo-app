
import { DeviceEventEmitter } from 'react-native';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../useAuth';
import { useToast } from '../use-toast';
import { ConnectionRequest } from '../../types/connection';

interface UseConnectionActionsProps {
  receivedRequests: ConnectionRequest[];
  loadConnectionRequests: () => Promise<void>;
}

export const useConnectionActions = ({ receivedRequests, loadConnectionRequests }: UseConnectionActionsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const sendConnectionRequest = async (receiverId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('connection_requests')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          status: 'pending'
        });

      if (error) {
        console.error('Error sending connection request:', error);
        toast({
          title: "Error",
          description: "Failed to send connection request. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      await loadConnectionRequests();
      
      // Emit event to trigger real-time updates on other devices/components
      DeviceEventEmitter.emit('connectionDataChanged', { 
        action: 'request_sent', 
        receiverId 
      });
      
      toast({
        title: "Connection request sent",
        description: "Your request has been sent successfully.",
      });
      
      return true;
    } catch (error) {
      console.error('Error sending connection request:', error);
      return false;
    }
  };

  const respondToRequest = async (requestId: string, response: 'accepted' | 'rejected') => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('connection_requests')
        .update({ 
          status: response,
          seen_by_receiver: true 
        })
        .eq('id', requestId);

      if (error) {
        console.error('Error responding to request:', error);
        toast({
          title: "Error",
          description: "Failed to respond to request. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      await loadConnectionRequests();
      
      // Emit event to trigger real-time updates
      DeviceEventEmitter.emit('connectionDataChanged', { 
        action: response === 'accepted' ? 'request_accepted' : 'request_rejected', 
        requestId 
      });
      
      toast({
        title: response === 'accepted' ? "Request accepted" : "Request declined",
        description: response === 'accepted' 
          ? "You are now connected!" 
          : "Request has been declined.",
      });
      
      return true;
    } catch (error) {
      console.error('Error responding to request:', error);
      return false;
    }
  };

  const disconnectUser = async (userId: string) => {
    if (!user) return false;

    try {
      console.log('Disconnecting from user:', userId);
      
      // Delete the connection (bidirectional - works regardless of who initiated)
      const { error: connectionError } = await supabase
        .from('connections')
        .delete()
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${user.id})`);

      if (connectionError) {
        console.error('Error deleting connection:', connectionError);
        toast({
          title: "Error",
          description: "Failed to disconnect. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      // Also delete any pending/accepted connection requests between these users
      const { error: requestError } = await supabase
        .from('connection_requests')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`);

      if (requestError) {
        console.error('Error deleting connection requests:', requestError);
      }

      // Delete the chat room between these users to completely reset the connection state
      console.log('Deleting chat room between users:', user.id, 'and', userId);
      const { error: chatRoomError } = await supabase
        .from('chat_rooms')
        .delete()
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${user.id})`);

      if (chatRoomError) {
        console.error('Error deleting chat room:', chatRoomError);
      }

      // Force immediate refresh of connection data for current user
      await loadConnectionRequests();
      
      // Trigger multiple disconnection events to ensure all components update immediately
      try {
        // First event for the specific user that was disconnected
        DeviceEventEmitter.emit('userDisconnected', { 
          userId, 
          disconnectedBy: user.id 
        });
        
        // Second event for global connection refresh
        DeviceEventEmitter.emit('connectionDataChanged', { 
          action: 'disconnect', 
          userId 
        });
        
        // Third event specifically for forcing UI refresh
        DeviceEventEmitter.emit('forceConnectionRefresh', { 
          userId 
        });
      } catch (eventError) {
        console.error('Error emitting disconnection events:', eventError);
      }
      
      toast({
        title: "Disconnected",
        description: "You have been disconnected from this user.",
      });
      
      return true;
    } catch (error) {
      console.error('Error disconnecting user:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    sendConnectionRequest,
    respondToRequest,
    disconnectUser
  };
};

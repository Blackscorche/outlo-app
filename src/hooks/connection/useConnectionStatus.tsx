
import { useCallback } from 'react';
import { ConnectionRequest, ConnectionStatus } from '../../types/connection';

interface UseConnectionStatusProps {
  sentRequests: ConnectionRequest[];
  receivedRequests: ConnectionRequest[];
  connections: string[];
}

export const useConnectionStatus = ({ 
  sentRequests, 
  receivedRequests, 
  connections 
}: UseConnectionStatusProps) => {
  const getConnectionStatus = useCallback((userId: string): ConnectionStatus => {
    
    // Check if already connected (this is the most important check)
    const isConnected = connections.includes(userId);
    if (isConnected) {
      return 'connected';
    }

    // Check if request was sent and is still pending
    const sentRequest = sentRequests.find(req => 
      req.receiver_id === userId && req.status === 'pending'
    );
    if (sentRequest) {
      return 'request_sent';
    }

    // Check if request was received and is still pending
    const receivedRequest = receivedRequests.find(req => 
      req.sender_id === userId && req.status === 'pending'
    );
    if (receivedRequest) {
      return 'request_received';
    }

    return 'none';
  }, [sentRequests, receivedRequests, connections]);

  return {
    getConnectionStatus
  };
};

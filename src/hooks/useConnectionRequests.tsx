
import { useConnectionData } from './connection/useConnectionData';
import { useConnectionActions } from './connection/useConnectionActions';
import { useConnectionStatus } from './connection/useConnectionStatus';

export type { ConnectionRequest } from '../types/connection';

export const useConnectionRequests = () => {
  const {
    sentRequests,
    receivedRequests,
    connections,
    loadConnectionRequests,
    isLoading
  } = useConnectionData();

  const {
    sendConnectionRequest,
    respondToRequest,
    disconnectUser
  } = useConnectionActions({
    receivedRequests,
    loadConnectionRequests
  });

  const { getConnectionStatus } = useConnectionStatus({
    sentRequests,
    receivedRequests,
    connections
  });

  return {
    sentRequests,
    receivedRequests,
    connections,
    sendConnectionRequest,
    respondToRequest,
    disconnectUser,
    getConnectionStatus,
    loadConnectionRequests,
    isLoading
  };
};

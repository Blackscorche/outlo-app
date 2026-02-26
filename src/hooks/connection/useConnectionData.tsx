
import { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../useAuth';
import { ConnectionRequest } from '../../types/connection';

export const useConnectionData = () => {
  const { user } = useAuth();
  const [sentRequests, setSentRequests] = useState<ConnectionRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ConnectionRequest[]>([]);
  const [connections, setConnections] = useState<string[]>([]);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const loadConnectionRequestsRef = useRef<(() => Promise<void>) | null>(null);

  const loadConnectionRequests = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      // Load sent requests
      const { data: sent, error: sentError } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('sender_id', user.id);

      if (sentError) {
        console.error('Error loading sent requests:', sentError);
      } else {
        setSentRequests((sent || []) as ConnectionRequest[]);
      }

      // Load received requests
      const { data: received, error: receivedError } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('receiver_id', user.id);

      if (receivedError) {
        console.error('Error loading received requests:', receivedError);
      } else {
        setReceivedRequests((received || []) as ConnectionRequest[]);
      }

      // Load connections
      const { data: userConnections, error: connectionsError } = await supabase
        .from('connections')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (connectionsError) {
        console.error('Error loading connections:', connectionsError);
      } else {
        const connectedUserIds = userConnections?.map(conn => 
          conn.user1_id === user.id ? conn.user2_id : conn.user1_id
        ) || [];
        setConnections(connectedUserIds);
      }

      setLastLoadTime(Date.now());
    } catch (error) {
      console.error('Error loading connection data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Update ref when function changes
  useEffect(() => {
    loadConnectionRequestsRef.current = loadConnectionRequests;
  });

  useEffect(() => {
    if (user) {
      loadConnectionRequests();
    } else {
      // Clear all data when user logs out
      setSentRequests([]);
      setReceivedRequests([]);
      setConnections([]);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user to prevent infinite loop

  // Real-time subscriptions for connection requests
  useEffect(() => {
    if (!user) return;

    console.log('Setting up real-time subscriptions for connection requests');

    // Subscribe to sent requests (sender_id = current user)
    const sentRequestsSubscription = supabase
      .channel(`sent_requests_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'connection_requests',
        filter: `sender_id=eq.${user.id}`,
      }, (payload) => {
        console.log('Real-time update for sent requests:', payload.eventType, payload.new || payload.old);
        setTimeout(() => {
          if (loadConnectionRequestsRef.current) {
            loadConnectionRequestsRef.current();
          }
        }, 100);
      })
      .subscribe((status) => {
        console.log('Sent requests subscription status:', status);
      });

    // Subscribe to received requests (receiver_id = current user) — separate channel
    const receivedRequestsSubscription = supabase
      .channel(`received_requests_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'connection_requests',
        filter: `receiver_id=eq.${user.id}`,
      }, (payload) => {
        console.log('Real-time update for received requests:', payload.eventType, payload.new || payload.old);
        setTimeout(() => {
          if (loadConnectionRequestsRef.current) {
            loadConnectionRequestsRef.current();
          }
        }, 100);
      })
      .subscribe((status) => {
        console.log('Received requests subscription status:', status);
      });

    // Subscribe to connections table changes
    const connectionsSubscription = supabase
      .channel(`connections_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'connections',
        filter: `user1_id=eq.${user.id}`
      }, (payload) => {
        console.log('Real-time update for connections (user1):', payload.eventType, payload.new || payload.old);
        setTimeout(() => {
          if (loadConnectionRequestsRef.current) {
            loadConnectionRequestsRef.current();
          }
        }, 100);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'connections',
        filter: `user2_id=eq.${user.id}`
      }, (payload) => {
        console.log('Real-time update for connections (user2):', payload.eventType, payload.new || payload.old);
        setTimeout(() => {
          if (loadConnectionRequestsRef.current) {
            loadConnectionRequestsRef.current();
          }
        }, 100);
      })
      .subscribe((status) => {
        console.log('Connections subscription status:', status);
      });

    // Listen for disconnection events to ensure immediate refresh
    const handleUserDisconnected = async () => {
      if (loadConnectionRequestsRef.current) {
        await loadConnectionRequestsRef.current();
      }
    };

    const handleConnectionDataChanged = async () => {
      if (loadConnectionRequestsRef.current) {
        await loadConnectionRequestsRef.current();
      }
    };

    const handleForceConnectionRefresh = async () => {
      if (loadConnectionRequestsRef.current) {
        await loadConnectionRequestsRef.current();
      }
    };

    const userDisconnectedListener = DeviceEventEmitter.addListener('userDisconnected', handleUserDisconnected);
    const connectionDataChangedListener = DeviceEventEmitter.addListener('connectionDataChanged', handleConnectionDataChanged);
    const forceConnectionRefreshListener = DeviceEventEmitter.addListener('forceConnectionRefresh', handleForceConnectionRefresh);
    
    return () => {
      console.log('Cleaning up real-time subscriptions');
      sentRequestsSubscription.unsubscribe();
      receivedRequestsSubscription.unsubscribe();
      connectionsSubscription.unsubscribe();
      userDisconnectedListener.remove();
      connectionDataChangedListener.remove();
      forceConnectionRefreshListener.remove();
    };
  }, [user]);

  return {
    sentRequests,
    receivedRequests,
    connections,
    loadConnectionRequests,
    lastLoadTime,
    isLoading
  };
};

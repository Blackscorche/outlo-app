

export interface ConnectionRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  seen_by_receiver: boolean;
  created_at: string;
  updated_at: string;
}

export type ConnectionStatus = 'none' | 'request_sent' | 'request_received' | 'connected';


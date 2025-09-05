
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface VerificationRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  admin_notes?: string;
}

export const useVerification = () => {
  const { user } = useAuth();
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVerificationStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('verification_requests')
        .select('id, status, created_at, admin_notes')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        // Type assertion to ensure status matches our interface
        const typedData: VerificationRequest = {
          ...data,
          status: data.status as 'pending' | 'approved' | 'rejected'
        };
        setVerificationRequest(typedData);
      } else {
        setVerificationRequest(null);
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerificationStatus();
  }, [user]);

  const refreshVerificationStatus = () => {
    fetchVerificationStatus();
  };

  return {
    verificationRequest,
    loading,
    refreshVerificationStatus
  };
};

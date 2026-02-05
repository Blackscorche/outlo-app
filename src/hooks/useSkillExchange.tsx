import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../integrations/supabase/client';
import { Tables } from '../integrations/supabase/types';

export type SkillExchangeProposal = Tables<'skill_exchange_proposals'> & {
  proposer?: {
    id: string;
    name: string;
    photos: string[] | null;
  };
  receiver?: {
    id: string;
    name: string;
    photos: string[] | null;
  };
  skill_to_learn?: Tables<'skills'> & { category?: Tables<'skill_categories'> };
  skill_to_offer?: Tables<'skills'> & { category?: Tables<'skill_categories'> };
};

export type SkillExchangeSession = Tables<'skill_exchange_sessions'> & {
  teacher?: {
    id: string;
    name: string;
    photos: string[] | null;
  };
  student?: {
    id: string;
    name: string;
    photos: string[] | null;
  };
  skill?: Tables<'skills'> & { category?: Tables<'skill_categories'> };
  proposal?: SkillExchangeProposal;
};

interface CreateProposalData {
  receiver_id: string;
  skill_to_learn_id: string;
  skill_to_offer_id?: string;
  location_name: string;
  latitude: number;
  longitude: number;
  proposed_date: string;
  duration_minutes?: number;
  message?: string;
}

export function useSkillExchange() {
  const [sentProposals, setSentProposals] = useState<SkillExchangeProposal[]>([]);
  const [receivedProposals, setReceivedProposals] = useState<SkillExchangeProposal[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SkillExchangeSession[]>([]);
  const [pastSessions, setPastSessions] = useState<SkillExchangeSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    setupRealtimeSubscription();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load sent proposals
      const { data: sentData } = await supabase
        .from('skill_exchange_proposals')
        .select(`
          *,
          receiver:profiles!skill_exchange_proposals_receiver_id_fkey(id, name, photos),
          skill_to_learn:skills!skill_exchange_proposals_skill_to_learn_id_fkey(*, category:skill_categories(*)),
          skill_to_offer:skills!skill_exchange_proposals_skill_to_offer_id_fkey(*, category:skill_categories(*))
        `)
        .eq('proposer_id', user.id)
        .order('created_at', { ascending: false });

      // Load received proposals
      const { data: receivedData } = await supabase
        .from('skill_exchange_proposals')
        .select(`
          *,
          proposer:profiles!skill_exchange_proposals_proposer_id_fkey(id, name, photos),
          skill_to_learn:skills!skill_exchange_proposals_skill_to_learn_id_fkey(*, category:skill_categories(*)),
          skill_to_offer:skills!skill_exchange_proposals_skill_to_offer_id_fkey(*, category:skill_categories(*))
        `)
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      // Load sessions
      const { data: sessionsData } = await supabase
        .from('skill_exchange_sessions')
        .select(`
          *,
          teacher:profiles!skill_exchange_sessions_teacher_id_fkey(id, name, photos),
          student:profiles!skill_exchange_sessions_student_id_fkey(id, name, photos),
          skill:skills!skill_exchange_sessions_skill_id_fkey(*, category:skill_categories(*))
        `)
        .or(`teacher_id.eq.${user.id},student_id.eq.${user.id}`)
        .order('session_date', { ascending: true });

      if (mountedRef.current) {
        setSentProposals(sentData || []);
        setReceivedProposals(receivedData || []);

        const now = new Date().toISOString();
        setUpcomingSessions(
          (sessionsData || []).filter(
            s => s.session_date >= now && s.status !== 'cancelled'
          )
        );
        setPastSessions(
          (sessionsData || []).filter(
            s => s.session_date < now || s.status === 'completed'
          )
        );
      }
    } catch (error) {
      console.error('Error loading skill exchange data:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const setupRealtimeSubscription = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const subscription = supabase
      .channel(`skill_exchange_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'skill_exchange_proposals',
      }, () => {
        if (mountedRef.current) {
          loadData();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'skill_exchange_sessions',
      }, () => {
        if (mountedRef.current) {
          loadData();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  // Create a new proposal
  const createProposal = useCallback(async (data: CreateProposalData): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create proposals');
        return false;
      }

      const { error } = await supabase
        .from('skill_exchange_proposals')
        .insert({
          proposer_id: user.id,
          receiver_id: data.receiver_id,
          skill_to_learn_id: data.skill_to_learn_id,
          skill_to_offer_id: data.skill_to_offer_id || null,
          location_name: data.location_name,
          latitude: data.latitude,
          longitude: data.longitude,
          proposed_date: data.proposed_date,
          duration_minutes: data.duration_minutes || 60,
          message: data.message || null,
        });

      if (error) throw error;

      await loadData();
      return true;
    } catch (error: any) {
      console.error('Error creating proposal:', error);
      Alert.alert('Error', error.message || 'Failed to create proposal');
      return false;
    }
  }, []);

  // Accept a proposal
  const acceptProposal = useCallback(async (proposalId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Get the proposal
      const { data: proposal, error: fetchError } = await supabase
        .from('skill_exchange_proposals')
        .select('*')
        .eq('id', proposalId)
        .single();

      if (fetchError || !proposal) throw fetchError || new Error('Proposal not found');

      // Update proposal status
      const { error: updateError } = await supabase
        .from('skill_exchange_proposals')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (updateError) throw updateError;

      // Create session(s) for the exchange
      // Session 1: Receiver teaches proposer
      const { error: session1Error } = await supabase
        .from('skill_exchange_sessions')
        .insert({
          proposal_id: proposalId,
          teacher_id: proposal.receiver_id,
          student_id: proposal.proposer_id,
          skill_id: proposal.skill_to_learn_id,
          session_date: proposal.proposed_date,
        });

      if (session1Error) throw session1Error;

      // Session 2: Proposer teaches receiver (if skill offered)
      if (proposal.skill_to_offer_id) {
        const { error: session2Error } = await supabase
          .from('skill_exchange_sessions')
          .insert({
            proposal_id: proposalId,
            teacher_id: proposal.proposer_id,
            student_id: proposal.receiver_id,
            skill_id: proposal.skill_to_offer_id,
            session_date: proposal.proposed_date,
          });

        if (session2Error) throw session2Error;
      }

      await loadData();
      return true;
    } catch (error: any) {
      console.error('Error accepting proposal:', error);
      Alert.alert('Error', error.message || 'Failed to accept proposal');
      return false;
    }
  }, []);

  // Decline a proposal
  const declineProposal = useCallback(async (proposalId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('skill_exchange_proposals')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (error) throw error;

      await loadData();
      return true;
    } catch (error: any) {
      console.error('Error declining proposal:', error);
      Alert.alert('Error', error.message || 'Failed to decline proposal');
      return false;
    }
  }, []);

  // Cancel a proposal
  const cancelProposal = useCallback(async (proposalId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('skill_exchange_proposals')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', proposalId);

      if (error) throw error;

      await loadData();
      return true;
    } catch (error: any) {
      console.error('Error cancelling proposal:', error);
      Alert.alert('Error', error.message || 'Failed to cancel proposal');
      return false;
    }
  }, []);

  // Mark session as completed
  const completeSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('skill_exchange_sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;

      await loadData();
      return true;
    } catch (error: any) {
      console.error('Error completing session:', error);
      Alert.alert('Error', error.message || 'Failed to complete session');
      return false;
    }
  }, []);

  // Cancel session
  const cancelSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('skill_exchange_sessions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;

      await loadData();
      return true;
    } catch (error: any) {
      console.error('Error cancelling session:', error);
      Alert.alert('Error', error.message || 'Failed to cancel session');
      return false;
    }
  }, []);

  // Get pending proposals count
  const pendingReceivedCount = receivedProposals.filter(p => p.status === 'pending').length;

  return {
    // Data
    sentProposals,
    receivedProposals,
    upcomingSessions,
    pastSessions,
    pendingReceivedCount,

    // Loading states
    loading,
    refreshing,

    // Actions
    refresh,
    createProposal,
    acceptProposal,
    declineProposal,
    cancelProposal,
    completeSession,
    cancelSession,
  };
}

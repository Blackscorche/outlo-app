
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AIPhrase {
  id: string;
  category: string;
  phrase: string;
  created_at: string;
}

export const useAIPhrases = () => {
  const [phrases, setPhrases] = useState<AIPhrase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhrases = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_phrases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching AI phrases:', error);
        return;
      }

      setPhrases(data || []);
    } catch (err) {
      console.error('Error in fetchPhrases:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPhrasesByCategory = (category: string) => {
    return phrases.filter(phrase => phrase.category === category);
  };

  useEffect(() => {
    fetchPhrases();
  }, []);

  return {
    phrases,
    loading,
    getPhrasesByCategory
  };
};

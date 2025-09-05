
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export const useIndexAuth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isInitializing, setIsInitializing] = useState(true);

  // Auth check effect
  useEffect(() => {
    console.log('Index useEffect - auth check:', { user: !!user, loading });
    if (!loading && !user) {
      console.log('Redirecting to auth - no user found');
      navigate('/auth');
      return;
    }
    
    // Mark as initialized after auth check
    if (!loading) {
      setTimeout(() => setIsInitializing(false), 1000);
    }
  }, [user, loading, navigate]);

  return {
    user,
    loading,
    isInitializing
  };
};

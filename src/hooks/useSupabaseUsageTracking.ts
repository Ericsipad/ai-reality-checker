
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UsageData {
  checks_used: number;
  total_checks: number;
  last_reset: string;
}

export const useSupabaseUsageTracking = () => {
  const [remainingChecks, setRemainingChecks] = useState(5);
  const [totalChecks, setTotalChecks] = useState(5);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchUsageData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchUsageData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_usage')
        .select('checks_used, total_checks, last_reset')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching usage data:', error);
        return;
      }

      if (data) {
        const now = new Date();
        const lastReset = new Date(data.last_reset);
        const weeksSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (7 * 24 * 60 * 60 * 1000));

        if (weeksSinceReset >= 1) {
          // Reset weekly usage
          await resetWeeklyUsage();
        } else {
          setTotalChecks(data.total_checks);
          setRemainingChecks(Math.max(0, data.total_checks - data.checks_used));
        }
      }
    } catch (error) {
      console.error('Error in fetchUsageData:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetWeeklyUsage = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_usage')
        .update({
          checks_used: 0,
          last_reset: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (!error) {
        setRemainingChecks(totalChecks);
      }
    } catch (error) {
      console.error('Error resetting weekly usage:', error);
    }
  };

  const useCheck = (): boolean => {
    if (!user || remainingChecks <= 0) return false;

    // Optimistically update UI
    setRemainingChecks(prev => prev - 1);

    // Update database
    updateUsageInDatabase();
    
    return true;
  };

  const updateUsageInDatabase = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_usage')
        .update({
          checks_used: totalChecks - remainingChecks + 1
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating usage:', error);
        // Revert optimistic update on error
        setRemainingChecks(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error in updateUsageInDatabase:', error);
      setRemainingChecks(prev => prev + 1);
    }
  };

  return {
    remainingChecks,
    totalChecks,
    useCheck,
    loading
  };
};

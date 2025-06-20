
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UsageData {
  checks_used: number;
  total_checks: number;
  last_reset: string;
}

export const useSupabaseUsageTracking = () => {
  const [remainingChecks, setRemainingChecks] = useState(3);
  const [totalChecks, setTotalChecks] = useState(3);
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
          // Reset weekly usage to 3 checks
          await resetWeeklyUsage();
        } else {
          // Always use 3 as total for free users
          const actualTotal = 3;
          setTotalChecks(actualTotal);
          setRemainingChecks(Math.max(0, actualTotal - data.checks_used));
        }
      } else {
        // If no usage record exists, create one with current IP usage
        await createUsageRecord();
      }
    } catch (error) {
      console.error('Error in fetchUsageData:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUsageRecord = async () => {
    if (!user) return;

    // Try to get existing IP-based usage to preserve it
    let existingUsage = 0;
    try {
      // Get client identifier similar to IP tracking
      const userAgent = navigator.userAgent;
      const language = navigator.language;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const screenSize = `${window.screen.width}x${window.screen.height}`;
      const clientId = btoa(`${userAgent}-${language}-${timezone}-${screenSize}`).slice(0, 16);
      const storageKey = `aiDetectionUsage_${clientId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const data = JSON.parse(stored);
        existingUsage = data.checks_used || 0;
      }
    } catch (error) {
      console.log('Could not retrieve existing usage, starting fresh');
    }

    try {
      const { error } = await supabase
        .from('user_usage')
        .insert({
          user_id: user.id,
          email: user.email,
          checks_used: existingUsage, // Preserve existing usage
          total_checks: 3, // Always 3 for free users
          last_reset: new Date().toISOString()
        });

      if (!error) {
        setTotalChecks(3);
        setRemainingChecks(Math.max(0, 3 - existingUsage));
      }
    } catch (error) {
      console.error('Error creating usage record:', error);
    }
  };

  const resetWeeklyUsage = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_usage')
        .update({
          checks_used: 0,
          total_checks: 3, // Always reset to 3
          last_reset: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (!error) {
        setTotalChecks(3);
        setRemainingChecks(3);
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
          checks_used: 3 - remainingChecks + 1 // Calculate used checks
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
    totalChecks: 3, // Always return 3 for consistency
    useCheck,
    loading
  };
};

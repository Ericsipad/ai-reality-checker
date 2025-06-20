
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UsageData {
  remaining_checks: number;
  total_checks: number;
  last_reset: string;
}

export const useSecureUsageTracking = () => {
  const [remainingChecks, setRemainingChecks] = useState(3);
  const [totalChecks, setTotalChecks] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchUsageData = useCallback(async () => {
    if (!user) {
      // For non-authenticated users, use local storage with validation
      return fetchLocalUsage();
    }

    try {
      setError(null);
      
      // For authenticated users, use server-side tracking
      const { data: subscriberData, error: subscriberError } = await supabase
        .from('subscribers')
        .select('remaining_checks, subscription_tier')
        .eq('user_id', user.id)
        .single();

      if (subscriberError && subscriberError.code !== 'PGRST116') {
        console.error('Error fetching subscriber data:', subscriberError);
        setError('Failed to fetch usage data');
        return;
      }

      if (subscriberData && subscriberData.remaining_checks !== null) {
        // User has paid credits
        setRemainingChecks(subscriberData.remaining_checks);
        setTotalChecks(subscriberData.remaining_checks); // For paid users, show remaining as total
      } else {
        // Check weekly free usage
        const { data: usageData, error: usageError } = await supabase
          .from('user_usage')
          .select('checks_used, total_checks, last_reset')
          .eq('user_id', user.id)
          .single();

        if (usageError && usageError.code !== 'PGRST116') {
          console.error('Error fetching usage data:', usageError);
          setError('Failed to fetch usage data');
          return;
        }

        if (usageData) {
          const now = new Date();
          const lastReset = new Date(usageData.last_reset);
          const weeksSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (7 * 24 * 60 * 60 * 1000));

          if (weeksSinceReset >= 1) {
            // Reset weekly usage
            await resetWeeklyUsage();
          } else {
            setTotalChecks(3);
            setRemainingChecks(Math.max(0, 3 - usageData.checks_used));
          }
        } else {
          // Create initial usage record
          await createInitialUsageRecord();
        }
      }
    } catch (error) {
      console.error('Error in fetchUsageData:', error);
      setError('Failed to fetch usage data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchLocalUsage = () => {
    try {
      // Secure client identifier that's harder to manipulate
      const clientId = generateSecureClientId();
      const storageKey = `aiDetectionUsage_${clientId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const data = JSON.parse(stored);
        const now = new Date();
        const lastReset = new Date(data.last_reset);
        const weeksSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (7 * 24 * 60 * 60 * 1000));
        
        if (weeksSinceReset >= 1) {
          // Reset weekly usage
          const newData = {
            checks_used: 0,
            total_checks: 3,
            last_reset: now.toISOString()
          };
          localStorage.setItem(storageKey, JSON.stringify(newData));
          setRemainingChecks(3);
          setTotalChecks(3);
        } else {
          setRemainingChecks(Math.max(0, 3 - data.checks_used));
          setTotalChecks(3);
        }
      } else {
        // Initialize new user
        const newData = {
          checks_used: 0,
          total_checks: 3,
          last_reset: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(newData));
        setRemainingChecks(3);
        setTotalChecks(3);
      }
    } catch (error) {
      console.error('Error in fetchLocalUsage:', error);
      setError('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  const generateSecureClientId = (): string => {
    // More secure client fingerprinting
    const factors = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      window.screen.width,
      window.screen.height,
      window.screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      new Date().getTimezoneOffset().toString()
    ];
    
    // Create a more stable identifier
    const combined = factors.join('|');
    return btoa(combined).slice(0, 24);
  };

  const createInitialUsageRecord = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_usage')
        .insert({
          user_id: user.id,
          email: user.email,
          checks_used: 0,
          total_checks: 3,
          last_reset: new Date().toISOString()
        });

      if (!error) {
        setTotalChecks(3);
        setRemainingChecks(3);
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
          total_checks: 3,
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

  const useCheck = async (): Promise<boolean> => {
    if (remainingChecks <= 0) return false;

    if (!user) {
      // Handle local storage for non-authenticated users
      return useCheckLocal();
    }

    try {
      // First check if user has paid credits
      const { data: subscriberData } = await supabase
        .from('subscribers')
        .select('remaining_checks, subscription_tier')
        .eq('user_id', user.id)
        .single();

      if (subscriberData && subscriberData.remaining_checks > 0) {
        // Deduct from paid credits
        const { error } = await supabase
          .from('subscribers')
          .update({ 
            remaining_checks: subscriberData.remaining_checks - 1,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (!error) {
          setRemainingChecks(prev => prev - 1);
          return true;
        }
      } else {
        // Deduct from weekly free credits
        const { error } = await supabase
          .from('user_usage')
          .update({ 
            checks_used: supabase.sql`checks_used + 1`
          })
          .eq('user_id', user.id);

        if (!error) {
          setRemainingChecks(prev => prev - 1);
          return true;
        }
      }
    } catch (error) {
      console.error('Error using check:', error);
    }

    return false;
  };

  const useCheckLocal = (): boolean => {
    try {
      const clientId = generateSecureClientId();
      const storageKey = `aiDetectionUsage_${clientId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const data = JSON.parse(stored);
        const newData = {
          ...data,
          checks_used: data.checks_used + 1
        };
        localStorage.setItem(storageKey, JSON.stringify(newData));
        setRemainingChecks(Math.max(0, 3 - newData.checks_used));
        return true;
      }
    } catch (error) {
      console.error('Error updating local usage:', error);
    }
    return false;
  };

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  return {
    remainingChecks,
    totalChecks,
    useCheck,
    loading,
    error,
    refreshUsage: fetchUsageData
  };
};


import { useState, useEffect } from 'react';

interface IPUsageData {
  checks_used: number;
  total_checks: number;
  last_reset: string;
}

export const useIPUsageTracking = () => {
  const [remainingChecks, setRemainingChecks] = useState(5);
  const [totalChecks] = useState(5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAndResetWeekly();
  }, []);

  const checkAndResetWeekly = () => {
    const stored = localStorage.getItem('aiDetectionUsage_IP');
    const now = new Date();
    
    if (stored) {
      const data: IPUsageData = JSON.parse(stored);
      const lastReset = new Date(data.last_reset);
      const weeksSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (7 * 24 * 60 * 60 * 1000));
      
      if (weeksSinceReset >= 1) {
        // Reset weekly usage
        const newData: IPUsageData = {
          checks_used: 0,
          total_checks: 5,
          last_reset: now.toISOString()
        };
        localStorage.setItem('aiDetectionUsage_IP', JSON.stringify(newData));
        setRemainingChecks(5);
      } else {
        setRemainingChecks(Math.max(0, data.total_checks - data.checks_used));
      }
    } else {
      // First time user
      const newData: IPUsageData = {
        checks_used: 0,
        total_checks: 5,
        last_reset: now.toISOString()
      };
      localStorage.setItem('aiDetectionUsage_IP', JSON.stringify(newData));
      setRemainingChecks(5);
    }
    setLoading(false);
  };

  const useCheck = (): boolean => {
    if (remainingChecks <= 0) return false;

    const stored = localStorage.getItem('aiDetectionUsage_IP');
    if (stored) {
      const data: IPUsageData = JSON.parse(stored);
      const newData: IPUsageData = {
        ...data,
        checks_used: data.checks_used + 1
      };
      localStorage.setItem('aiDetectionUsage_IP', JSON.stringify(newData));
      setRemainingChecks(prev => prev - 1);
      return true;
    }
    return false;
  };

  return {
    remainingChecks,
    totalChecks,
    useCheck,
    loading
  };
};


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
    checkAndResetMonthly();
  }, []);

  const checkAndResetMonthly = () => {
    const stored = localStorage.getItem('aiDetectionUsage_IP');
    const now = new Date();
    
    if (stored) {
      const data: IPUsageData = JSON.parse(stored);
      const lastReset = new Date(data.last_reset);
      
      // Check if it's been a month since last reset
      const monthsSinceReset = (now.getFullYear() - lastReset.getFullYear()) * 12 + 
                               (now.getMonth() - lastReset.getMonth());
      
      if (monthsSinceReset >= 1) {
        // Reset monthly usage
        const newData: IPUsageData = {
          checks_used: 0,
          total_checks: 5,
          last_reset: now.toISOString()
        };
        localStorage.setItem('aiDetectionUsage_IP', JSON.stringify(newData));
        setRemainingChecks(5);
      } else {
        // Fix: Ensure remaining checks calculation is correct
        const remaining = Math.max(0, data.total_checks - data.checks_used);
        setRemainingChecks(remaining);
      }
    } else {
      // First time user - initialize with full 5 checks
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
      
      // Fix: Update remaining checks after successful storage
      const newRemaining = Math.max(0, newData.total_checks - newData.checks_used);
      setRemainingChecks(newRemaining);
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

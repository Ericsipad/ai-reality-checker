
import { useState, useEffect } from 'react';

interface UsageData {
  checks: number;
  lastReset: string;
}

export const useUsageTracking = () => {
  const [remainingChecks, setRemainingChecks] = useState(5);
  const [totalChecks] = useState(5);

  useEffect(() => {
    const checkAndResetWeekly = () => {
      const stored = localStorage.getItem('aiDetectionUsage');
      const now = new Date();
      
      if (stored) {
        const data: UsageData = JSON.parse(stored);
        const lastReset = new Date(data.lastReset);
        const weeksSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (7 * 24 * 60 * 60 * 1000));
        
        if (weeksSinceReset >= 1) {
          // Reset weekly usage
          const newData: UsageData = {
            checks: 0,
            lastReset: now.toISOString()
          };
          localStorage.setItem('aiDetectionUsage', JSON.stringify(newData));
          setRemainingChecks(totalChecks);
        } else {
          setRemainingChecks(Math.max(0, totalChecks - data.checks));
        }
      } else {
        // First time user
        const newData: UsageData = {
          checks: 0,
          lastReset: now.toISOString()
        };
        localStorage.setItem('aiDetectionUsage', JSON.stringify(newData));
        setRemainingChecks(totalChecks);
      }
    };

    checkAndResetWeekly();
  }, [totalChecks]);

  const useCheck = (): boolean => {
    if (remainingChecks <= 0) return false;

    const stored = localStorage.getItem('aiDetectionUsage');
    if (stored) {
      const data: UsageData = JSON.parse(stored);
      const newData: UsageData = {
        ...data,
        checks: data.checks + 1
      };
      localStorage.setItem('aiDetectionUsage', JSON.stringify(newData));
      setRemainingChecks(prev => prev - 1);
      return true;
    }
    return false;
  };

  return {
    remainingChecks,
    totalChecks,
    useCheck
  };
};

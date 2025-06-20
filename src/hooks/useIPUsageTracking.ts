import { useState, useEffect } from 'react';

interface IPUsageData {
  checks_used: number;
  total_checks: number;
  last_reset: string;
}

// Helper function to get client IP (simplified for frontend)
const getClientIdentifier = (): string => {
  // Use a combination of factors for identification since we can't get real IP in frontend
  const userAgent = navigator.userAgent;
  const language = navigator.language;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const screenSize = `${window.screen.width}x${window.screen.height}`;
  
  // Create a simple hash-like identifier
  return btoa(`${userAgent}-${language}-${timezone}-${screenSize}`).slice(0, 16);
};

export const useIPUsageTracking = () => {
  const [remainingChecks, setRemainingChecks] = useState(3);
  const [totalChecks] = useState(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAndResetWeekly();
  }, []);

  const checkAndResetWeekly = () => {
    const clientId = getClientIdentifier();
    const storageKey = `aiDetectionUsage_${clientId}`;
    const stored = localStorage.getItem(storageKey);
    const now = new Date();
    
    if (stored) {
      try {
        const data: IPUsageData = JSON.parse(stored);
        const lastReset = new Date(data.last_reset);
        
        // Check if it's been a week since last reset
        const weeksSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (7 * 24 * 60 * 60 * 1000));
        
        if (weeksSinceReset >= 1) {
          // Reset weekly usage - always reset to 3 checks
          const newData: IPUsageData = {
            checks_used: 0,
            total_checks: 3,
            last_reset: now.toISOString()
          };
          localStorage.setItem(storageKey, JSON.stringify(newData));
          setRemainingChecks(3);
        } else {
          // Calculate remaining checks - ensure it's always based on 3 total
          const remaining = Math.max(0, 3 - data.checks_used);
          setRemainingChecks(remaining);
        }
      } catch (error) {
        console.error('Error parsing stored usage data:', error);
        // Initialize with fresh data if parsing fails
        const newData: IPUsageData = {
          checks_used: 0,
          total_checks: 3,
          last_reset: now.toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(newData));
        setRemainingChecks(3);
      }
    } else {
      // First time user - initialize with full 3 checks
      const newData: IPUsageData = {
        checks_used: 0,
        total_checks: 3,
        last_reset: now.toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(newData));
      setRemainingChecks(3);
    }
    setLoading(false);
  };

  const useCheck = (): boolean => {
    if (remainingChecks <= 0) return false;

    const clientId = getClientIdentifier();
    const storageKey = `aiDetectionUsage_${clientId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const data: IPUsageData = JSON.parse(stored);
        const newData: IPUsageData = {
          ...data,
          checks_used: data.checks_used + 1,
          total_checks: 3 // Ensure total_checks is always 3
        };
        localStorage.setItem(storageKey, JSON.stringify(newData));
        
        // Update remaining checks after successful storage
        const newRemaining = Math.max(0, 3 - newData.checks_used);
        setRemainingChecks(newRemaining);
        return true;
      } catch (error) {
        console.error('Error updating usage data:', error);
        return false;
      }
    }
    return false;
  };

  // Function to get current usage for account creation
  const getCurrentUsage = (): { used: number; remaining: number } => {
    const clientId = getClientIdentifier();
    const storageKey = `aiDetectionUsage_${clientId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        const data: IPUsageData = JSON.parse(stored);
        return {
          used: data.checks_used,
          remaining: Math.max(0, 3 - data.checks_used)
        };
      } catch (error) {
        console.error('Error reading usage data:', error);
      }
    }
    
    return { used: 0, remaining: 3 };
  };

  return {
    remainingChecks,
    totalChecks: 3,
    useCheck,
    loading,
    getCurrentUsage
  };
};


import { useAuth } from '@/contexts/AuthContext';
import { useSecureUsageTracking } from './useSecureUsageTracking';
import { useIPUsageTracking } from './useIPUsageTracking';

export const useUsageTracking = () => {
  const { user } = useAuth();
  const secureTracking = useSecureUsageTracking();
  const ipTracking = useIPUsageTracking();

  // Use secure tracking for authenticated users, IP tracking for anonymous
  if (user) {
    return secureTracking;
  }

  return {
    ...ipTracking,
    error: null,
    refreshUsage: () => {} // IP tracking doesn't need manual refresh
  };
};

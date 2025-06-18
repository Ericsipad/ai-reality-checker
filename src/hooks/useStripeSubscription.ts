
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: string | null;
  subscription_end: string | null;
  remaining_checks: number;
}

export const useStripeSubscription = () => {
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    subscribed: false,
    subscription_tier: null,
    subscription_end: null,
    remaining_checks: 0
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      setSubscriptionData({
        subscribed: false,
        subscription_tier: null,
        subscription_end: null,
        remaining_checks: 0
      });
      setLoading(false);
    }
  }, [user]);

  // Check for success/cancel URL parameters and refresh subscription status
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    
    if (success === 'true' && user) {
      // Payment was successful, wait a bit for webhook processing then check subscription
      console.log('Payment success detected, refreshing subscription status...');
      toast({
        title: "Payment successful!",
        description: "Your account is being updated...",
      });
      
      // Wait 3 seconds for webhook to process, then check subscription
      setTimeout(() => {
        checkSubscription();
      }, 3000);
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (canceled === 'true') {
      toast({
        title: "Payment canceled",
        description: "Your payment was canceled.",
        variant: "destructive",
      });
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [user, toast]);

  const checkSubscription = async () => {
    if (!user) return;

    try {
      console.log('Checking subscription status...');
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      const remainingChecks = typeof data.remaining_checks === 'number' 
        ? data.remaining_checks 
        : 0;

      console.log('Subscription data received:', data);
      
      setSubscriptionData({
        subscribed: data.subscribed || false,
        subscription_tier: data.subscription_tier || null,
        subscription_end: data.subscription_end || null,
        remaining_checks: remainingChecks
      });

      // Show toast if user has checks after a purchase
      if (remainingChecks > 0 && data.subscription_tier === 'pay-per-use') {
        toast({
          title: "Checks added!",
          description: `You now have ${remainingChecks} checks remaining.`,
        });
      }
    } catch (error) {
      console.error('Error in checkSubscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCheckout = async (plan: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to purchase a subscription.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan }
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('Redirecting to checkout:', data.url);

      // For mobile, use window.location.href instead of window.open
      if (window.innerWidth <= 768) {
        window.location.href = data.url;
      } else {
        window.open(data.url, '_blank');
      }

      // Set up a listener for when the user returns to check their subscription
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          // User returned to the tab, check subscription after a short delay
          console.log('User returned to tab, checking subscription...');
          setTimeout(() => {
            checkSubscription();
          }, 2000);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Clean up the listener after 5 minutes
      setTimeout(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }, 300000);

    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Checkout failed",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openCustomerPortal = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) {
        if (error.message?.includes("not configured")) {
          toast({
            title: "Customer Portal Setup Required",
            description: "The billing portal is being set up. Please contact support for subscription management.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(error.message);
      }

      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: "Portal access failed",
        description: "Failed to open customer portal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const useCheck = (): boolean => {
    if (!user) return false;

    // Unlimited for active subscriptions
    if (subscriptionData.subscribed) return true;

    // Check remaining pay-per-use checks
    if (subscriptionData.remaining_checks <= 0) return false;

    // Update database first, then update local state on success
    updateChecksInDatabase();
    
    return true;
  };

  const updateChecksInDatabase = async () => {
    if (!user) return;

    try {
      const newRemainingChecks = Math.max(0, subscriptionData.remaining_checks - 1);
      
      const { error } = await supabase
        .from('subscribers')
        .update({
          remaining_checks: newRemainingChecks
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating checks:', error);
      } else {
        // Update local state only after successful database update
        setSubscriptionData(prev => ({
          ...prev,
          remaining_checks: newRemainingChecks
        }));
      }
    } catch (error) {
      console.error('Error in updateChecksInDatabase:', error);
    }
  };

  return {
    ...subscriptionData,
    loading,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    useCheck
  };
};

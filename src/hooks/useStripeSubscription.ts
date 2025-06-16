
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
    remaining_checks: 5 // Default free checks for non-authenticated users
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      // For non-authenticated users, provide default free checks
      setSubscriptionData({
        subscribed: false,
        subscription_tier: null,
        subscription_end: null,
        remaining_checks: 5
      });
      setLoading(false);
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      // Ensure remaining_checks is always a number
      const remainingChecks = typeof data.remaining_checks === 'number' 
        ? data.remaining_checks 
        : 0;

      setSubscriptionData({
        subscribed: data.subscribed || false,
        subscription_tier: data.subscription_tier || null,
        subscription_end: data.subscription_end || null,
        remaining_checks: remainingChecks
      });
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

      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
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
        throw new Error(error.message);
      }

      // Open customer portal in a new tab
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
    if (!user) {
      // For non-authenticated users, use IP-based tracking
      const remaining = subscriptionData.remaining_checks;
      if (remaining <= 0) return false;

      setSubscriptionData(prev => ({
        ...prev,
        remaining_checks: Math.max(0, prev.remaining_checks - 1)
      }));
      
      return true;
    }

    // Unlimited for active subscriptions
    if (subscriptionData.subscribed) return true;

    // Check remaining pay-per-use checks
    const remaining = subscriptionData.remaining_checks;
    if (remaining <= 0) return false;

    // Update remaining checks optimistically
    setSubscriptionData(prev => ({
      ...prev,
      remaining_checks: Math.max(0, prev.remaining_checks - 1)
    }));

    // Update database
    updateChecksInDatabase();
    
    return true;
  };

  const updateChecksInDatabase = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('subscribers')
        .update({
          remaining_checks: Math.max(0, subscriptionData.remaining_checks - 1)
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating checks:', error);
        // Revert optimistic update on error
        setSubscriptionData(prev => ({
          ...prev,
          remaining_checks: prev.remaining_checks + 1
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

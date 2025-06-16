
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: string | null;
  subscription_end: string | null;
  remaining_checks: number | string;
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

      setSubscriptionData(data);
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
    if (!user) return false;

    // Unlimited for active subscriptions
    if (subscriptionData.subscribed) return true;

    // Check remaining pay-per-use checks
    const remaining = typeof subscriptionData.remaining_checks === 'number' 
      ? subscriptionData.remaining_checks 
      : 0;

    if (remaining <= 0) return false;

    // Update remaining checks optimistically
    setSubscriptionData(prev => ({
      ...prev,
      remaining_checks: Math.max(0, (typeof prev.remaining_checks === 'number' ? prev.remaining_checks : 0) - 1)
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
          remaining_checks: Math.max(0, (typeof subscriptionData.remaining_checks === 'number' ? subscriptionData.remaining_checks : 0) - 1)
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating checks:', error);
        // Revert optimistic update on error
        setSubscriptionData(prev => ({
          ...prev,
          remaining_checks: (typeof prev.remaining_checks === 'number' ? prev.remaining_checks : 0) + 1
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

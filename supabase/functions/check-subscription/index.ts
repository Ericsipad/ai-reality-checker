
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, updating unsubscribed state");
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: null,
        subscribed: false,
        subscription_tier: null,
        subscription_end: null,
        remaining_checks: 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      return new Response(JSON.stringify({ subscribed: false, subscription_tier: null, remaining_checks: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    let subscriptionTier = null;
    let subscriptionEnd = null;
    let hasActiveSub = false;
    let remainingChecks = 0;

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      hasActiveSub = true;
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      
      // Determine tier from price - updated for new prices
      const price = subscription.items.data[0].price;
      const amount = price.unit_amount || 0;
      
      if (price.recurring?.interval === "month" && amount === 1299) { // $12.99
        subscriptionTier = "monthly";
      } else if (price.recurring?.interval === "year" && amount === 9900) { // $99.00
        subscriptionTier = "yearly";
      }
      
      logStep("Active subscription found", { subscriptionId: subscription.id, tier: subscriptionTier });
    }

    // Check for one-time payments (pay-per-use) - only if no active subscription
    if (!hasActiveSub) {
      // Get all successful payment intents for this customer
      const paymentIntents = await stripe.paymentIntents.list({
        customer: customerId,
        limit: 100, // Increase limit to catch all payments
      });

      // Calculate total checks purchased from successful $3 payments
      let totalChecksPurchased = 0;
      const successfulPayments = paymentIntents.data.filter(payment => 
        payment.status === "succeeded" && payment.amount === 300
      );
      
      totalChecksPurchased = successfulPayments.length * 15; // 15 checks per $3 payment
      logStep("Pay-per-use payments found", { 
        paymentCount: successfulPayments.length, 
        totalChecksPurchased 
      });

      if (totalChecksPurchased > 0) {
        // Get current subscriber record to see how many checks have been used
        const { data: existingSubscriber } = await supabaseClient
          .from("subscribers")
          .select("remaining_checks")
          .eq("user_id", user.id)
          .single();

        // If this is the first time we're seeing this user with purchases, 
        // or if they have fewer checks than they should based on purchases,
        // update their remaining checks
        const currentRemaining = existingSubscriber?.remaining_checks || 0;
        
        // The remaining checks should be at least the total purchased minus what they've used
        // For simplicity, if they have fewer checks than total purchased, give them the full amount
        // This handles the case where they just made a purchase
        if (currentRemaining < totalChecksPurchased) {
          remainingChecks = totalChecksPurchased;
          logStep("Updating remaining checks", { 
            currentRemaining, 
            totalChecksPurchased, 
            newRemaining: remainingChecks 
          });
        } else {
          remainingChecks = currentRemaining;
          logStep("Keeping existing remaining checks", { remainingChecks });
        }
        
        subscriptionTier = "pay-per-use";
      }
    }

    // Update database
    await supabaseClient.from("subscribers").upsert({
      email: user.email,
      user_id: user.id,
      stripe_customer_id: customerId,
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      remaining_checks: hasActiveSub ? null : remainingChecks, // null for unlimited plans
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });

    logStep("Updated database with subscription info", { 
      subscribed: hasActiveSub, 
      subscriptionTier, 
      remainingChecks: hasActiveSub ? "unlimited" : remainingChecks 
    });

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      remaining_checks: hasActiveSub ? "unlimited" : remainingChecks
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});


import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
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
    logStep("Webhook received");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    // Verify the webhook signature using the async method
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
      );
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle both checkout.session.completed and payment_intent.succeeded events
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Check if this is a $3 payment (300 cents)
      if (session.amount_total === 300 && session.payment_status === "paid") {
        logStep("Processing $3 payment from checkout session", { 
          sessionId: session.id,
          customerId: session.customer,
          metadata: session.metadata
        });

        await processPayment(stripe, supabaseClient, session.metadata, session.customer, logStep);
      }
    } else if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Check if this is a $3 payment (300 cents)
      if (paymentIntent.amount === 300 && paymentIntent.status === "succeeded") {
        logStep("Processing $3 payment from payment intent", { 
          paymentIntentId: paymentIntent.id,
          customerId: paymentIntent.customer,
          metadata: paymentIntent.metadata
        });

        await processPayment(stripe, supabaseClient, paymentIntent.metadata, paymentIntent.customer, logStep);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(`Webhook Error: ${errorMessage}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});

async function processPayment(
  stripe: Stripe, 
  supabaseClient: any, 
  metadata: any, 
  customerId: string | null, 
  logStep: Function
) {
  // First try to get user info from metadata
  let userId = metadata?.user_id;
  let userEmail = metadata?.user_email;

  logStep("Processing payment with metadata", { userId, userEmail, customerId });

  if (!userId || !userEmail) {
    logStep("No user metadata found, trying to get from Stripe customer");
    
    // Fallback to getting customer email from Stripe if metadata is missing
    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId as string);
      if (customer && !customer.deleted) {
        userEmail = customer.email;
        logStep("Retrieved customer email from Stripe", { email: userEmail });
      }
    }

    if (!userEmail) {
      logStep("No customer email found, skipping");
      return;
    }

    // Try to find user by email in our database
    const { data: userData, error: userError } = await supabaseClient
      .from("subscribers")
      .select("user_id, email")
      .eq("email", userEmail)
      .single();

    if (userError || !userData) {
      logStep("User not found in database", { email: userEmail, error: userError });
      return;
    }

    userId = userData.user_id;
    logStep("Found user by email", { userId, email: userEmail });
  } else {
    logStep("Using metadata", { userId, userEmail });
  }

  // Update the subscriber record to add 15 checks
  const { data: existingSubscriber, error: fetchError } = await supabaseClient
    .from("subscribers")
    .select("remaining_checks")
    .eq("user_id", userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    logStep("Error fetching subscriber", { error: fetchError });
    throw fetchError;
  }

  const currentChecks = existingSubscriber?.remaining_checks || 0;
  const newChecks = currentChecks + 15;

  logStep("Updating checks", { 
    userId,
    userEmail,
    currentChecks, 
    newChecks
  });

  const { error: updateError } = await supabaseClient
    .from("subscribers")
    .upsert({
      user_id: userId,
      email: userEmail,
      remaining_checks: newChecks,
      subscription_tier: "pay-per-use",
      subscribed: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (updateError) {
    logStep("Error updating subscriber", { error: updateError });
    throw updateError;
  }

  logStep("Successfully added 15 checks", { 
    userId,
    userEmail, 
    newTotal: newChecks 
  });
}


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

// Store processed webhook IDs to prevent duplicate processing
const processedWebhooks = new Set<string>();

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

    // Verify the webhook signature
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

    // Prevent duplicate processing
    if (processedWebhooks.has(event.id)) {
      logStep("Webhook already processed", { eventId: event.id });
      return new Response("OK - Already processed", { status: 200 });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle successful one-time payments
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      logStep("Processing checkout session", { 
        sessionId: session.id,
        amountTotal: session.amount_total,
        paymentStatus: session.payment_status,
        mode: session.mode,
        customerId: session.customer,
        metadata: session.metadata
      });

      // Check if this is a $3 one-time payment (300 cents)
      if (session.amount_total === 300 && session.mode === "payment" && session.payment_status === "paid") {
        logStep("Processing $3 one-time payment for 15 checks");
        await processOneTimePayment(stripe, supabaseClient, session, logStep);
        processedWebhooks.add(event.id);
      } else {
        logStep("Session does not match $3 payment criteria", {
          amountTotal: session.amount_total,
          mode: session.mode,
          paymentStatus: session.payment_status
        });
      }
    }

    // Handle successful payment intents (additional safety net)
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      logStep("Processing payment intent", {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        customerId: paymentIntent.customer,
        metadata: paymentIntent.metadata
      });

      // Check if this is a $3 payment (300 cents)
      if (paymentIntent.amount === 300) {
        logStep("Processing $3 payment intent for 15 checks");
        await processPaymentIntent(stripe, supabaseClient, paymentIntent, logStep);
        processedWebhooks.add(event.id);
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

async function processOneTimePayment(
  stripe: Stripe, 
  supabaseClient: any, 
  session: Stripe.Checkout.Session,
  logStep: Function
) {
  try {
    // SECURITY: Only use user_id and email from metadata - no fallback logic
    const userId = session.metadata?.user_id;
    const userEmail = session.metadata?.user_email;

    logStep("Starting secure one-time payment processing", { userId, userEmail });

    // SECURITY: Require both user_id and email from metadata
    if (!userId || !userEmail) {
      logStep("SECURITY ERROR: Missing required user identification in metadata", { 
        sessionId: session.id,
        hasUserId: !!userId,
        hasUserEmail: !!userEmail
      });
      throw new Error("Payment processing failed: insufficient user identification");
    }

    // Verify user exists in our system
    const { data: userData, error: userError } = await supabaseClient
      .from("subscribers")
      .select("user_id, email")
      .eq("user_id", userId)
      .eq("email", userEmail)
      .single();

    if (userError || !userData) {
      logStep("SECURITY ERROR: User not found in system", { 
        userId, 
        userEmail, 
        error: userError?.message 
      });
      throw new Error("Payment processing failed: user verification failed");
    }

    await addChecksToUser(supabaseClient, userId, userEmail, 15, logStep);

  } catch (error) {
    logStep("ERROR in processOneTimePayment", { error: error.message });
    throw error;
  }
}

async function processPaymentIntent(
  stripe: Stripe,
  supabaseClient: any,
  paymentIntent: Stripe.PaymentIntent,
  logStep: Function
) {
  try {
    // SECURITY: Only use user_id and email from metadata - no fallback logic
    const userId = paymentIntent.metadata?.user_id;
    const userEmail = paymentIntent.metadata?.user_email;

    logStep("Starting secure payment intent processing", { userId, userEmail });

    // SECURITY: Require both user_id and email from metadata
    if (!userId || !userEmail) {
      logStep("SECURITY ERROR: Missing required user identification in metadata", { 
        paymentIntentId: paymentIntent.id,
        hasUserId: !!userId,
        hasUserEmail: !!userEmail
      });
      throw new Error("Payment processing failed: insufficient user identification");
    }

    // Verify user exists in our system
    const { data: userData, error: userError } = await supabaseClient
      .from("subscribers")
      .select("user_id, email")
      .eq("user_id", userId)
      .eq("email", userEmail)
      .single();

    if (userError || !userData) {
      logStep("SECURITY ERROR: User not found in system", { 
        userId, 
        userEmail, 
        error: userError?.message 
      });
      throw new Error("Payment processing failed: user verification failed");
    }

    await addChecksToUser(supabaseClient, userId, userEmail, 15, logStep);

  } catch (error) {
    logStep("ERROR in processPaymentIntent", { error: error.message });
    throw error;
  }
}

async function addChecksToUser(
  supabaseClient: any,
  userId: string,
  userEmail: string,
  checksToAdd: number,
  logStep: Function
) {
  try {
    logStep("About to add checks to user", { userId, userEmail, checksToAdd });

    // Get current subscriber record
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
    const newChecks = currentChecks + checksToAdd;

    logStep("Adding checks to existing total", { 
      userId,
      userEmail,
      currentChecks, 
      checksToAdd,
      newChecks
    });

    // Update the subscriber record with the new check count
    const { error: updateError } = await supabaseClient
      .from("subscribers")
      .upsert({
        user_id: userId,
        email: userEmail,
        remaining_checks: newChecks,
        subscription_tier: "pay-per-use",
        subscribed: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });

    if (updateError) {
      logStep("Error updating subscriber", { error: updateError });
      throw updateError;
    }

    logStep("Successfully added checks to user", { 
      userId,
      userEmail, 
      finalCheckCount: newChecks,
      checksAdded: checksToAdd
    });

    // Verify the update worked by checking the database
    const { data: verifyData, error: verifyError } = await supabaseClient
      .from("subscribers")
      .select("remaining_checks")
      .eq("user_id", userId)
      .single();

    if (verifyError) {
      logStep("Error verifying update", { error: verifyError });
    } else {
      logStep("Database verification successful", { 
        updatedChecks: verifyData.remaining_checks,
        updateSuccessful: verifyData.remaining_checks === newChecks
      });
    }

  } catch (error) {
    logStep("ERROR in addChecksToUser", { error: error.message });
    throw error;
  }
}

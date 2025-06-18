
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

    // Handle checkout.session.completed for $3 pay-per-use payments
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      logStep("Processing checkout session", { 
        sessionId: session.id,
        amountTotal: session.amount_total,
        paymentStatus: session.payment_status,
        mode: session.mode,
        metadata: session.metadata
      });

      // Check if this is a $3 payment (300 cents) and mode is payment
      if (session.amount_total === 300 && session.mode === "payment" && session.payment_status === "paid") {
        logStep("Processing $3 one-time payment", { 
          sessionId: session.id,
          customerId: session.customer,
          metadata: session.metadata
        });

        await processPayPerUsePayment(stripe, supabaseClient, session, logStep);
      } else {
        logStep("Session does not match pay-per-use criteria", {
          amountTotal: session.amount_total,
          mode: session.mode,
          paymentStatus: session.payment_status
        });
      }
    } else {
      logStep("Event type not handled", { eventType: event.type });
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

async function processPayPerUsePayment(
  stripe: Stripe, 
  supabaseClient: any, 
  session: Stripe.Checkout.Session,
  logStep: Function
) {
  // Get user info from metadata first
  let userId = session.metadata?.user_id;
  let userEmail = session.metadata?.user_email;

  logStep("Starting payment processing", { userId, userEmail, customerId: session.customer });

  // If no metadata, try to get email from Stripe customer
  if (!userEmail && session.customer) {
    try {
      const customer = await stripe.customers.retrieve(session.customer as string);
      if (customer && !customer.deleted) {
        userEmail = customer.email;
        logStep("Retrieved customer email from Stripe", { email: userEmail });
      }
    } catch (err) {
      logStep("Error retrieving customer from Stripe", { error: err.message });
    }
  }

  if (!userEmail) {
    logStep("No customer email found, cannot process payment");
    return;
  }

  // If no userId in metadata, look up user by email in our database
  if (!userId) {
    const { data: userData, error: userError } = await supabaseClient
      .from("subscribers")
      .select("user_id, email")
      .eq("email", userEmail)
      .single();

    if (userError || !userData) {
      logStep("User not found in database by email", { email: userEmail, error: userError });
      return;
    }

    userId = userData.user_id;
    logStep("Found user by email lookup", { userId, email: userEmail });
  }

  // Now we have both userId and userEmail, proceed with crediting checks
  logStep("About to credit checks", { userId, userEmail });

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
  const newChecks = currentChecks + 15;

  logStep("Crediting 15 checks", { 
    userId,
    userEmail,
    currentChecks, 
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
      stripe_customer_id: session.customer,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (updateError) {
    logStep("Error updating subscriber", { error: updateError });
    throw updateError;
  }

  logStep("Successfully credited 15 checks", { 
    userId,
    userEmail, 
    finalCheckCount: newChecks,
    stripeSessionId: session.id
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
    logStep("Database verification", { 
      updatedChecks: verifyData.remaining_checks,
      updateSuccessful: verifyData.remaining_checks === newChecks
    });
  }
}

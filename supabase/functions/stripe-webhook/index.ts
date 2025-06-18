
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

    // Verify the webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
      );
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle the payment_intent.succeeded event for pay-per-use purchases
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Check if this is a $3 payment (300 cents)
      if (paymentIntent.amount === 300 && paymentIntent.status === "succeeded") {
        logStep("Processing $3 payment", { 
          paymentIntentId: paymentIntent.id,
          customerId: paymentIntent.customer 
        });

        // Get customer email from Stripe
        let customerEmail = null;
        if (paymentIntent.customer) {
          const customer = await stripe.customers.retrieve(paymentIntent.customer as string);
          if (customer && !customer.deleted) {
            customerEmail = customer.email;
          }
        }

        if (!customerEmail) {
          logStep("No customer email found, skipping");
          return new Response("OK", { status: 200 });
        }

        logStep("Found customer email", { email: customerEmail });

        // Update the subscriber record to add 15 checks
        const { data: existingSubscriber, error: fetchError } = await supabaseClient
          .from("subscribers")
          .select("remaining_checks")
          .eq("email", customerEmail)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          logStep("Error fetching subscriber", { error: fetchError });
          throw fetchError;
        }

        const currentChecks = existingSubscriber?.remaining_checks || 0;
        const newChecks = currentChecks + 15;

        logStep("Updating checks", { 
          currentChecks, 
          newChecks, 
          email: customerEmail 
        });

        const { error: updateError } = await supabaseClient
          .from("subscribers")
          .upsert({
            email: customerEmail,
            remaining_checks: newChecks,
            subscription_tier: "pay-per-use",
            subscribed: false,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'email' });

        if (updateError) {
          logStep("Error updating subscriber", { error: updateError });
          throw updateError;
        }

        logStep("Successfully added 15 checks", { 
          email: customerEmail, 
          newTotal: newChecks 
        });
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

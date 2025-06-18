
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { plan } = await req.json();
    if (!plan) throw new Error("Plan is required");
    logStep("Plan selected", { plan });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("Creating new customer");
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    let sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      success_url: `${origin}/?success=true`,
      cancel_url: `${origin}/?canceled=true`,
      metadata: {
        user_id: user.id,
        user_email: user.email,
      },
    };

    // Configure based on plan
    if (plan === "pay-per-use") {
      sessionConfig = {
        ...sessionConfig,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: "15 AI Detection Checks" },
              unit_amount: 300, // $3.00 in cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: { 
          ...sessionConfig.metadata,
          plan: "pay-per-use", 
          checks: "15" 
        },
      };
    } else if (plan === "monthly") {
      sessionConfig = {
        ...sessionConfig,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: "Monthly Unlimited AI Detection" },
              unit_amount: 1299, // $12.99 in cents
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        metadata: { 
          ...sessionConfig.metadata,
          plan: "monthly" 
        },
      };
    } else if (plan === "yearly") {
      sessionConfig = {
        ...sessionConfig,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: "Yearly Unlimited AI Detection" },
              unit_amount: 9900, // $99.00 in cents
              recurring: { interval: "year" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        metadata: { 
          ...sessionConfig.metadata,
          plan: "yearly" 
        },
      };
    } else {
      throw new Error("Invalid plan selected");
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    logStep("Checkout session created", { sessionId: session.id, url: session.url, metadata: sessionConfig.metadata });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

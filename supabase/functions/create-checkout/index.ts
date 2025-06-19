
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

    // Get client IP address from request headers
    const clientIP = req.headers.get("x-forwarded-for") || 
                     req.headers.get("x-real-ip") || 
                     req.headers.get("cf-connecting-ip") ||
                     "unknown";
    logStep("Client IP detected", { clientIP });

    const { plan } = await req.json();
    logStep("Plan selected", { plan });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      logStep("Creating new customer");
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id
        }
      });
      customerId = customer.id;
      logStep("Customer created", { customerId });
    }

    let sessionConfig;
    
    if (plan === "pay-per-use") {
      // One-time payment for 15 checks
      sessionConfig = {
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "15 AI Detection Checks",
                description: "One-time purchase of 15 AI detection checks"
              },
              unit_amount: 300, // $3.00 in cents
            },
            quantity: 1,
          },
        ],
        mode: "payment" as const,
        metadata: {
          user_id: user.id,
          user_email: user.email,
          plan: "pay-per-use",
          checks: "15",
          client_ip: clientIP // Store IP address for webhook matching
        },
        success_url: `${req.headers.get("origin")}/?success=true`,
        cancel_url: `${req.headers.get("origin")}/?canceled=true`,
      };
    } else if (plan === "monthly") {
      // Monthly subscription
      sessionConfig = {
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Monthly AI Detection Plan",
                description: "Unlimited AI detection checks per month"
              },
              unit_amount: 1299, // $12.99 in cents
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription" as const,
        metadata: {
          user_id: user.id,
          user_email: user.email,
          plan: "monthly"
        },
        success_url: `${req.headers.get("origin")}/?success=true`,
        cancel_url: `${req.headers.get("origin")}/?canceled=true`,
      };
    } else if (plan === "yearly") {
      // Yearly subscription
      sessionConfig = {
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Yearly AI Detection Plan",
                description: "Unlimited AI detection checks per year"
              },
              unit_amount: 9900, // $99.00 in cents
              recurring: { interval: "year" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription" as const,
        metadata: {
          user_id: user.id,
          user_email: user.email,
          plan: "yearly"
        },
        success_url: `${req.headers.get("origin")}/?success=true`,
        cancel_url: `${req.headers.get("origin")}/?canceled=true`,
      };
    } else {
      throw new Error(`Invalid plan: ${plan}`);
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    logStep("Checkout session created", { 
      sessionId: session.id, 
      url: session.url,
      metadata: session.metadata
    });

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

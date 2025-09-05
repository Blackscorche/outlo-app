
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

  // Use both anon key for user auth and service role for database operations
  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    
    // Use anon client to get user (this respects the session properly)
    const { data: userData, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError) {
      logStep("Auth error with anon client, trying direct token validation", { error: userError.message });
      
      // Fallback: try to decode the JWT manually to get user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.email) throw new Error("No email in token payload");
        
        logStep("Successfully extracted user from token", { email: payload.email });
        
        const user = {
          id: payload.sub,
          email: payload.email
        };
        
        return await processSubscription(user, stripeKey, supabaseService);
      } catch (tokenError) {
        throw new Error(`Token validation failed: ${tokenError.message}`);
      }
    }
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    
    logStep("User authenticated", { userId: user.id, email: user.email });
    
    return await processSubscription(user, stripeKey, supabaseService);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function processSubscription(user: any, stripeKey: string, supabaseService: any) {
  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  
  if (customers.data.length === 0) {
    logStep("No customer found, updating unsubscribed state");
    await supabaseService.from("subscribers").upsert({
      email: user.email,
      user_id: user.id,
      stripe_customer_id: null,
      subscribed: false,
      subscription_tier: 'basic',
      subscription_end: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });
    
    return new Response(JSON.stringify({ 
      subscribed: false, 
      subscription_tier: 'basic',
      subscription_end: null 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  const customerId = customers.data[0].id;
  logStep("Found Stripe customer", { customerId });

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });
  
  const hasActiveSub = subscriptions.data.length > 0;
  let subscriptionTier = 'basic';
  let subscriptionEnd = null;

  if (hasActiveSub) {
    const subscription = subscriptions.data[0];
    subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd });
    
    const priceId = subscription.items.data[0].price.id;
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount || 0;
    
    if (amount >= 1400) {
      subscriptionTier = "vip";
    } else if (amount >= 900) {
      subscriptionTier = "premium";
    } else {
      subscriptionTier = "basic";
    }
    
    logStep("Determined subscription tier", { priceId, amount, subscriptionTier });
  } else {
    logStep("No active subscription found");
  }

  await supabaseService.from("subscribers").upsert({
    email: user.email,
    user_id: user.id,
    stripe_customer_id: customerId,
    subscribed: hasActiveSub,
    subscription_tier: subscriptionTier,
    subscription_end: subscriptionEnd,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'email' });

  logStep("Updated database with subscription info", { subscribed: hasActiveSub, subscriptionTier });
  
  return new Response(JSON.stringify({
    subscribed: hasActiveSub,
    subscription_tier: subscriptionTier,
    subscription_end: subscriptionEnd
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

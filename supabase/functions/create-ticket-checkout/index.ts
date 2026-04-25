// =============================================================================
// Outlo: create-ticket-checkout
// =============================================================================
// Creates a Stripe Checkout Session for a paid activity ticket.
// Returns { url } that the client opens via expo-web-browser.
//
// Flow:
//  1. Authenticate user from JWT
//  2. Look up activity, verify it's paid + has spots left
//  3. Create a pending ticket row (so we can correlate via metadata)
//  4. Build a Stripe one-time Checkout Session with platform fee math
//  5. Return URL to client
//
// Confirmation/insertion of `activity_participants` happens in `stripe-webhook`
// when Stripe fires `checkout.session.completed`.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_BPS = 1000; // 10%
const APP_DEEP_LINK = "lovemap://"; // matches `scheme` in app.json

const log = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[create-ticket-checkout] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ------------------- Auth -------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(
      token,
    );
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const user = userData.user;

    // ------------------- Body -------------------
    const { activity_id } = await req.json();
    if (!activity_id) throw new Error("activity_id is required");

    // ------------------- Activity lookup --------
    const { data: activity, error: actErr } = await supabaseAdmin
      .from("activities")
      .select(
        "id, title, image_url, is_paid, ticket_price_cents, currency, max_participants, current_participants, status, creator_id",
      )
      .eq("id", activity_id)
      .single();
    if (actErr || !activity) throw new Error("Activity not found");

    if (!activity.is_paid) {
      throw new Error("This activity is free; no ticket required");
    }
    if (activity.creator_id === user.id) {
      throw new Error("You cannot buy a ticket to your own activity");
    }
    if (
      activity.status !== "published" &&
      activity.status !== "open"
    ) {
      throw new Error("Activity is not available");
    }
    if (
      typeof activity.max_participants === "number" &&
      typeof activity.current_participants === "number" &&
      activity.current_participants >= activity.max_participants
    ) {
      throw new Error("Activity is sold out");
    }

    // Check for existing paid ticket by this buyer
    const { data: existing } = await supabaseAdmin
      .from("activity_tickets")
      .select("id, payment_status")
      .eq("activity_id", activity.id)
      .eq("buyer_id", user.id)
      .eq("payment_status", "paid")
      .maybeSingle();
    if (existing) {
      throw new Error("You already have a ticket for this activity");
    }

    // ------------------- Money math -------------
    const grossCents = activity.ticket_price_cents ?? 0;
    if (grossCents <= 0) throw new Error("Invalid ticket price");
    const platformFeeCents = Math.round((grossCents * PLATFORM_FEE_BPS) / 10000);
    const creatorPayoutCents = grossCents - platformFeeCents;
    const currency = (activity.currency || "EUR").toLowerCase();

    // ------------------- Create pending ticket --
    const { data: ticket, error: insErr } = await supabaseAdmin
      .from("activity_tickets")
      .insert({
        activity_id: activity.id,
        buyer_id: user.id,
        gross_amount_cents: grossCents,
        platform_fee_cents: platformFeeCents,
        creator_payout_cents: creatorPayoutCents,
        currency: currency.toUpperCase(),
        payment_status: "pending",
        booking_status: "pending",
      })
      .select("id, ticket_code")
      .single();
    if (insErr || !ticket) throw insErr || new Error("Failed to create ticket");

    log("Created pending ticket", { ticketId: ticket.id });

    // ------------------- Stripe ----------------
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: activity.title,
              ...(activity.image_url ? { images: [activity.image_url] } : {}),
              description: "Outlo ticket purchase",
            },
            unit_amount: grossCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: {
          ticket_id: ticket.id,
          activity_id: activity.id,
          buyer_id: user.id,
        },
      },
      metadata: {
        ticket_id: ticket.id,
        activity_id: activity.id,
        buyer_id: user.id,
      },
      success_url: `${APP_DEEP_LINK}ticket-success?ticket_id=${ticket.id}`,
      cancel_url: `${APP_DEEP_LINK}ticket-cancel?ticket_id=${ticket.id}`,
    });

    // Save the session id on the ticket for later correlation
    await supabaseAdmin
      .from("activity_tickets")
      .update({ stripe_session_id: session.id })
      .eq("id", ticket.id);

    log("Checkout session created", { sessionId: session.id });

    return new Response(
      JSON.stringify({ url: session.url, ticket_id: ticket.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

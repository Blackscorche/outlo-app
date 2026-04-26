// =============================================================================
// Outlo: process-ticket-purchase
// =============================================================================
// Processes a ticket purchase AFTER the client has completed an IAP purchase.
// Validates the transaction and creates the ticket record with participant.
//
// Pattern modeled after process-boost-purchase.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_FEE_BPS = 1000; // 10%

const TICKET_CONFIG = {
  "outlo_ticket_5": { cents: 500 },
  "outlo_ticket_10": { cents: 1000 },
  "outlo_ticket_15": { cents: 1500 },
  "outlo_ticket_20": { cents: 2000 },
  "outlo_ticket_25": { cents: 2500 },
  "outlo_ticket_50": { cents: 5000 },
};

const log = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[process-ticket-purchase] ${step}${detailsStr}`);
};

serve(async (req: Request) => {
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

    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(
      token,
    );
    if (userErr || !userData.user) throw new Error("Not authenticated");
    const user = userData.user;

    // ---- Body ----
    const {
      activity_id,
      product_id,
      transaction_id,
      purchase_token,
      platform,
    } = await req.json();

    if (!activity_id || !product_id || !transaction_id) {
      throw new Error("Missing required fields");
    }

    // ---- Validate product ----
    const ticketConfig = TICKET_CONFIG[product_id as keyof typeof TICKET_CONFIG];
    if (!ticketConfig) throw new Error("Invalid ticket product");

    // ---- Activity lookup ----
    const { data: activity, error: actErr } = await supabaseAdmin
      .from("activities")
      .select("id, title, is_paid, ticket_price_cents, currency, max_participants, current_participants, status, creator_id")
      .eq("id", activity_id)
      .single();
    if (actErr || !activity) throw new Error("Activity not found");

    if (!activity.is_paid) {
      throw new Error("This activity is free; no ticket required");
    }
    if (activity.creator_id === user.id) {
      throw new Error("You cannot buy a ticket to your own activity");
    }
    if (activity.status !== "published" && activity.status !== "open") {
      throw new Error("Activity is not available");
    }
    if (
      typeof activity.max_participants === "number" &&
      typeof activity.current_participants === "number" &&
      activity.current_participants >= activity.max_participants
    ) {
      throw new Error("Activity is sold out");
    }

    // ---- Idempotency: check if already processed ----
    const { data: existing } = await supabaseAdmin
      .from("activity_tickets")
      .select("id, payment_status")
      .eq("iap_transaction_id", transaction_id)
      .maybeSingle();
    if (existing && existing.payment_status === "paid") {
      log("Already processed", { transaction_id });
      return new Response(
        JSON.stringify({ ok: true, already_processed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- TODO: validate IAP receipt with Apple/Google here ----
    // For now we accept the client-reported transaction id.

    // ---- Money math ----
    const grossCents = ticketConfig.cents;
    const platformFeeCents = Math.round((grossCents * PLATFORM_FEE_BPS) / 10000);
    const creatorPayoutCents = grossCents - platformFeeCents;
    const currency = (activity.currency || "EUR").toLowerCase();

    // ---- Create ticket record ----
    const { error: ticketErr } = await supabaseAdmin
      .from("activity_tickets")
      .insert({
        activity_id,
        buyer_id: user.id,
        gross_amount_cents: grossCents,
        platform_fee_cents: platformFeeCents,
        creator_payout_cents: creatorPayoutCents,
        currency: currency.toUpperCase(),
        payment_status: "paid",
        booking_status: "confirmed",
        iap_platform: platform === "ios" ? "ios" : "android",
        iap_product_id: product_id,
        iap_transaction_id: transaction_id,
        iap_purchase_token: purchase_token ?? null,
        paid_at: new Date().toISOString(),
      });
    if (ticketErr) throw ticketErr;

    // ---- Add participant ----
    const { data: existingParticipant } = await supabaseAdmin
      .from("activity_participants")
      .select("id, status")
      .eq("activity_id", activity_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingParticipant) {
      await supabaseAdmin
        .from("activity_participants")
        .update({ status: "joined", joined_at: new Date().toISOString() })
        .eq("id", existingParticipant.id);
    } else {
      await supabaseAdmin.from("activity_participants").insert({
        activity_id,
        user_id: user.id,
        status: "joined",
      });
    }

    // ---- Update participant count ----
    const { data: act } = await supabaseAdmin
      .from("activities")
      .select("current_participants, max_participants")
      .eq("id", activity_id)
      .single();
    if (act) {
      const next = (act.current_participants ?? 0) + 1;
      const updates: Record<string, unknown> = {
        current_participants: next,
        updated_at: new Date().toISOString(),
      };
      if (
        typeof act.max_participants === "number" &&
        next >= act.max_participants
      ) {
        updates.status = "full";
      }
      await supabaseAdmin
        .from("activities")
        .update(updates)
        .eq("id", activity_id);
    }

    log("Ticket purchase processed", { activity_id, transaction_id });

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", { message });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

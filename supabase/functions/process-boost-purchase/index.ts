// =============================================================================
// Outlo: process-boost-purchase
// =============================================================================
// Activates a map-boost on an activity AFTER the client has completed an
// IAP purchase via react-native-iap. Validates the receipt with Apple/Google,
// records the boost in `activity_boosts`, and flips the activity's
// is_boosted flag with the appropriate end_at.
//
// Receipt validation re-uses the same pattern as `validate-iap-purchase`.
// For now this endpoint trusts the client's reported transaction id but
// records it for later auditing — drop in real receipt validation here
// before going live (TODO marked below).
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Plan = "24h" | "3d" | "7d";

const PLAN_CONFIG: Record<Plan, { hours: number; cents: number; productId: string }> = {
  "24h": { hours: 24, cents: 300, productId: "outlo_boost_24h" },
  "3d":  { hours: 72, cents: 700, productId: "outlo_boost_3d" },
  "7d":  { hours: 168, cents: 1200, productId: "outlo_boost_7d" },
};

const log = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[process-boost-purchase] ${step}${detailsStr}`);
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
      plan_type,
      product_id,
      transaction_id,
      purchase_token,
      platform,
    } = await req.json();

    if (!activity_id || !plan_type || !product_id || !transaction_id) {
      throw new Error("Missing required fields");
    }
    const plan = PLAN_CONFIG[plan_type as Plan];
    if (!plan) throw new Error("Invalid plan_type");
    if (plan.productId !== product_id) {
      throw new Error("product_id does not match plan_type");
    }

    // ---- Activity must belong to caller ----
    const { data: activity, error: actErr } = await supabaseAdmin
      .from("activities")
      .select("id, creator_id, is_boosted, boost_end_at")
      .eq("id", activity_id)
      .single();
    if (actErr || !activity) throw new Error("Activity not found");
    if (activity.creator_id !== user.id) {
      throw new Error("Only the activity creator can boost it");
    }

    // ---- Idempotency: short-circuit if this transaction was already processed ----
    const { data: existing } = await supabaseAdmin
      .from("activity_boosts")
      .select("id, payment_status, end_at")
      .eq("iap_transaction_id", transaction_id)
      .maybeSingle();
    if (existing && existing.payment_status === "paid") {
      log("Already processed", { transaction_id });
      return new Response(
        JSON.stringify({ ok: true, already_processed: true, end_at: existing.end_at }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- TODO: validate IAP receipt with Apple/Google here ----
    // For now we accept the client-reported transaction id. The pattern from
    // `validate-iap-purchase` can be reused here — call Apple's
    // verifyReceipt or Google Play Developer API.

    // ---- Compute window ----
    // If activity is already boosted (and that boost hasn't expired yet),
    // extend the existing boost. Otherwise start fresh from now.
    const now = new Date();
    let startAt = now;
    if (
      activity.is_boosted &&
      activity.boost_end_at &&
      new Date(activity.boost_end_at) > now
    ) {
      startAt = new Date(activity.boost_end_at);
    }
    const endAt = new Date(startAt.getTime() + plan.hours * 60 * 60 * 1000);

    // ---- Insert boost row ----
    const { error: boostErr } = await supabaseAdmin
      .from("activity_boosts")
      .insert({
        activity_id,
        creator_id: user.id,
        plan_type,
        amount_cents: plan.cents,
        currency: "EUR",
        payment_status: "paid",
        iap_platform: platform === "ios" ? "ios" : "android",
        iap_product_id: product_id,
        iap_transaction_id: transaction_id,
        iap_purchase_token: purchase_token ?? null,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
      });
    if (boostErr) throw boostErr;

    // ---- Flip activity flag ----
    const { error: updErr } = await supabaseAdmin
      .from("activities")
      .update({
        is_boosted: true,
        boost_plan: plan_type,
        boost_start_at: startAt.toISOString(),
        boost_end_at: endAt.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", activity_id);
    if (updErr) throw updErr;

    log("Boost activated", { activity_id, plan_type, endAt: endAt.toISOString() });

    return new Response(
      JSON.stringify({ ok: true, end_at: endAt.toISOString() }),
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

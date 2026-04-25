// =============================================================================
// Outlo: stripe-webhook
// =============================================================================
// Receives Stripe events. We care about:
//   - checkout.session.completed       → mark ticket paid + add participant
//   - charge.refunded                  → mark ticket refunded + remove participant
//
// Setup (one-time):
//   1. Deploy this function: `supabase functions deploy stripe-webhook --no-verify-jwt`
//   2. In Stripe Dashboard → Developers → Webhooks, add:
//        URL: https://<project>.supabase.co/functions/v1/stripe-webhook
//        Events: checkout.session.completed, charge.refunded, charge.refund.updated
//   3. Copy the signing secret and set:
//        supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const log = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[stripe-webhook] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2023-10-16",
  });
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    log("Missing STRIPE_WEBHOOK_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // ------------------- Verify Stripe signature -------------------
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("No signature", { status: 400 });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
    );
  } catch (err) {
    log("Signature verification failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response("Bad signature", { status: 400 });
  }

  log("Event received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const ticketId = session.metadata?.ticket_id;
        const activityId = session.metadata?.activity_id;
        const buyerId = session.metadata?.buyer_id;

        if (!ticketId || !activityId || !buyerId) {
          log("Missing metadata", session.metadata);
          break;
        }

        // Mark ticket paid
        const { error: tErr } = await supabaseAdmin
          .from("activity_tickets")
          .update({
            payment_status: "paid",
            booking_status: "confirmed",
            stripe_payment_intent_id:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id ?? null,
            paid_at: new Date().toISOString(),
          })
          .eq("id", ticketId);
        if (tErr) throw tErr;

        // Add participant (or re-activate if previously left)
        const { data: existing } = await supabaseAdmin
          .from("activity_participants")
          .select("id, status")
          .eq("activity_id", activityId)
          .eq("user_id", buyerId)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from("activity_participants")
            .update({ status: "joined", joined_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabaseAdmin.from("activity_participants").insert({
            activity_id: activityId,
            user_id: buyerId,
            status: "joined",
          });
        }

        // Increment current_participants and mark full if necessary
        const { data: act } = await supabaseAdmin
          .from("activities")
          .select("current_participants, max_participants")
          .eq("id", activityId)
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
            .eq("id", activityId);
        }

        log("Ticket confirmed", { ticketId });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!paymentIntentId) break;

        const { data: ticket } = await supabaseAdmin
          .from("activity_tickets")
          .select("id, activity_id, buyer_id, payment_status")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();
        if (!ticket || ticket.payment_status === "refunded") break;

        await supabaseAdmin
          .from("activity_tickets")
          .update({
            payment_status: "refunded",
            booking_status: "cancelled",
            refunded_at: new Date().toISOString(),
          })
          .eq("id", ticket.id);

        // Remove participant + decrement counter
        await supabaseAdmin
          .from("activity_participants")
          .update({ status: "left" })
          .eq("activity_id", ticket.activity_id)
          .eq("user_id", ticket.buyer_id);

        const { data: act } = await supabaseAdmin
          .from("activities")
          .select("current_participants, status")
          .eq("id", ticket.activity_id)
          .single();
        if (act) {
          const next = Math.max(0, (act.current_participants ?? 0) - 1);
          const updates: Record<string, unknown> = {
            current_participants: next,
            updated_at: new Date().toISOString(),
          };
          if (act.status === "full") updates.status = "open";
          await supabaseAdmin
            .from("activities")
            .update(updates)
            .eq("id", ticket.activity_id);
        }

        log("Ticket refunded", { ticketId: ticket.id });
        break;
      }

      default:
        // Unhandled event type — acknowledge anyway
        break;
    }
  } catch (err) {
    log("Handler error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

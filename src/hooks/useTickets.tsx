import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { supabase } from "../integrations/supabase/client";
import { Tables } from "../integrations/supabase/types";

export type Ticket = Tables<"activity_tickets"> & {
  activity?: {
    id: string;
    title: string;
    image_url: string | null;
    category: string | null;
    location_name: string;
    scheduled_at: string;
    creator_id: string;
  };
};

/**
 * Hook for the buyer's own tickets ("My Tickets" tab).
 */
export function useMyTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("activity_tickets")
        .select(
          `*, activity:activities(id, title, image_url, category, location_name, scheduled_at, creator_id)`,
        )
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets((data as any) || []);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetch();
  }, [fetch]);

  /** Latest paid ticket the user owns for a given activity, if any. */
  const getTicketForActivity = useCallback(
    (activityId: string): Ticket | undefined =>
      tickets.find(
        (t) => t.activity_id === activityId && t.payment_status === "paid",
      ),
    [tickets],
  );

  return { tickets, loading, refreshing, refresh, getTicketForActivity };
}

/**
 * Hook for an activity creator to see ticket sales / earnings.
 */
export function useActivityTicketStats(activityId: string | null | undefined) {
  const [stats, setStats] = useState<{
    sold: number;
    grossCents: number;
    payoutCents: number;
  }>({ sold: 0, grossCents: 0, payoutCents: 0 });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!activityId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("activity_tickets")
        .select("gross_amount_cents, creator_payout_cents, payment_status")
        .eq("activity_id", activityId)
        .eq("payment_status", "paid");
      if (error) throw error;
      const sold = data?.length ?? 0;
      const grossCents = (data ?? []).reduce(
        (s, r: any) => s + (r.gross_amount_cents ?? 0),
        0,
      );
      const payoutCents = (data ?? []).reduce(
        (s, r: any) => s + (r.creator_payout_cents ?? 0),
        0,
      );
      setStats({ sold, grossCents, payoutCents });
    } catch (err) {
      console.error("Error fetching ticket stats:", err);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...stats, loading, refresh };
}

/**
 * Start the Stripe-hosted ticket checkout. Calls the
 * `create-ticket-checkout` edge function and returns a URL the caller
 * should open in an in-app browser.
 */
export async function startTicketCheckout(
  activityId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "create-ticket-checkout",
      { body: { activity_id: activityId } },
    );
    if (error) throw error;
    if (!data?.url) throw new Error("No checkout URL returned");
    return data.url as string;
  } catch (err: any) {
    console.error("Error starting ticket checkout:", err);
    Alert.alert(
      "Checkout Error",
      err?.message || "Could not start checkout. Please try again.",
    );
    return null;
  }
}

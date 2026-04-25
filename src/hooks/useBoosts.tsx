import { useCallback, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { supabase } from "../integrations/supabase/client";
import { Tables } from "../integrations/supabase/types";
import { BOOST_PLANS, BoostPlanId } from "../constants/activityCategories";

export type Boost = Tables<"activity_boosts">;

export function useBoosts(activityId?: string | null) {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!activityId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("activity_boosts")
        .select("*")
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setBoosts(data || []);
    } catch (err) {
      console.error("Error fetching boosts:", err);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Activate a boost server-side. The server will verify the IAP receipt,
   * insert an `activity_boosts` row, flip `activities.is_boosted=true` and
   * compute the boost end timestamp.
   *
   * The caller is responsible for performing the IAP purchase and passing
   * the resulting receipt details here.
   */
  const activateBoost = useCallback(
    async (
      params: {
        activityId: string;
        plan: BoostPlanId;
        productId: string;
        transactionId: string;
        purchaseToken?: string;
      },
    ): Promise<boolean> => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "process-boost-purchase",
          {
            body: {
              activity_id: params.activityId,
              plan_type: params.plan,
              product_id: params.productId,
              transaction_id: params.transactionId,
              purchase_token: params.purchaseToken,
              platform: Platform.OS === "ios" ? "ios" : "android",
            },
          },
        );
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || "Boost activation failed");
        await refresh();
        return true;
      } catch (err: any) {
        console.error("Error activating boost:", err);
        Alert.alert("Boost Failed", err?.message || "Could not activate boost.");
        return false;
      }
    },
    [refresh],
  );

  return { boosts, loading, refresh, activateBoost };
}

export { BOOST_PLANS };

import { Ionicons } from "@expo/vector-icons";

/**
 * Outlo activity categories per the implementation brief.
 * These are the user-facing categories shown in the Create Activity wizard.
 *
 * NOTE: keep in sync with the `category` column on `public.activities`.
 * Existing `activity_type` (legacy) remains for backwards compatibility.
 */
export const ACTIVITY_CATEGORIES = [
  {
    id: "coffee",
    label: "Coffee",
    icon: "cafe" as const,
    color: "#8D6E63",
    defaultImage: require("../../assets/logos/logo_O.png"),
  },
  {
    id: "study",
    label: "Study",
    icon: "book" as const,
    color: "#1E88E5",
    defaultImage: require("../../assets/logos/logo_O.png"),
  },
  {
    id: "language",
    label: "Language",
    icon: "chatbubbles" as const,
    color: "#00897B",
    defaultImage: require("../../assets/logos/logo_O.png"),
  },
  {
    id: "fitness",
    label: "Fitness",
    icon: "barbell" as const,
    color: "#F4511E",
    defaultImage: require("../../assets/logos/logo_O.png"),
  },
  {
    id: "creative",
    label: "Creative",
    icon: "color-palette" as const,
    color: "#D81B60",
    defaultImage: require("../../assets/logos/logo_O.png"),
  },
  {
    id: "events",
    label: "Events",
    icon: "calendar" as const,
    color: "#5E35B1",
    defaultImage: require("../../assets/logos/logo_O.png"),
  },
] as const;

export type ActivityCategoryId = (typeof ACTIVITY_CATEGORIES)[number]["id"];
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const getCategory = (id: string | null | undefined):
  | ActivityCategory
  | undefined => ACTIVITY_CATEGORIES.find((c) => c.id === id);

export const getCategoryIcon = (
  id: string | null | undefined,
): keyof typeof Ionicons.glyphMap => {
  return getCategory(id)?.icon ?? "calendar";
};

export const getCategoryColor = (id: string | null | undefined): string =>
  getCategory(id)?.color ?? "#999";

export const getCategoryDefaultImage = (id: string | null | undefined) =>
  getCategory(id)?.defaultImage ?? require("../../assets/logos/logo_O.png");

export const JOIN_TYPES = [
  { id: "everyone", label: "Everyone", description: "Open to all" },
  { id: "beginners", label: "Beginners", description: "New to this" },
  { id: "advanced", label: "Advanced", description: "Experienced people" },
] as const;

export type JoinType = (typeof JOIN_TYPES)[number]["id"];

export type BoostPlanId = "24h" | "3d" | "7d";

export interface BoostPlan {
  id: BoostPlanId;
  label: string;
  durationHours: number;
  priceCents: number;
  productId: string;
  benefits: string[];
  popular?: boolean;
}

export const BOOST_PLANS: BoostPlan[] = [
  {
    id: "24h",
    label: "24 Hours",
    durationHours: 24,
    priceCents: 300,
    productId: "outlo_boost_24h",
    benefits: ["Highlighted on map", "Priority discovery"],
  },
  {
    id: "3d",
    label: "3 Days",
    durationHours: 72,
    priceCents: 700,
    productId: "outlo_boost_3d",
    benefits: ["Highlighted on map", "Priority discovery", "Wider radius"],
    popular: true,
  },
  {
    id: "7d",
    label: "7 Days",
    durationHours: 168,
    priceCents: 1200,
    productId: "outlo_boost_7d",
    benefits: [
      "Highlighted on map",
      "Priority discovery",
      "Wider radius",
      "Best value",
    ],
  },
];

export const getBoostPlan = (id: string | null | undefined) =>
  BOOST_PLANS.find((p) => p.id === id);

/** Ticket price tiers for paid activities (match Google Play product IDs). */
export interface TicketPriceTier {
  priceCents: number;
  label: string;
  productId: string;
}

export const TICKET_PRICE_TIERS: TicketPriceTier[] = [
  { priceCents: 500, label: "€5", productId: "outlo_ticket_5" },
  { priceCents: 1000, label: "€10", productId: "outlo_ticket_10" },
  { priceCents: 2000, label: "€20", productId: "outlo_ticket_20" },
  { priceCents: 5000, label: "€50", productId: "outlo_ticket_50" },
];

/** Platform commission applied to paid ticket sales (basis points). */
export const PLATFORM_FEE_BPS = 1000; // 10%

/** Format cents to a localised EUR price string. */
export const formatPrice = (cents: number, currency = "EUR"): string => {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `€${(cents / 100).toFixed(2)}`;
  }
};

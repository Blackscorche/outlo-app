import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from "@expo/vector-icons";
import { formatPrice } from "../constants/activityCategories";

interface PriceBadgeProps {
  isPaid: boolean;
  priceCents?: number | null;
  currency?: string;
  size?: "sm" | "md";
  style?: ViewStyle;
}

/**
 * Visual badge for activity price.
 * - Free → soft green pill
 * - Paid → solid emerald with the formatted price
 */
export default function PriceBadge({
  isPaid,
  priceCents,
  currency = "EUR",
  size = "md",
  style,
}: PriceBadgeProps) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const small = size === "sm";
  if (!isPaid) {
    return (
      <View
        style={[
          styles.base,
          styles.free,
          small && styles.smallPad,
          style,
        ]}
      >
        <Ionicons
          name="checkmark-circle"
          size={small ? 12 : 14}
          color="#16A34A"
        />
        <Text
          style={[styles.text, styles.freeText, small && styles.smallText]}
        >
          Free
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.base, styles.paid, small && styles.smallPad, style]}
    >
      <Ionicons name="ticket" size={small ? 12 : 14} color="#fff" />
      <Text style={[styles.text, styles.paidText, small && styles.smallText]}>
        {formatPrice(priceCents ?? 0, currency)}
      </Text>
    </View>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
    alignSelf: "flex-start",
  },
  smallPad: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  free: {
    backgroundColor: "#DCFCE7",
  },
  paid: {
    backgroundColor: "#16A34A",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
  smallText: {
    fontSize: 11,
  },
  freeText: {
    color: "#15803D",
  },
  paidText: {
    color: t.colors.text,
  },
});

import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface BoostBadgeProps {
  size?: "sm" | "md";
  style?: ViewStyle;
  label?: string;
}

/**
 * Featured / Boosted badge - golden gradient look for promoted activities.
 */
export default function BoostBadge({
  size = "md",
  style,
  label = "Featured",
}: BoostBadgeProps) {
  const small = size === "sm";
  return (
    <View style={[styles.base, small && styles.smallPad, style]}>
      <Ionicons name="star" size={small ? 11 : 13} color="#fff" />
      <Text style={[styles.text, small && styles.smallText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
    alignSelf: "flex-start",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  smallPad: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  smallText: {
    fontSize: 11,
  },
});

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from '../contexts/ThemeContext';
interface WizardProgressBarProps {
  step: number; // 1-indexed
  total: number;
  title?: string;
}

/**
 * Slim progress indicator shown at the top of multi-step wizards.
 * Shows "Step x of y · {title}" and a horizontal fill bar.
 */
export default function WizardProgressBar({
  step,
  total,
  title,
}: WizardProgressBarProps) {
  const pct = Math.min(100, Math.max(0, ((step - 0) / total) * 100));
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.stepLabel}>
          Step {step} of {total}
        </Text>
        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  track: {
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#16A34A",
    borderRadius: 2,
  },
});

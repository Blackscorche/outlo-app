import React from "react";
import { Image, ImageStyle, StyleProp, useColorScheme } from "react-native";

interface OutloLogoProps {
  width?: number;
  height?: number;
  variant?: "auto" | "light" | "dark";
  style?: StyleProp<ImageStyle>;
}

/**
 * Outlo brand logo. Defaults to auto-switching based on system color scheme.
 * - "light" variant = used on light backgrounds (dark text)
 * - "dark" variant  = used on dark backgrounds (light text)
 */
export default function OutloLogo({
  width = 160,
  height = 48,
  variant = "auto",
  style,
}: OutloLogoProps) {
  const scheme = useColorScheme();
  const resolved =
    variant === "auto" ? (scheme === "dark" ? "dark" : "light") : variant;

  const source =
    resolved === "dark"
      ? require("../../assets/logos/darkmode_logo.jpeg")
      : require("../../assets/logos/lightmode_logo.jpeg");

  return (
    <Image
      source={source}
      style={[{ width, height }, style]}
      resizeMode="contain"
    />
  );
}

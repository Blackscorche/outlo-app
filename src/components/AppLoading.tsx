import React, { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
  View,
  Image,
  Animated,
  Easing,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface AppLoadingProps {
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  overlay?: boolean;
}

const SIZES = {
  small: { logo: 50, strokeWidth: 2.5, gap: 5 },
  medium: { logo: 80, strokeWidth: 3, gap: 6 },
  large: { logo: 120, strokeWidth: 4, gap: 8 },
};

// Concentric circular arcs, each on its own layer, spinning at different speeds
// borderTopColor + borderRightColor = half-circle arc
const RINGS = [
  { color: '#4CAF50', duration: 2000, startAngle: 0, direction: 1 },
  { color: '#2979FF', duration: 2500, startAngle: 90, direction: -1 },
  { color: '#00C853', duration: 1800, startAngle: 180, direction: 1 },
  { color: '#FF9100', duration: 3000, startAngle: 270, direction: -1 },
];

const AppLoading = ({ size = 'medium', style, overlay = false }: AppLoadingProps) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const dims = SIZES[size];

  const rotations = useRef(
    RINGS.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = RINGS.map((ring, index) =>
      Animated.loop(
        Animated.timing(rotations[index], {
          toValue: 1,
          duration: ring.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
    );

    animations.forEach((anim) => anim.start());

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, []);

  // Each ring is slightly larger than the previous, forming concentric layers
  const outerRingSize = dims.logo + (dims.strokeWidth + dims.gap) * 2 * RINGS.length;
  const containerSize = outerRingSize + 20;

  const content = (
    <View style={[styles.container, { width: containerSize, height: containerSize }, style]}>
      {/* Rings behind the logo */}
      {RINGS.map((ring, index) => {
        const endAngle = ring.startAngle + 360 * ring.direction;
        const spin = rotations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [`${ring.startAngle}deg`, `${endAngle}deg`],
        });

        const ringSize = dims.logo + (dims.strokeWidth + dims.gap) * 2 * (index + 1);
        const offset = (containerSize - ringSize) / 2;

        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              top: offset,
              left: offset,
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: dims.strokeWidth,
              borderTopColor: ring.color,
              borderRightColor: ring.color,
              borderBottomColor: 'transparent',
              borderLeftColor: 'transparent',
              transform: [{ rotateZ: spin }],
            }}
          />
        );
      })}
      {/* Logo on top */}
      <Image
        source={require('../../assets/logos/darkmode_logo.png')}
        style={{ position: 'absolute', width: dims.logo, height: dims.logo }}
        resizeMode="contain"
      />
    </View>
  );

  if (overlay) {
    return (
      <View style={styles.overlay}>
        {content}
      </View>
    );
  }

  return content;
};

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
});

export default AppLoading;

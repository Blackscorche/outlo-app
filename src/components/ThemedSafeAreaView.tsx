import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  children: React.ReactNode;
  edges?: Edge[];
  style?: object;
}

export default function ThemedSafeAreaView({ children, edges, style }: Props) {
  const { theme } = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}
    >
      {children}
    </SafeAreaView>
  );
}

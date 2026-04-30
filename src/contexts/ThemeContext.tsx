import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@outlo_theme_mode';

export const darkTheme = {
  isDark: true,
  colors: {
    primary: '#4CAF50',
    secondary: '#2E7D32',
    background: '#0A0A0A',
    surface: '#1A1A1A',
    surfaceVariant: '#2A2A2A',
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
    border: '#333333',
    card: '#1A1A1A',
    inputBg: '#2A2A2A',
    gray: {
      50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB',
      300: '#D1D5DB', 400: '#9CA3AF', 500: '#6B7280',
      600: '#4B5563', 700: '#374151', 800: '#1F2937', 900: '#111827',
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30 },
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
};

export const lightTheme = {
  isDark: false,
  colors: {
    primary: '#4CAF50',
    secondary: '#2E7D32',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    surfaceVariant: '#F0F0F0',
    text: '#111827',
    textSecondary: '#6B7280',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    info: '#3B82F6',
    border: '#E5E7EB',
    card: '#FFFFFF',
    inputBg: '#F3F4F6',
    gray: {
      50: '#111827', 100: '#1F2937', 200: '#374151',
      300: '#4B5563', 400: '#6B7280', 500: '#9CA3AF',
      600: '#D1D5DB', 700: '#E5E7EB', 800: '#F3F4F6', 900: '#F9FAFB',
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, xxxl: 30 },
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
};

export type AppTheme = typeof darkTheme;

interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((val) => {
      if (val !== null) setIsDark(val === 'dark');
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_KEYS = ['supabase.auth.token', 'supabase.auth.refresh_token'];

export const HybridStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      // Use SecureStore for sensitive auth tokens
      if (SECURE_KEYS.some(secureKey => key.includes(secureKey))) {
        return await SecureStore.getItemAsync(key);
      }
      
      // Use AsyncStorage for larger session data
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item from hybrid storage:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Use SecureStore for sensitive auth tokens
      if (SECURE_KEYS.some(secureKey => key.includes(secureKey))) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
      
      // Use AsyncStorage for larger session data
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item in hybrid storage:', error);
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      // Try both storage methods
      if (SECURE_KEYS.some(secureKey => key.includes(secureKey))) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error removing item from hybrid storage:', error);
      throw error;
    }
  },
};
// API Configuration Examples

// Example 1: Using localhost (for emulator/simulator)
const DEV_API_URL = 'http://localhost:3000';

// Example 2: Using your computer's local IP (for real device testing)
// Replace with your actual local IP address (run 'ipconfig' on Windows or 'ifconfig' on Mac/Linux)
// const DEV_API_URL = 'http://192.168.1.100:3000';

// Example 3: Using ngrok or other tunneling service
// const DEV_API_URL = 'https://your-subdomain.ngrok.io';

// Example 4: Using a staging server
// const DEV_API_URL = 'https://staging-api.lovemap.app';

// Production URL
const PROD_API_URL = 'https://api.lovemap.app'; // Replace with your actual production URL

// Automatic selection based on environment
export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;

// You can also use environment variables
// const DEV_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// API Endpoints remain the same
export const API_ENDPOINTS = {
  // Subscription endpoints
  CREATE_SUBSCRIPTION_CHECKOUT: '/api/create-subscription-checkout',
  CREATE_EXTRA_PURCHASE: '/api/create-extra-purchase',
  CONFIRM_EXTRA_PURCHASE: '/api/confirm-extra-purchase',
  SUBSCRIPTION_STATUS: '/api/subscription-status',
  CANCEL_SUBSCRIPTION: '/api/cancel-subscription',
  
  // Health check
  HEALTH: '/health',
};
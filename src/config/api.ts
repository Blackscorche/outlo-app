// API Configuration
// For Android Emulator use: http://10.0.2.2:8000
// For iOS Simulator use: http://localhost:8000
// For real device use your computer's IP: http://YOUR_IP:8000
// const DEV_API_URL = 'http://10.0.2.2:8000'; // Android emulator
const DEV_API_URL = 'http://192.168.100.39:8000'; // Replace with your actual IP
const PROD_API_URL = 'https://lovemap-backend.vercel.app'; // Replace with your production URL

export const API_BASE_URL = __DEV__ ? PROD_API_URL : PROD_API_URL;

export const API_ENDPOINTS = {
  // Subscription endpoints
  CREATE_SUBSCRIPTION_CHECKOUT: '/api/create-subscription-checkout',
  CREATE_EXTRA_PURCHASE: '/api/create-extra-purchase',
  CREATE_EXTRA_PURCHASE_CHECKOUT: '/api/create-extra-purchase-checkout',
  CONFIRM_EXTRA_PURCHASE: '/api/confirm-extra-purchase',
  SUBSCRIPTION_STATUS: '/api/subscription-status',
  CANCEL_SUBSCRIPTION: '/api/cancel-subscription',
  
  // Health check
  HEALTH: '/health',
};
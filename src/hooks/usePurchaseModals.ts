import { useState, useCallback } from 'react';

export interface PurchaseModalState {
  loading: boolean;
  success: boolean;
  error: boolean;
  info: boolean;
  loadingMessage?: string;
  successTitle?: string;
  successMessage?: string;
  errorTitle?: string;
  errorMessage?: string;
  infoTitle?: string;
  infoMessage?: string;
  infoType?: 'info' | 'warning' | 'success';
  price?: string;
  productName?: string;
  onRetry?: () => void;
  onConfirm?: () => void;
}

export const usePurchaseModals = () => {
  const [modalState, setModalState] = useState<PurchaseModalState>({
    loading: false,
    success: false,
    error: false,
    info: false,
  });

  const showLoading = useCallback((message?: string, price?: string, productName?: string) => {
    console.log('🔄 showLoading called:', message, price, productName);
    setModalState(prev => ({
      ...prev,
      loading: true,
      success: false,
      error: false,
      info: false,
      loadingMessage: message,
      price,
      productName,
    }));
  }, []);

  const showSuccess = useCallback((title?: string, message?: string, price?: string, productName?: string) => {
    console.log('✅ showSuccess called:', title, message, price, productName);
    setModalState(prev => ({
      ...prev,
      loading: false,
      success: true,
      error: false,
      info: false,
      successTitle: title,
      successMessage: message,
      price,
      productName,
    }));
  }, []);

  const showError = useCallback((title?: string, message?: string, onRetry?: () => void) => {
    console.log('❌ showError called:', title, message);
    setModalState(prev => ({
      ...prev,
      loading: false,
      success: false,
      error: true,
      info: false,
      errorTitle: title,
      errorMessage: message,
      onRetry,
    }));
  }, []);

  const showInfo = useCallback((
    title: string,
    message: string,
    type: 'info' | 'warning' | 'success' = 'info',
    onConfirm?: () => void
  ) => {
    console.log('ℹ️ showInfo called:', title, message, type);
    setModalState(prev => ({
      ...prev,
      loading: false,
      success: false,
      error: false,
      info: true,
      infoTitle: title,
      infoMessage: message,
      infoType: type,
      onConfirm,
    }));
  }, []);

  const hideModals = useCallback(() => {
    console.log('🚫 hideModals called');
    setModalState({
      loading: false,
      success: false,
      error: false,
      info: false,
    });
  }, []);

  return {
    modalState,
    showLoading,
    showSuccess,
    showError,
    showInfo,
    hideModals,
  };
};

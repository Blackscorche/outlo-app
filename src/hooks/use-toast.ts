import { Alert } from 'react-native';

interface ToastProps {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

const toast = ({ title, description, variant = 'default' }: ToastProps) => {
  const message = description || title;
  
  if (variant === 'destructive') {
    Alert.alert('Error', message);
  } else {
    Alert.alert('Success', message);
  }
};

export const useToast = () => {
  return {
    toast,
    dismiss: () => {}, // No-op for React Native Alert
  };
};

export { toast };
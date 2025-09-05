
import { useSubscription } from './useSubscription';
import { useToast } from './use-toast';

export const useSubscriptionRestrictions = () => {
  const { subscription_tier, subscribed } = useSubscription();
  const { toast } = useToast();

  const getConnectRequestsLimit = () => {
    switch (subscription_tier) {
      case 'basic':
        return 0; // No connect requests for basic users
      case 'premium':
        return 10; // 10 per month for premium
      case 'vip':
        return Infinity; // Unlimited for VIP
      default:
        return 0;
    }
  };

  const canSendConnectRequest = () => {
    if (subscription_tier === 'basic') {
      toast({
        title: "Upgrade Required",
        description: "Connect requests are only available for Premium and VIP subscribers.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const canSendMessage = () => {
    if (subscription_tier === 'basic') {
      toast({
        title: "Upgrade Required",
        description: "Messaging is only available for Premium and VIP subscribers.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const canViewClearProfiles = () => {
    return subscription_tier !== 'basic';
  };

  const canHideFromOthers = () => {
    return subscription_tier === 'vip';
  };

  const getMapViewRestriction = () => {
    switch (subscription_tier) {
      case 'basic':
        return 'blurred'; // Blurred profiles for basic users
      case 'premium':
      case 'vip':
        return 'clear'; // Clear profiles for premium/vip
      default:
        return 'blurred';
    }
  };

  const showUpgradePrompt = (feature: string) => {
    toast({
      title: "Upgrade to Premium",
      description: `${feature} is available with Premium or VIP subscription.`,
      variant: "destructive",
    });
  };

  return {
    subscription_tier,
    subscribed,
    getConnectRequestsLimit,
    canSendConnectRequest,
    canSendMessage,
    canViewClearProfiles,
    canHideFromOthers,
    getMapViewRestriction,
    showUpgradePrompt,
  };
};

-- Subscription Plans
CREATE TYPE subscription_tier AS ENUM ('basic', 'premium');
CREATE TYPE billing_period AS ENUM ('monthly', 'yearly');

-- User Subscriptions Table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'basic',
  billing_period billing_period,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active', -- active, canceled, past_due, trialing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Connection Request Quota
CREATE TABLE user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_requests_remaining INT NOT NULL DEFAULT 1,
  connection_requests_purchased INT DEFAULT 0,
  first_impressions_remaining INT DEFAULT 0,
  first_impressions_purchased INT DEFAULT 0,
  invisible_mode_expires_at TIMESTAMP WITH TIME ZONE,
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- First Impressions (Messages before connection)
CREATE TABLE first_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_request_id UUID REFERENCES connection_requests(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Purchase History
CREATE TABLE purchase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL, -- connection_request, first_impression, invisible_mode
  quantity INT DEFAULT 1,
  amount_cents INT NOT NULL,
  currency TEXT DEFAULT 'USD',
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'pending', -- pending, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Referral System
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referred_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  referral_code TEXT UNIQUE NOT NULL,
  reward_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  claimed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(referrer_id, referred_email)
);

-- Notification Queue
CREATE TABLE push_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add visibility control to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_invisible BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX idx_first_impressions_receiver ON first_impressions(receiver_id, is_read);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_push_notifications_scheduled ON push_notification_queue(scheduled_for, sent_at);

-- Function to reset monthly quotas
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
  UPDATE user_quotas uq
  SET 
    connection_requests_remaining = CASE 
      WHEN us.tier = 'premium' THEN 10 
      ELSE 1 
    END,
    first_impressions_remaining = CASE 
      WHEN us.tier = 'premium' THEN 3 
      ELSE 0 
    END,
    last_reset_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
  FROM user_subscriptions us
  WHERE uq.user_id = us.user_id
    AND us.status = 'active'
    AND uq.last_reset_at < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE first_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;

-- User can view their own subscription
CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- User can view their own quotas
CREATE POLICY "Users can view own quotas" ON user_quotas
  FOR SELECT USING (auth.uid() = user_id);

-- Users can send and view first impressions
CREATE POLICY "Users can send first impressions" ON first_impressions
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view received first impressions" ON first_impressions
  FOR SELECT USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Users can view their purchase history
CREATE POLICY "Users can view own purchases" ON purchase_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create and view their referrals
CREATE POLICY "Users can create referrals" ON referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id);
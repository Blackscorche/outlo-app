-- Add IAP specific columns to existing tables
-- Migration: Add support for In-App Purchases alongside Stripe

-- Add IAP transaction tracking to user_subscriptions
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS iap_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS iap_original_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS iap_expires_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'stripe'; -- 'stripe', 'apple', 'google'

-- Add IAP specific columns to purchase_history
ALTER TABLE purchase_history 
ADD COLUMN IF NOT EXISTS iap_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS iap_receipt_data TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT, -- 'ios', 'android', 'web'
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'stripe'; -- 'stripe', 'apple', 'google'

-- Create index for IAP transaction lookups
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_iap_transaction 
ON user_subscriptions(iap_transaction_id);

CREATE INDEX IF NOT EXISTS idx_purchase_history_iap_transaction 
ON purchase_history(iap_transaction_id);

-- Create a function to handle IAP subscription renewal
CREATE OR REPLACE FUNCTION handle_iap_subscription_renewal()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is an IAP subscription update, reset quotas
  IF NEW.payment_method IN ('apple', 'google') AND 
     NEW.status = 'active' AND 
     (OLD.current_period_end IS NULL OR NEW.current_period_end > OLD.current_period_end) THEN
    
    -- Reset quotas for the new period
    INSERT INTO user_quotas (
      user_id,
      connection_requests_remaining,
      first_impressions_remaining,
      connection_requests_purchased,
      first_impressions_purchased,
      last_reset_at,
      updated_at
    ) VALUES (
      NEW.user_id,
      CASE WHEN NEW.tier = 'premium' THEN 10 ELSE 1 END,
      CASE WHEN NEW.tier = 'premium' THEN 3 ELSE 0 END,
      0,
      0,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    ) ON CONFLICT (user_id) DO UPDATE SET
      connection_requests_remaining = CASE WHEN NEW.tier = 'premium' THEN 10 ELSE 1 END,
      first_impressions_remaining = CASE WHEN NEW.tier = 'premium' THEN 3 ELSE 0 END,
      last_reset_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for IAP subscription renewals
DROP TRIGGER IF EXISTS trigger_iap_subscription_renewal ON user_subscriptions;
CREATE TRIGGER trigger_iap_subscription_renewal
  AFTER UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_iap_subscription_renewal();

-- Add comments for documentation
COMMENT ON COLUMN user_subscriptions.iap_transaction_id IS 'Apple/Google transaction ID for IAP purchases';
COMMENT ON COLUMN user_subscriptions.payment_method IS 'Payment method: stripe, apple, or google';
COMMENT ON COLUMN purchase_history.iap_receipt_data IS 'Raw receipt data from Apple/Google for validation';
COMMENT ON COLUMN purchase_history.platform IS 'Platform where purchase was made: ios, android, web';

-- Create a view for active subscriptions
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT 
  us.*,
  CASE 
    WHEN us.payment_method = 'stripe' THEN 'Stripe'
    WHEN us.payment_method = 'apple' THEN 'App Store'
    WHEN us.payment_method = 'google' THEN 'Google Play'
    ELSE 'Unknown'
  END as payment_provider
FROM user_subscriptions us
WHERE us.status = 'active' 
  AND (us.current_period_end IS NULL OR us.current_period_end > NOW());

-- Grant necessary permissions
GRANT SELECT ON active_subscriptions TO authenticated;
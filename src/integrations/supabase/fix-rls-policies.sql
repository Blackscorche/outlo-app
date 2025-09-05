-- Fix RLS policies for user_quotas table

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own quotas" ON user_quotas;
DROP POLICY IF EXISTS "Users can update own quotas" ON user_quotas;
DROP POLICY IF EXISTS "Users can insert own quotas" ON user_quotas;
DROP POLICY IF EXISTS "Service role can manage all quotas" ON user_quotas;

-- Enable RLS
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own quotas
CREATE POLICY "Users can view own quotas" ON user_quotas
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own quotas (for initialization)
CREATE POLICY "Users can insert own quotas" ON user_quotas
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own quotas
CREATE POLICY "Users can update own quotas" ON user_quotas
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow service role full access (for backend operations)
CREATE POLICY "Service role can manage all quotas" ON user_quotas
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Fix RLS policies for user_subscriptions table
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON user_subscriptions;

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own subscription
CREATE POLICY "Users can view own subscription" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own subscription (for initialization)
CREATE POLICY "Users can insert own subscription" ON user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own subscription
CREATE POLICY "Users can update own subscription" ON user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role can manage all subscriptions" ON user_subscriptions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Fix RLS policies for purchase_history table
DROP POLICY IF EXISTS "Users can view own purchases" ON purchase_history;
DROP POLICY IF EXISTS "Users can insert own purchases" ON purchase_history;
DROP POLICY IF EXISTS "Service role can manage all purchases" ON purchase_history;

-- Enable RLS
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own purchases
CREATE POLICY "Users can view own purchases" ON purchase_history
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own purchases
CREATE POLICY "Users can insert own purchases" ON purchase_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role can manage all purchases" ON purchase_history
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Fix RLS policies for first_impressions table
DROP POLICY IF EXISTS "Users can view sent impressions" ON first_impressions;
DROP POLICY IF EXISTS "Users can view received impressions" ON first_impressions;
DROP POLICY IF EXISTS "Users can insert impressions" ON first_impressions;
DROP POLICY IF EXISTS "Service role can manage all impressions" ON first_impressions;

-- Enable RLS
ALTER TABLE first_impressions ENABLE ROW LEVEL SECURITY;

-- Allow users to view impressions they sent or received
CREATE POLICY "Users can view sent impressions" ON first_impressions
    FOR SELECT USING (auth.uid() = sender_id);

CREATE POLICY "Users can view received impressions" ON first_impressions
    FOR SELECT USING (auth.uid() = receiver_id);

-- Allow users to insert impressions they send
CREATE POLICY "Users can insert impressions" ON first_impressions
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Allow service role full access
CREATE POLICY "Service role can manage all impressions" ON first_impressions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Fix RLS policies for referrals table
DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
DROP POLICY IF EXISTS "Users can insert referrals" ON referrals;
DROP POLICY IF EXISTS "Users can update referrals" ON referrals;
DROP POLICY IF EXISTS "Service role can manage all referrals" ON referrals;

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own referrals
CREATE POLICY "Users can view own referrals" ON referrals
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

-- Allow users to insert referrals
CREATE POLICY "Users can insert referrals" ON referrals
    FOR INSERT WITH CHECK (auth.uid() = referrer_id);

-- Allow users to update referrals (for claiming)
CREATE POLICY "Users can update referrals" ON referrals
    FOR UPDATE USING (auth.uid() = referred_user_id OR auth.uid() = referrer_id);

-- Allow service role full access
CREATE POLICY "Service role can manage all referrals" ON referrals
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
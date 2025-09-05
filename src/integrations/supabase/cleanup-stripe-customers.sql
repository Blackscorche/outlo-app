-- Cleanup invalid Stripe customer IDs
-- Run this to reset all Stripe customer IDs if you changed Stripe accounts

UPDATE user_subscriptions 
SET stripe_customer_id = NULL 
WHERE stripe_customer_id IS NOT NULL;
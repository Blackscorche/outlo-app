
-- Create subscribers table to track subscription information
CREATE TABLE public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT DEFAULT 'basic',
  subscription_end TIMESTAMPTZ,
  connect_requests_used INTEGER DEFAULT 0,
  connect_requests_reset_date TIMESTAMPTZ DEFAULT date_trunc('month', now()) + interval '1 month',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own subscription info
CREATE POLICY "select_own_subscription" ON public.subscribers
FOR SELECT
USING (user_id = auth.uid() OR email = auth.email());

-- Create policy for edge functions to update subscription info
CREATE POLICY "update_own_subscription" ON public.subscribers
FOR UPDATE
USING (true);

-- Create policy for edge functions to insert subscription info
CREATE POLICY "insert_subscription" ON public.subscribers
FOR INSERT
WITH CHECK (true);

-- Create function to reset monthly connect request counts
CREATE OR REPLACE FUNCTION reset_monthly_connect_requests()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.subscribers 
  SET connect_requests_used = 0,
      connect_requests_reset_date = date_trunc('month', now()) + interval '1 month'
  WHERE connect_requests_reset_date <= now();
END;
$$;

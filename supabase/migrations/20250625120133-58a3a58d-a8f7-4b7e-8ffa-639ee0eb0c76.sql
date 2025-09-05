
-- Create a table to store blocked users
CREATE TABLE public.blocked_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES auth.users NOT NULL,
  blocked_id UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Add Row Level Security (RLS) to blocked_users
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own blocked users list
CREATE POLICY "Users can view their own blocked users" 
  ON public.blocked_users 
  FOR SELECT 
  USING (auth.uid() = blocker_id);

-- Users can block other users
CREATE POLICY "Users can block other users" 
  ON public.blocked_users 
  FOR INSERT 
  WITH CHECK (auth.uid() = blocker_id);

-- Users can unblock users they blocked
CREATE POLICY "Users can unblock users they blocked" 
  ON public.blocked_users 
  FOR DELETE 
  USING (auth.uid() = blocker_id);


-- Create the friends table
CREATE TABLE public.friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Enable Row Level Security
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Create policies for friends table
CREATE POLICY "Users can view their own friends" 
  ON public.friends 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add friends" 
  ON public.friends 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own friends" 
  ON public.friends 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_friends_user_id ON public.friends(user_id);
CREATE INDEX idx_friends_friend_id ON public.friends(friend_id);

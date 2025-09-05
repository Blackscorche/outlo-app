
-- Create user_favorites table to store user favorites
CREATE TABLE public.user_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  favorited_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure a user can't favorite the same user multiple times
  UNIQUE(user_id, favorited_user_id),
  
  -- Ensure a user can't favorite themselves
  CHECK (user_id != favorited_user_id)
);

-- Add Row Level Security (RLS)
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
-- Users can view their own favorites
CREATE POLICY "Users can view their own favorites" 
  ON public.user_favorites 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can add favorites for themselves
CREATE POLICY "Users can add their own favorites" 
  ON public.user_favorites 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own favorites
CREATE POLICY "Users can remove their own favorites" 
  ON public.user_favorites 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_user_favorites_user_id ON public.user_favorites(user_id);
CREATE INDEX idx_user_favorites_favorited_user_id ON public.user_favorites(favorited_user_id);


-- Create stories table for user posts
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  story_type TEXT NOT NULL DEFAULT 'post', -- 'post', 'selfie', 'checkin'
  location_name TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours')
);

-- Create AI phrases table for suggestions
CREATE TABLE public.ai_phrases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'greeting', 'mood', 'activity', 'location'
  phrase TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert sample AI phrases
INSERT INTO public.ai_phrases (category, phrase) VALUES
('greeting', 'Feeling amazing today! ✨'),
('greeting', 'Good vibes only 🌟'),
('greeting', 'Living my best life 💫'),
('mood', 'Grateful for this moment 🙏'),
('mood', 'Sunshine state of mind ☀️'),
('mood', 'Making memories 📸'),
('activity', 'Adventure awaits! 🗺️'),
('activity', 'Exploring new places 🌍'),
('activity', 'Coffee and good company ☕'),
('location', 'Perfect spot for photos 📷'),
('location', 'Hidden gem discovered! 💎'),
('location', 'Love this place already ❤️');

-- Add Row Level Security (RLS)
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_phrases ENABLE ROW LEVEL SECURITY;

-- Stories policies
CREATE POLICY "Users can view all active stories" 
  ON public.stories 
  FOR SELECT 
  USING (expires_at > now());

CREATE POLICY "Users can create their own stories" 
  ON public.stories 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stories" 
  ON public.stories 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories" 
  ON public.stories 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- AI phrases policies (everyone can read)
CREATE POLICY "Everyone can view AI phrases" 
  ON public.ai_phrases 
  FOR SELECT 
  USING (true);

-- Add status_text to profiles table if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status_text TEXT;

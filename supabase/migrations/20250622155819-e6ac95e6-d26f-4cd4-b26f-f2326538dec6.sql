
-- Update the profiles table to store precise location data
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS current_longitude NUMERIC,
ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create an index for location-based queries (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles (current_latitude, current_longitude);

-- Drop existing policies if they exist and create new ones
DROP POLICY IF EXISTS "Users can view other users' locations" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own location" ON public.profiles;

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add RLS policies to allow users to read location data of other users
CREATE POLICY "Users can view other users' locations" 
  ON public.profiles 
  FOR SELECT 
  USING (true);

-- Allow users to update their own location
CREATE POLICY "Users can update their own location" 
  ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

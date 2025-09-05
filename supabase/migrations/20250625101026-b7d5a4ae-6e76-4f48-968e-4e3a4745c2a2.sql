
-- Add the new columns for relationship goals and living location
ALTER TABLE public.profiles 
ADD COLUMN relationship_goals TEXT,
ADD COLUMN living_in TEXT;


-- Add the missing work & education columns to the profiles table
ALTER TABLE public.profiles 
ADD COLUMN job_title TEXT,
ADD COLUMN company TEXT,
ADD COLUMN school TEXT;

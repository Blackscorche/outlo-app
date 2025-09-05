-- Add cover_photo field to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS cover_photo TEXT;

-- Add comment
COMMENT ON COLUMN profiles.cover_photo IS 'URL of the user profile cover photo';
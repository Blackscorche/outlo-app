-- Run these commands in your Supabase SQL Editor to set up storage

-- 1. Create the storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('user-photos', 'user-photos', true) 
ON CONFLICT DO NOTHING;

-- 2. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies (if any)
DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own" ON storage.objects;

-- 4. Create new policies
-- Allow authenticated users to upload
CREATE POLICY "Anyone can upload" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'user-photos');

-- Allow anyone to view photos
CREATE POLICY "Anyone can view" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'user-photos');

-- Allow users to update their own photos
CREATE POLICY "Users can update own" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (bucket_id = 'user-photos' AND auth.uid()::text = owner);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own" 
ON storage.objects FOR DELETE 
TO authenticated
USING (bucket_id = 'user-photos' AND auth.uid()::text = owner);

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'user-photos';
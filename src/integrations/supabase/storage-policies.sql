-- Storage policies for posts-media bucket
-- Run this in SQL Editor after creating the posts-media bucket

-- Allow authenticated users to upload their own media
CREATE POLICY "Users can upload their own posts media" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'posts-media' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Allow authenticated users to update their own media
CREATE POLICY "Users can update their own posts media" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'posts-media' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Allow anyone to view posts media (public access)
CREATE POLICY "Anyone can view posts media" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'posts-media');

-- Allow users to delete their own media
CREATE POLICY "Users can delete their own posts media" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'posts-media' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);
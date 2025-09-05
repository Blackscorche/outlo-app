
-- Create a storage bucket for user photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', true);

-- Create policy to allow users to upload their own photos
CREATE POLICY "Users can upload their own photos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'user-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create policy to allow users to view all photos (for the dating app functionality)
CREATE POLICY "Anyone can view photos" ON storage.objects
FOR SELECT USING (bucket_id = 'user-photos');

-- Create policy to allow users to delete their own photos
CREATE POLICY "Users can delete their own photos" ON storage.objects
FOR DELETE USING (bucket_id = 'user-photos' AND auth.uid()::text = (storage.foldername(name))[1]);


-- Create verification_requests table to store selfie verification requests
CREATE TABLE public.verification_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  selfie_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users
);

-- Add verification status to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_verified BOOLEAN DEFAULT false;

-- Add Row Level Security (RLS) to verification_requests
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification requests
CREATE POLICY "Users can view their own verification requests" 
  ON public.verification_requests 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can create their own verification requests
CREATE POLICY "Users can create their own verification requests" 
  ON public.verification_requests 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for verification selfies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('verification-selfies', 'verification-selfies', false);

-- Allow authenticated users to upload verification selfies
CREATE POLICY "Users can upload verification selfies"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'verification-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to view their own verification selfies
CREATE POLICY "Users can view their own verification selfies"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'verification-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

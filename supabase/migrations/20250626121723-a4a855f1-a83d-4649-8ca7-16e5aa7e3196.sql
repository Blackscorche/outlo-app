
-- Add seen_by_receiver field to connection_requests table
ALTER TABLE public.connection_requests 
ADD COLUMN seen_by_receiver BOOLEAN NOT NULL DEFAULT false;

-- Update existing pending requests to be unseen by default
UPDATE public.connection_requests 
SET seen_by_receiver = false 
WHERE status = 'pending';

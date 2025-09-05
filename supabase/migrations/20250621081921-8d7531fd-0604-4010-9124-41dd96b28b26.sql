
-- Create connection_requests table to track pending requests
CREATE TABLE public.connection_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS for connection_requests
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

-- Policy to let users see requests they sent or received
CREATE POLICY "Users can view their connection requests" 
  ON public.connection_requests 
  FOR SELECT 
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Policy to let users create connection requests
CREATE POLICY "Users can create connection requests" 
  ON public.connection_requests 
  FOR INSERT 
  WITH CHECK (auth.uid() = sender_id);

-- Policy to let users update requests they received (accept/reject)
CREATE POLICY "Users can update received requests" 
  ON public.connection_requests 
  FOR UPDATE 
  USING (auth.uid() = receiver_id);

-- Create connections table for accepted connections
CREATE TABLE public.connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id) -- Ensure consistent ordering
);

-- Enable RLS for connections
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Policy to let users see their connections
CREATE POLICY "Users can view their connections" 
  ON public.connections 
  FOR SELECT 
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Function to create connection when request is accepted
CREATE OR REPLACE FUNCTION public.handle_connection_request_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Create connection with consistent ordering (smaller UUID first)
    INSERT INTO public.connections (user1_id, user2_id)
    VALUES (
      LEAST(NEW.sender_id, NEW.receiver_id),
      GREATEST(NEW.sender_id, NEW.receiver_id)
    )
    ON CONFLICT (user1_id, user2_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to create connection when request is accepted
CREATE TRIGGER on_connection_request_accepted
  AFTER UPDATE ON public.connection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_connection_request_accepted();

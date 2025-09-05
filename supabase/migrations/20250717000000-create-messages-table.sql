-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX idx_messages_chat_room_id ON public.messages(chat_room_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages in their chat rooms
CREATE POLICY "Users can view messages in their chat rooms" 
  ON public.messages 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_rooms
      WHERE chat_rooms.id = messages.chat_room_id
      AND (chat_rooms.user1_id = auth.uid() OR chat_rooms.user2_id = auth.uid())
    )
  );

-- Policy: Users can insert messages into their chat rooms
CREATE POLICY "Users can insert messages into their chat rooms" 
  ON public.messages 
  FOR INSERT 
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.chat_rooms
      WHERE chat_rooms.id = chat_room_id
      AND (chat_rooms.user1_id = auth.uid() OR chat_rooms.user2_id = auth.uid())
    )
  );

-- Policy: Users can update their own messages
CREATE POLICY "Users can update their own messages" 
  ON public.messages 
  FOR UPDATE 
  USING (sender_id = auth.uid());

-- Add last_message column to chat_rooms if it doesn't exist
ALTER TABLE public.chat_rooms 
ADD COLUMN IF NOT EXISTS last_message TEXT;

-- Function to update chat room's updated_at when a message is sent
CREATE OR REPLACE FUNCTION public.update_chat_room_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_rooms
  SET updated_at = NEW.created_at,
      last_message = NEW.content
  WHERE id = NEW.chat_room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update chat room timestamp
CREATE TRIGGER on_message_sent
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_room_timestamp();
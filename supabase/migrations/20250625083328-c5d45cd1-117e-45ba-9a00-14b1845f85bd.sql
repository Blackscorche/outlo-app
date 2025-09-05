
-- Add likes table for stories
CREATE TABLE public.story_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- Add comments table for stories  
CREATE TABLE public.story_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for story_likes
CREATE POLICY "Users can view all story likes" 
  ON public.story_likes 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create their own likes" 
  ON public.story_likes 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" 
  ON public.story_likes 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS policies for story_comments  
CREATE POLICY "Users can view all story comments" 
  ON public.story_comments 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create their own comments" 
  ON public.story_comments 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" 
  ON public.story_comments 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
  ON public.story_comments 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Enable PostGIS extension first
CREATE EXTENSION IF NOT EXISTS postgis;

-- Posts table for storing user posts (photos/videos)
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  caption TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Check-ins table for storing location check-ins
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  description TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Post likes table
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Post comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_is_active ON check_ins(is_active);

-- Only create spatial index if PostGIS is available
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    CREATE INDEX IF NOT EXISTS idx_check_ins_location ON check_ins USING GIST (
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for posts
CREATE POLICY "Users can view all posts" ON posts
  FOR SELECT USING (NOT is_deleted);

CREATE POLICY "Users can create their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON posts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for check_ins
CREATE POLICY "Users can view active check-ins" ON check_ins
  FOR SELECT USING (is_active AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Users can create their own check-ins" ON check_ins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own check-ins" ON check_ins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own check-ins" ON check_ins
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for post_likes
CREATE POLICY "Users can view all likes" ON post_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like posts" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts" ON post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for post_comments
CREATE POLICY "Users can view non-deleted comments" ON post_comments
  FOR SELECT USING (NOT is_deleted);

CREATE POLICY "Users can create comments" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON post_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON post_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update likes count
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update comments count
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
      UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = NEW.post_id;
    ELSIF OLD.is_deleted = true AND NEW.is_deleted = false THEN
      UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_post_likes_count ON post_likes;
CREATE TRIGGER trigger_update_post_likes_count
AFTER INSERT OR DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

DROP TRIGGER IF EXISTS trigger_update_post_comments_count ON post_comments;
CREATE TRIGGER trigger_update_post_comments_count
AFTER INSERT OR UPDATE ON post_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Note: Storage bucket creation should be done in Supabase Dashboard
-- Go to Storage section and create a bucket named 'posts-media' with public access
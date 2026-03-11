-- ============================================
-- Peter Steinberger Landing Page - Database Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment reactions (likes/dislikes)
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT CHECK (reaction_type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON comment_reactions(user_id);

-- Enable Row Level Security
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- Comments RLS policies
-- Anyone can read comments
CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

-- Authenticated users can insert comments
CREATE POLICY "Authenticated users can insert comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Comment reactions RLS policies
-- Anyone can read reactions
CREATE POLICY "Reactions are viewable by everyone"
  ON comment_reactions FOR SELECT
  USING (true);

-- Authenticated users can insert reactions
CREATE POLICY "Authenticated users can insert reactions"
  ON comment_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reactions
CREATE POLICY "Users can update own reactions"
  ON comment_reactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions"
  ON comment_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to get comment counts (likes/dislikes)
CREATE OR REPLACE FUNCTION get_comment_counts(comment_id UUID)
RETURNS TABLE(
  likes BIGINT,
  dislikes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN reaction_type = 'like' THEN 1 ELSE 0 END), 0) as likes,
    COALESCE(SUM(CASE WHEN reaction_type = 'dislike' THEN 1 ELSE 0 END), 0) as dislikes
  FROM comment_reactions
  WHERE comment_reactions.comment_id = get_comment_counts.comment_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's reaction on a comment
CREATE OR REPLACE FUNCTION get_user_reaction(target_comment_id UUID, target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_reaction TEXT;
BEGIN
  SELECT reaction_type INTO user_reaction
  FROM comment_reactions
  WHERE comment_id = target_comment_id AND user_id = target_user_id;
  RETURN COALESCE(user_reaction, 'none');
END;
$$ LANGUAGE plpgsql;

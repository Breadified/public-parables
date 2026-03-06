-- Migration: Apologetics Comments Feature
-- Creates tables for public community comments on daily apologetics questions
-- Questions are stored in app bundle (JSON), only comments/likes in Supabase

-- 1. APOLOGETICS COMMENTS
-- Stores user comments on apologetics questions (question_id references bundled JSON GUID)
CREATE TABLE IF NOT EXISTS public.apologetics_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id TEXT NOT NULL,                    -- GUID referencing bundled question JSON
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.apologetics_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,                 -- Denormalized for performance
    reply_count INTEGER DEFAULT 0,                -- Denormalized for performance
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_apologetics_comments_question_id ON public.apologetics_comments(question_id);
CREATE INDEX idx_apologetics_comments_user_id ON public.apologetics_comments(user_id);
CREATE INDEX idx_apologetics_comments_parent_id ON public.apologetics_comments(parent_comment_id);
CREATE INDEX idx_apologetics_comments_status ON public.apologetics_comments(status);
CREATE INDEX idx_apologetics_comments_created_at ON public.apologetics_comments(created_at DESC);

-- RLS Policies
ALTER TABLE public.apologetics_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read active comments
CREATE POLICY "Comments are publicly readable" ON public.apologetics_comments
    FOR SELECT USING (status = 'active');

-- Authenticated users can insert their own comments
CREATE POLICY "Users can insert own comments" ON public.apologetics_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON public.apologetics_comments
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can soft-delete (set status=inactive) their own comments
CREATE POLICY "Users can delete own comments" ON public.apologetics_comments
    FOR DELETE USING (auth.uid() = user_id);


-- 2. COMMENT LIKES
-- Tracks which users liked which comments
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.apologetics_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)                   -- One like per user per comment
);

-- Indexes for common queries
CREATE INDEX idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user_id ON public.comment_likes(user_id);

-- RLS Policies
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can see likes
CREATE POLICY "Likes are publicly readable" ON public.comment_likes
    FOR SELECT USING (true);

-- Authenticated users can insert their own likes
CREATE POLICY "Users can insert own likes" ON public.comment_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can remove their own likes
CREATE POLICY "Users can delete own likes" ON public.comment_likes
    FOR DELETE USING (auth.uid() = user_id);


-- 3. TRIGGERS for denormalized counts
-- Automatically update like_count when likes are added/removed
CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.apologetics_comments
        SET like_count = like_count + 1
        WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.apologetics_comments
        SET like_count = GREATEST(0, like_count - 1)
        WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_like_count
    AFTER INSERT OR DELETE ON public.comment_likes
    FOR EACH ROW EXECUTE FUNCTION update_comment_like_count();


-- Automatically update reply_count when replies are added/removed
CREATE OR REPLACE FUNCTION update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        UPDATE public.apologetics_comments
        SET reply_count = reply_count + 1
        WHERE id = NEW.parent_comment_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        UPDATE public.apologetics_comments
        SET reply_count = GREATEST(0, reply_count - 1)
        WHERE id = OLD.parent_comment_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes (soft delete)
        IF OLD.status = 'active' AND NEW.status = 'inactive' AND NEW.parent_comment_id IS NOT NULL THEN
            UPDATE public.apologetics_comments
            SET reply_count = GREATEST(0, reply_count - 1)
            WHERE id = NEW.parent_comment_id;
        ELSIF OLD.status = 'inactive' AND NEW.status = 'active' AND NEW.parent_comment_id IS NOT NULL THEN
            UPDATE public.apologetics_comments
            SET reply_count = reply_count + 1
            WHERE id = NEW.parent_comment_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_reply_count
    AFTER INSERT OR DELETE OR UPDATE OF status ON public.apologetics_comments
    FOR EACH ROW EXECUTE FUNCTION update_comment_reply_count();


-- 4. AUTO-UPDATE updated_at timestamp
CREATE OR REPLACE FUNCTION update_apologetics_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_apologetics_comment_updated_at
    BEFORE UPDATE ON public.apologetics_comments
    FOR EACH ROW EXECUTE FUNCTION update_apologetics_comment_updated_at();


-- 5. Enable realtime for live comment updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.apologetics_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;

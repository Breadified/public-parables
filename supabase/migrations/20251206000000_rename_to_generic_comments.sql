-- Migration: Rename apologetics_comments to comments (generic)
-- Makes the comments table generic for use with any content type (questions, verses, notes, etc.)

-- 1. DROP existing triggers that reference the old table name
DROP TRIGGER IF EXISTS trigger_update_reply_count ON public.apologetics_comments;
DROP TRIGGER IF EXISTS trigger_update_apologetics_comment_updated_at ON public.apologetics_comments;

-- 2. RENAME the table
ALTER TABLE public.apologetics_comments RENAME TO comments;

-- 3. RENAME indexes to match new table name
ALTER INDEX idx_apologetics_comments_question_id RENAME TO idx_comments_question_id;
ALTER INDEX idx_apologetics_comments_user_id RENAME TO idx_comments_user_id;
ALTER INDEX idx_apologetics_comments_parent_id RENAME TO idx_comments_parent_id;
ALTER INDEX idx_apologetics_comments_status RENAME TO idx_comments_status;
ALTER INDEX idx_apologetics_comments_created_at RENAME TO idx_comments_created_at;

-- 4. DROP old RLS policies and create new ones with updated names
DROP POLICY IF EXISTS "Comments are publicly readable" ON public.comments;
DROP POLICY IF EXISTS "Users can insert own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

-- Recreate RLS policies with same logic
CREATE POLICY "Comments are publicly readable" ON public.comments
    FOR SELECT USING (status = 'active');

CREATE POLICY "Users can insert own comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

-- 5. UPDATE the trigger functions to reference new table name
CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.comments
        SET like_count = like_count + 1
        WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.comments
        SET like_count = GREATEST(0, like_count - 1)
        WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        UPDATE public.comments
        SET reply_count = reply_count + 1
        WHERE id = NEW.parent_comment_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        UPDATE public.comments
        SET reply_count = GREATEST(0, reply_count - 1)
        WHERE id = OLD.parent_comment_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes (soft delete)
        IF OLD.status = 'active' AND NEW.status = 'inactive' AND NEW.parent_comment_id IS NOT NULL THEN
            UPDATE public.comments
            SET reply_count = GREATEST(0, reply_count - 1)
            WHERE id = NEW.parent_comment_id;
        ELSIF OLD.status = 'inactive' AND NEW.status = 'active' AND NEW.parent_comment_id IS NOT NULL THEN
            UPDATE public.comments
            SET reply_count = reply_count + 1
            WHERE id = NEW.parent_comment_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old updated_at function and create generic one
DROP FUNCTION IF EXISTS update_apologetics_comment_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. RECREATE triggers with new table name
CREATE TRIGGER trigger_update_reply_count
    AFTER INSERT OR DELETE OR UPDATE OF status ON public.comments
    FOR EACH ROW EXECUTE FUNCTION update_comment_reply_count();

CREATE TRIGGER trigger_update_comment_updated_at
    BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION update_comment_updated_at();

-- 7. UPDATE realtime publication (remove old, add new if needed)
-- Note: The FK constraint on comment_likes automatically follows the rename
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.apologetics_comments; -- Already renamed
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.comments; -- Should already be there after rename

-- 8. RENAME question_id to be more generic (optional future extension)
-- For now, keep question_id as is - it can reference any content type's GUID
-- Future: Could add content_type column to distinguish between question comments, verse comments, etc.

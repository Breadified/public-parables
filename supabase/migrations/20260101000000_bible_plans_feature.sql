-- Migration: Bible Plans Feature
-- Creates tables for plan sessions, shared sessions, participants, and per-day comments
-- Plan definitions are stored in SQLite (bundled), user data in Supabase

-- ============================================================================
-- 1. CREATE ALL TABLES FIRST (before any RLS policies that reference them)
-- ============================================================================

-- Plan Sessions - User's personal plan instances
CREATE TABLE IF NOT EXISTS public.plan_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id TEXT NOT NULL,                          -- References bundled SQLite plan ID
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    current_day INTEGER DEFAULT 1,                   -- Current progress (1-based)
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,                        -- Set when plan is completed
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared Sessions - Group Bible study sessions
CREATE TABLE IF NOT EXISTS public.shared_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_session_id UUID NOT NULL REFERENCES public.plan_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                              -- Group/session name
    invite_code TEXT UNIQUE NOT NULL,                -- 8-char alphanumeric code
    owner_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Participants - Users in shared sessions
CREATE TABLE IF NOT EXISTS public.session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_session_id UUID NOT NULL REFERENCES public.shared_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    current_day INTEGER DEFAULT 1,                   -- Individual progress (real-time shared)
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shared_session_id, user_id)
);

-- Session Comments - Per-day comments on shared sessions
CREATE TABLE IF NOT EXISTS public.session_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_session_id UUID NOT NULL REFERENCES public.shared_sessions(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,                     -- Which day of the plan
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.session_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,                    -- Denormalized for performance
    reply_count INTEGER DEFAULT 0,                   -- Denormalized for performance
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Comment Likes
CREATE TABLE IF NOT EXISTS public.session_comment_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.session_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);


-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- Plan Sessions indexes
CREATE INDEX idx_plan_sessions_user_id ON public.plan_sessions(user_id);
CREATE INDEX idx_plan_sessions_plan_id ON public.plan_sessions(plan_id);
CREATE INDEX idx_plan_sessions_status ON public.plan_sessions(status);

-- Shared Sessions indexes
CREATE INDEX idx_shared_sessions_owner ON public.shared_sessions(owner_user_id);
CREATE INDEX idx_shared_sessions_invite_code ON public.shared_sessions(invite_code);
CREATE INDEX idx_shared_sessions_status ON public.shared_sessions(status);

-- Session Participants indexes
CREATE INDEX idx_session_participants_session ON public.session_participants(shared_session_id);
CREATE INDEX idx_session_participants_user ON public.session_participants(user_id);
CREATE INDEX idx_session_participants_status ON public.session_participants(status);

-- Session Comments indexes
CREATE INDEX idx_session_comments_session ON public.session_comments(shared_session_id);
CREATE INDEX idx_session_comments_session_day ON public.session_comments(shared_session_id, day_number);
CREATE INDEX idx_session_comments_user ON public.session_comments(user_id);
CREATE INDEX idx_session_comments_parent ON public.session_comments(parent_comment_id);
CREATE INDEX idx_session_comments_status ON public.session_comments(status);
CREATE INDEX idx_session_comments_created ON public.session_comments(created_at DESC);

-- Session Comment Likes indexes
CREATE INDEX idx_session_comment_likes_comment ON public.session_comment_likes(comment_id);
CREATE INDEX idx_session_comment_likes_user ON public.session_comment_likes(user_id);


-- ============================================================================
-- 3. ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.plan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_comment_likes ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 4. CREATE RLS POLICIES (after all tables exist)
-- ============================================================================

-- Plan Sessions policies
CREATE POLICY "Users can manage own plan sessions" ON public.plan_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Shared Sessions policies
CREATE POLICY "Owners can manage own shared sessions" ON public.shared_sessions
    FOR ALL USING (auth.uid() = owner_user_id);

CREATE POLICY "Participants can view shared sessions" ON public.shared_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.session_participants
            WHERE session_participants.shared_session_id = shared_sessions.id
            AND session_participants.user_id = auth.uid()
            AND session_participants.status = 'active'
        )
    );

CREATE POLICY "Anyone can view session by invite code for joining" ON public.shared_sessions
    FOR SELECT USING (
        invite_code IS NOT NULL
        AND status = 'active'
    );

-- Session Participants policies
CREATE POLICY "Participants can view other participants" ON public.session_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.session_participants AS my_membership
            WHERE my_membership.shared_session_id = session_participants.shared_session_id
            AND my_membership.user_id = auth.uid()
            AND my_membership.status = 'active'
        )
    );

CREATE POLICY "Users can join shared sessions" ON public.session_participants
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.shared_sessions
            WHERE id = shared_session_id
            AND status = 'active'
        )
    );

CREATE POLICY "Users can update own participation" ON public.session_participants
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Session owners can manage participants" ON public.session_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.shared_sessions
            WHERE id = session_participants.shared_session_id
            AND owner_user_id = auth.uid()
        )
    );

-- Session Comments policies
CREATE POLICY "Participants can read session comments" ON public.session_comments
    FOR SELECT USING (
        status = 'active'
        AND EXISTS (
            SELECT 1 FROM public.session_participants
            WHERE session_participants.shared_session_id = session_comments.shared_session_id
            AND session_participants.user_id = auth.uid()
            AND session_participants.status = 'active'
        )
    );

CREATE POLICY "Participants can insert comments" ON public.session_comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.session_participants
            WHERE session_participants.shared_session_id = session_comments.shared_session_id
            AND session_participants.user_id = auth.uid()
            AND session_participants.status = 'active'
        )
    );

CREATE POLICY "Users can update own comments" ON public.session_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.session_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Session Comment Likes policies
CREATE POLICY "Participants can see likes" ON public.session_comment_likes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.session_comments sc
            JOIN public.session_participants sp ON sp.shared_session_id = sc.shared_session_id
            WHERE sc.id = session_comment_likes.comment_id
            AND sp.user_id = auth.uid()
            AND sp.status = 'active'
        )
    );

CREATE POLICY "Users can insert own likes" ON public.session_comment_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.session_comment_likes
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Auto-generate invite code when shared session is created
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_invite_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invite_code IS NULL THEN
        LOOP
            NEW.invite_code := generate_invite_code();
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM public.shared_sessions WHERE invite_code = NEW.invite_code
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invite_code
    BEFORE INSERT ON public.shared_sessions
    FOR EACH ROW EXECUTE FUNCTION set_invite_code();


-- Auto-add owner as participant when shared session is created
CREATE OR REPLACE FUNCTION add_owner_as_participant()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.session_participants (shared_session_id, user_id, role)
    VALUES (NEW.id, NEW.owner_user_id, 'owner')
    ON CONFLICT (shared_session_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER trigger_add_owner_as_participant
    AFTER INSERT ON public.shared_sessions
    FOR EACH ROW EXECUTE FUNCTION add_owner_as_participant();


-- Update like_count when likes are added/removed
CREATE OR REPLACE FUNCTION update_session_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.session_comments
        SET like_count = like_count + 1
        WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.session_comments
        SET like_count = GREATEST(0, like_count - 1)
        WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER trigger_update_session_comment_like_count
    AFTER INSERT OR DELETE ON public.session_comment_likes
    FOR EACH ROW EXECUTE FUNCTION update_session_comment_like_count();


-- Update reply_count when replies are added/removed
CREATE OR REPLACE FUNCTION update_session_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        UPDATE public.session_comments
        SET reply_count = reply_count + 1
        WHERE id = NEW.parent_comment_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        UPDATE public.session_comments
        SET reply_count = GREATEST(0, reply_count - 1)
        WHERE id = OLD.parent_comment_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle soft delete
        IF OLD.status = 'active' AND NEW.status = 'inactive' AND NEW.parent_comment_id IS NOT NULL THEN
            UPDATE public.session_comments
            SET reply_count = GREATEST(0, reply_count - 1)
            WHERE id = NEW.parent_comment_id;
        ELSIF OLD.status = 'inactive' AND NEW.status = 'active' AND NEW.parent_comment_id IS NOT NULL THEN
            UPDATE public.session_comments
            SET reply_count = reply_count + 1
            WHERE id = NEW.parent_comment_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER trigger_update_session_comment_reply_count
    AFTER INSERT OR DELETE OR UPDATE OF status ON public.session_comments
    FOR EACH ROW EXECUTE FUNCTION update_session_comment_reply_count();


-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_plan_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_plan_session_updated_at
    BEFORE UPDATE ON public.plan_sessions
    FOR EACH ROW EXECUTE FUNCTION update_plan_session_updated_at();

CREATE TRIGGER trigger_update_shared_session_updated_at
    BEFORE UPDATE ON public.shared_sessions
    FOR EACH ROW EXECUTE FUNCTION update_plan_session_updated_at();

CREATE TRIGGER trigger_update_session_participant_updated_at
    BEFORE UPDATE ON public.session_participants
    FOR EACH ROW EXECUTE FUNCTION update_plan_session_updated_at();

CREATE TRIGGER trigger_update_session_comment_updated_at
    BEFORE UPDATE ON public.session_comments
    FOR EACH ROW EXECUTE FUNCTION update_plan_session_updated_at();


-- ============================================================================
-- 6. ENABLE REALTIME
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_comment_likes;

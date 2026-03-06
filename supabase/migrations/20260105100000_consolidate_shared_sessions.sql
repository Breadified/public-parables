-- Migration: Consolidate shared_sessions into plan_sessions
-- Removes redundancy by adding sharing columns directly to plan_sessions
-- session_participants and session_comments now reference plan_session_id directly

-- ============================================================================
-- 1. ADD SHARING COLUMNS TO PLAN_SESSIONS
-- ============================================================================

ALTER TABLE public.plan_sessions
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS shared_name TEXT,
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Create index for invite code lookups
CREATE INDEX IF NOT EXISTS idx_plan_sessions_invite_code ON public.plan_sessions(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_plan_sessions_is_shared ON public.plan_sessions(is_shared) WHERE is_shared = TRUE;


-- ============================================================================
-- 2. MIGRATE EXISTING SHARED SESSIONS DATA
-- ============================================================================

-- Update plan_sessions with data from shared_sessions
UPDATE public.plan_sessions ps
SET
    is_shared = TRUE,
    shared_name = ss.name,
    invite_code = ss.invite_code
FROM public.shared_sessions ss
WHERE ps.id = ss.plan_session_id;


-- ============================================================================
-- 3. ADD plan_session_id TO session_participants (keeping shared_session_id temporarily)
-- ============================================================================

ALTER TABLE public.session_participants
ADD COLUMN IF NOT EXISTS plan_session_id UUID REFERENCES public.plan_sessions(id) ON DELETE CASCADE;

-- Migrate data: get plan_session_id from shared_sessions
UPDATE public.session_participants sp
SET plan_session_id = ss.plan_session_id
FROM public.shared_sessions ss
WHERE sp.shared_session_id = ss.id;


-- ============================================================================
-- 4. ADD plan_session_id TO session_comments (keeping shared_session_id temporarily)
-- ============================================================================

ALTER TABLE public.session_comments
ADD COLUMN IF NOT EXISTS plan_session_id UUID REFERENCES public.plan_sessions(id) ON DELETE CASCADE;

-- Migrate data: get plan_session_id from shared_sessions
UPDATE public.session_comments sc
SET plan_session_id = ss.plan_session_id
FROM public.shared_sessions ss
WHERE sc.shared_session_id = ss.id;


-- ============================================================================
-- 5. CREATE NEW INDEXES FOR plan_session_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_session_participants_plan_session ON public.session_participants(plan_session_id);
CREATE INDEX IF NOT EXISTS idx_session_comments_plan_session ON public.session_comments(plan_session_id);
CREATE INDEX IF NOT EXISTS idx_session_comments_plan_session_day ON public.session_comments(plan_session_id, day_number);


-- ============================================================================
-- 6. UPDATE RLS POLICIES FOR PLAN_SESSIONS
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage own plan sessions" ON public.plan_sessions;

-- New policy: owners can manage their sessions
CREATE POLICY "Users can manage own plan sessions" ON public.plan_sessions
    FOR ALL USING (auth.uid() = user_id);

-- New policy: participants can view shared sessions
CREATE POLICY "Participants can view shared plan sessions" ON public.plan_sessions
    FOR SELECT USING (
        is_shared = TRUE
        AND EXISTS (
            SELECT 1 FROM public.session_participants
            WHERE session_participants.plan_session_id = plan_sessions.id
            AND session_participants.user_id = auth.uid()
            AND session_participants.status = 'active'
        )
    );

-- New policy: anyone can view by invite code for joining
CREATE POLICY "Anyone can view session by invite code" ON public.plan_sessions
    FOR SELECT USING (
        invite_code IS NOT NULL
        AND is_shared = TRUE
        AND status = 'active'
    );


-- ============================================================================
-- 7. UPDATE RLS POLICIES FOR SESSION_PARTICIPANTS
-- ============================================================================

-- Drop old policies that reference shared_session_id
DROP POLICY IF EXISTS "Participants can view other participants" ON public.session_participants;
DROP POLICY IF EXISTS "Users can join shared sessions" ON public.session_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON public.session_participants;
DROP POLICY IF EXISTS "Session owners can manage participants" ON public.session_participants;

-- New policies using plan_session_id
CREATE POLICY "Participants can view other participants" ON public.session_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.session_participants AS my_membership
            WHERE my_membership.plan_session_id = session_participants.plan_session_id
            AND my_membership.user_id = auth.uid()
            AND my_membership.status = 'active'
        )
    );

CREATE POLICY "Users can join shared sessions" ON public.session_participants
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.plan_sessions
            WHERE id = plan_session_id
            AND is_shared = TRUE
            AND status = 'active'
        )
    );

CREATE POLICY "Users can update own participation" ON public.session_participants
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Session owners can manage participants" ON public.session_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.plan_sessions
            WHERE id = session_participants.plan_session_id
            AND user_id = auth.uid()
        )
    );


-- ============================================================================
-- 8. UPDATE RLS POLICIES FOR SESSION_COMMENTS
-- ============================================================================

-- Drop old policies that reference shared_session_id
DROP POLICY IF EXISTS "Participants can read session comments" ON public.session_comments;
DROP POLICY IF EXISTS "Participants can insert comments" ON public.session_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.session_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.session_comments;

-- New policies using plan_session_id
CREATE POLICY "Participants can read session comments" ON public.session_comments
    FOR SELECT USING (
        status = 'active'
        AND EXISTS (
            SELECT 1 FROM public.session_participants
            WHERE session_participants.plan_session_id = session_comments.plan_session_id
            AND session_participants.user_id = auth.uid()
            AND session_participants.status = 'active'
        )
    );

CREATE POLICY "Participants can insert comments" ON public.session_comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM public.session_participants
            WHERE session_participants.plan_session_id = session_comments.plan_session_id
            AND session_participants.user_id = auth.uid()
            AND session_participants.status = 'active'
        )
    );

CREATE POLICY "Users can update own comments" ON public.session_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.session_comments
    FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 9. UPDATE RLS POLICIES FOR SESSION_COMMENT_LIKES
-- ============================================================================

-- Drop old policy
DROP POLICY IF EXISTS "Participants can see likes" ON public.session_comment_likes;

-- New policy using plan_session_id
CREATE POLICY "Participants can see likes" ON public.session_comment_likes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.session_comments sc
            JOIN public.session_participants sp ON sp.plan_session_id = sc.plan_session_id
            WHERE sc.id = session_comment_likes.comment_id
            AND sp.user_id = auth.uid()
            AND sp.status = 'active'
        )
    );


-- ============================================================================
-- 10. UPDATE TRIGGERS
-- ============================================================================

-- Update invite code trigger to work on plan_sessions
DROP TRIGGER IF EXISTS trigger_set_invite_code ON public.shared_sessions;

CREATE OR REPLACE FUNCTION set_plan_session_invite_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate invite code for shared sessions without one
    IF NEW.is_shared = TRUE AND NEW.invite_code IS NULL THEN
        LOOP
            NEW.invite_code := generate_invite_code();
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM public.plan_sessions WHERE invite_code = NEW.invite_code
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_plan_session_invite_code
    BEFORE INSERT OR UPDATE OF is_shared ON public.plan_sessions
    FOR EACH ROW EXECUTE FUNCTION set_plan_session_invite_code();


-- Update owner-as-participant trigger to work on plan_sessions
DROP TRIGGER IF EXISTS trigger_add_owner_as_participant ON public.shared_sessions;

CREATE OR REPLACE FUNCTION add_owner_as_participant_v2()
RETURNS TRIGGER AS $$
BEGIN
    -- Only add owner when session becomes shared
    IF NEW.is_shared = TRUE AND (OLD IS NULL OR OLD.is_shared = FALSE) THEN
        INSERT INTO public.session_participants (plan_session_id, user_id, role)
        VALUES (NEW.id, NEW.user_id, 'owner')
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER trigger_add_owner_as_participant_v2
    AFTER INSERT OR UPDATE OF is_shared ON public.plan_sessions
    FOR EACH ROW EXECUTE FUNCTION add_owner_as_participant_v2();


-- ============================================================================
-- 11. DROP OLD COLUMNS AND TABLE (after data migration is verified)
-- ============================================================================

-- Create new unique constraint for session_participants
ALTER TABLE public.session_participants
DROP CONSTRAINT IF EXISTS session_participants_shared_session_id_user_id_key;

-- Clean up duplicate entries before adding unique constraint
-- Keep the entry with the earliest created_at for each plan_session_id + user_id combination
DELETE FROM public.session_participants
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY plan_session_id, user_id
                   ORDER BY created_at ASC
               ) as row_num
        FROM public.session_participants
        WHERE plan_session_id IS NOT NULL
    ) ranked
    WHERE row_num > 1
);

-- Add new unique constraint (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'session_participants_plan_session_id_user_id_key'
    ) THEN
        ALTER TABLE public.session_participants
        ADD CONSTRAINT session_participants_plan_session_id_user_id_key
        UNIQUE (plan_session_id, user_id);
    END IF;
END $$;

-- Drop old foreign key constraint and column from session_participants
ALTER TABLE public.session_participants
DROP CONSTRAINT IF EXISTS session_participants_shared_session_id_fkey;

-- Drop any remaining policies that reference shared_session_id
DROP POLICY IF EXISTS "Users can view own participation and co-participants" ON public.session_participants;

ALTER TABLE public.session_participants
DROP COLUMN IF EXISTS shared_session_id;

-- Drop old foreign key constraint and column from session_comments
ALTER TABLE public.session_comments
DROP CONSTRAINT IF EXISTS session_comments_shared_session_id_fkey;

ALTER TABLE public.session_comments
DROP COLUMN IF EXISTS shared_session_id;

-- Drop old indexes
DROP INDEX IF EXISTS idx_shared_sessions_owner;
DROP INDEX IF EXISTS idx_shared_sessions_invite_code;
DROP INDEX IF EXISTS idx_shared_sessions_status;
DROP INDEX IF EXISTS idx_session_participants_session;
DROP INDEX IF EXISTS idx_session_comments_session;
DROP INDEX IF EXISTS idx_session_comments_session_day;

-- Drop old RLS policies on shared_sessions
DROP POLICY IF EXISTS "Owners can manage own shared sessions" ON public.shared_sessions;
DROP POLICY IF EXISTS "Participants can view shared sessions" ON public.shared_sessions;
DROP POLICY IF EXISTS "Anyone can view session by invite code for joining" ON public.shared_sessions;

-- Remove from realtime (ignore if not in publication)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.shared_sessions;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Drop the shared_sessions table
DROP TABLE IF EXISTS public.shared_sessions CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS add_owner_as_participant();
DROP FUNCTION IF EXISTS set_invite_code();

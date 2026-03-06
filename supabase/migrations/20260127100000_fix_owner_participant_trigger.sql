-- Migration: Fix add_owner_as_participant_v2 trigger
-- Issue: ON CONFLICT DO NOTHING without explicit conflict target can fail silently
-- This caused session owners to not be added to session_participants table,
-- making their own shared sessions invisible to them.

-- ============================================================================
-- 1. FIX THE TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION add_owner_as_participant_v2()
RETURNS TRIGGER AS $$
BEGIN
    -- Only add owner when session becomes shared
    IF NEW.is_shared = TRUE AND (OLD IS NULL OR OLD.is_shared = FALSE) THEN
        INSERT INTO public.session_participants (plan_session_id, user_id, role, status)
        VALUES (NEW.id, NEW.user_id, 'owner', 'active')
        ON CONFLICT (plan_session_id, user_id) DO UPDATE
        SET role = 'owner', status = 'active';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- 2. BACKFILL MISSING OWNER PARTICIPANTS
-- Add owners to session_participants for any shared sessions where they're missing
-- ============================================================================

INSERT INTO public.session_participants (plan_session_id, user_id, role, status)
SELECT
    ps.id,
    ps.user_id,
    'owner',
    'active'
FROM public.plan_sessions ps
WHERE ps.is_shared = TRUE
  AND ps.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.plan_session_id = ps.id
      AND sp.user_id = ps.user_id
  )
ON CONFLICT (plan_session_id, user_id) DO UPDATE
SET role = 'owner', status = 'active';

-- Also fix any owners who exist but have inactive status
UPDATE public.session_participants sp
SET status = 'active', role = 'owner'
FROM public.plan_sessions ps
WHERE sp.plan_session_id = ps.id
  AND sp.user_id = ps.user_id
  AND ps.is_shared = TRUE
  AND ps.status = 'active'
  AND (sp.status = 'inactive' OR sp.role != 'owner');

-- Migration: Add admin role to session_participants
-- This allows multiple admins to manage shared sessions

-- 1. Update the role check constraint to include 'admin'
ALTER TABLE session_participants
DROP CONSTRAINT IF EXISTS session_participants_role_check;

ALTER TABLE session_participants
ADD CONSTRAINT session_participants_role_check
CHECK (role IN ('owner', 'admin', 'member'));

-- 2. Add helper function to check if user is admin (owner or admin role)
CREATE OR REPLACE FUNCTION is_session_admin(session_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_participants
    WHERE plan_session_id = session_id
    AND user_id = check_user_id
    AND role IN ('owner', 'admin')
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Add RLS policy for admins to manage members
-- Admins can remove members (but not other admins or owner)
DROP POLICY IF EXISTS "Admins can remove members" ON session_participants;
CREATE POLICY "Admins can remove members"
  ON session_participants
  FOR UPDATE
  USING (
    -- Allow if caller is admin of this session
    is_session_admin(plan_session_id, auth.uid())
    -- And target is a regular member (not admin or owner)
    AND role = 'member'
  )
  WITH CHECK (
    -- Can only set status to inactive (soft delete)
    status = 'inactive'
  );

-- 4. Add RLS policy for owner to promote/demote admins
DROP POLICY IF EXISTS "Owner can manage admin roles" ON session_participants;
CREATE POLICY "Owner can manage admin roles"
  ON session_participants
  FOR UPDATE
  USING (
    -- Caller must be the owner
    is_session_owner(plan_session_id, auth.uid())
    -- Target must not be the owner themselves
    AND NOT is_session_owner(plan_session_id, user_id)
  )
  WITH CHECK (
    -- Can change role between admin and member
    role IN ('admin', 'member')
  );

-- 5. Add function to transfer ownership
CREATE OR REPLACE FUNCTION transfer_session_ownership(
  session_id UUID,
  new_owner_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  current_owner_id UUID;
BEGIN
  -- Get current owner
  SELECT user_id INTO current_owner_id
  FROM plan_sessions
  WHERE id = session_id;

  -- Verify caller is the current owner
  IF current_owner_id != auth.uid() THEN
    RETURN FALSE;
  END IF;

  -- Verify new owner is an active participant
  IF NOT EXISTS (
    SELECT 1 FROM session_participants
    WHERE plan_session_id = session_id
    AND user_id = new_owner_id
    AND status = 'active'
  ) THEN
    RETURN FALSE;
  END IF;

  -- Update plan_sessions owner
  UPDATE plan_sessions
  SET user_id = new_owner_id, updated_at = NOW()
  WHERE id = session_id;

  -- Update old owner's role to admin (they stay as participant)
  UPDATE session_participants
  SET role = 'admin', updated_at = NOW()
  WHERE plan_session_id = session_id
  AND user_id = current_owner_id;

  -- Update new owner's role
  UPDATE session_participants
  SET role = 'owner', updated_at = NOW()
  WHERE plan_session_id = session_id
  AND user_id = new_owner_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant execute permission on new function
GRANT EXECUTE ON FUNCTION transfer_session_ownership(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_session_admin(UUID, UUID) TO authenticated;

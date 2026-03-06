-- =============================================================================
-- Activity Streaks Feature
-- Tracks consecutive days of activity for login, reading, and notes
-- =============================================================================

-- user_activity_streaks: Server-side streak tracking per activity type
CREATE TABLE IF NOT EXISTS user_activity_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,  -- 'login', 'reading', 'notes'
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  streak_7_completed BOOLEAN DEFAULT FALSE,
  streak_30_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_type)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_activity_streaks_user ON user_activity_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_streaks_type ON user_activity_streaks(activity_type);

-- RLS policies
ALTER TABLE user_activity_streaks ENABLE ROW LEVEL SECURITY;

-- Users can read their own streaks
CREATE POLICY "Users can read own streaks" ON user_activity_streaks
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own streaks
CREATE POLICY "Users can insert own streaks" ON user_activity_streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own streaks
CREATE POLICY "Users can update own streaks" ON user_activity_streaks
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update streak for an activity
CREATE OR REPLACE FUNCTION update_activity_streak(
  p_user_id UUID,
  p_activity_type TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  new_streak INTEGER,
  streak_7_milestone BOOLEAN,
  streak_30_milestone BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_streak INTEGER;
  v_last_date DATE;
  v_streak_7_completed BOOLEAN;
  v_streak_30_completed BOOLEAN;
  v_new_streak INTEGER;
  v_streak_7_milestone BOOLEAN := FALSE;
  v_streak_30_milestone BOOLEAN := FALSE;
BEGIN
  -- Get or create streak record
  SELECT current_streak, last_activity_date, streak_7_completed, streak_30_completed
  INTO v_current_streak, v_last_date, v_streak_7_completed, v_streak_30_completed
  FROM user_activity_streaks
  WHERE user_id = p_user_id AND activity_type = p_activity_type;

  IF NOT FOUND THEN
    -- Create new record
    INSERT INTO user_activity_streaks (user_id, activity_type, current_streak, last_activity_date)
    VALUES (p_user_id, p_activity_type, 1, p_date);
    RETURN QUERY SELECT 1, FALSE, FALSE;
    RETURN;
  END IF;

  -- Already recorded today
  IF v_last_date = p_date THEN
    RETURN QUERY SELECT v_current_streak, FALSE, FALSE;
    RETURN;
  END IF;

  -- Calculate new streak
  IF v_last_date = p_date - 1 THEN
    -- Consecutive day
    v_new_streak := v_current_streak + 1;
  ELSE
    -- Streak broken
    v_new_streak := 1;
  END IF;

  -- Check for milestones (only trigger once)
  IF v_new_streak >= 7 AND NOT v_streak_7_completed THEN
    v_streak_7_milestone := TRUE;
    v_streak_7_completed := TRUE;
  END IF;

  IF v_new_streak >= 30 AND NOT v_streak_30_completed THEN
    v_streak_30_milestone := TRUE;
    v_streak_30_completed := TRUE;
  END IF;

  -- Update record
  UPDATE user_activity_streaks
  SET
    current_streak = v_new_streak,
    last_activity_date = p_date,
    streak_7_completed = v_streak_7_completed,
    streak_30_completed = v_streak_30_completed,
    updated_at = NOW()
  WHERE user_id = p_user_id AND activity_type = p_activity_type;

  RETURN QUERY SELECT v_new_streak, v_streak_7_milestone, v_streak_30_milestone;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_activity_streak TO authenticated;

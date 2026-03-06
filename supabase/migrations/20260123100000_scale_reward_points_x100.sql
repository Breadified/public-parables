-- Migration: Reward points scaling (no-op)
-- New reward values are applied in code only.
-- Existing records keep their original values.
-- This is intentional - old rewards were earned at old rates.

-- No database changes needed.
SELECT 1;

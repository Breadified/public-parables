-- Allow spaces and emojis in display names
-- Previous constraint: ^[a-zA-Z0-9_]{3,20}$ (alphanumeric only)
-- New constraint: 3-30 characters, no leading/trailing whitespace

-- Drop the old restrictive constraint
ALTER TABLE public.user_display_names
DROP CONSTRAINT IF EXISTS valid_display_name;

-- Add new permissive constraint
-- Rules:
--   1. 3-30 characters (char_length handles Unicode properly)
--   2. No leading or trailing whitespace
--   3. Not empty after trimming
ALTER TABLE public.user_display_names
ADD CONSTRAINT valid_display_name CHECK (
  char_length(display_name) >= 3 AND
  char_length(display_name) <= 30 AND
  display_name = trim(display_name) AND
  trim(display_name) <> ''
);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT valid_display_name ON public.user_display_names IS
  'Display names must be 3-30 characters with no leading/trailing whitespace. Emojis and spaces allowed.';

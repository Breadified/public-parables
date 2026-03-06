-- Add is_humans_only column to comments table
-- When true, this comment (and all its descendants) will not be visible to Kenny AI

ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS is_humans_only BOOLEAN DEFAULT false NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.comments.is_humans_only IS 'When true, Kenny AI cannot see this comment or respond to it. If a parent comment has this flag, all replies are also hidden from AI.';

-- Add partial index for efficient querying of humans-only comments
CREATE INDEX IF NOT EXISTS idx_comments_humans_only
ON public.comments(is_humans_only)
WHERE is_humans_only = true;

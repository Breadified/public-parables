-- Add is_anonymous column to comments table
-- Allows users to post comments anonymously while still maintaining ownership for edit/delete

ALTER TABLE public.comments
ADD COLUMN is_anonymous BOOLEAN DEFAULT false NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.comments.is_anonymous IS 'When true, display name is hidden and shown as Anonymous';

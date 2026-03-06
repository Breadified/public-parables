-- Migration: Add status field for generic soft delete across all user entities
-- Created: 2025-11-22
-- Purpose: Replace separate softDeletedNotes arrays with status field for consistent soft delete

-- Add status column to notes table
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
CHECK (status IN ('active', 'inactive'));

-- Create index for efficient filtering by status
CREATE INDEX IF NOT EXISTS idx_notes_status ON public.notes(status);

-- Add status column to bookmarks table
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
CHECK (status IN ('active', 'inactive'));

-- Create index for efficient filtering by status
CREATE INDEX IF NOT EXISTS idx_bookmarks_status ON public.bookmarks(status);

-- Comments for clarity
COMMENT ON COLUMN public.notes.status IS 'Soft delete status: active (visible) or inactive (soft deleted)';
COMMENT ON COLUMN public.bookmarks.status IS 'Soft delete status: active (visible) or inactive (soft deleted)';

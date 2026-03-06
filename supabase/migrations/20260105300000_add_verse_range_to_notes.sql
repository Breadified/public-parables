-- ============================================================================
-- ADD VERSE RANGE COLUMNS TO NOTES
-- ============================================================================
-- Adds verse_start_id and verse_end_id for multi-verse note selections
-- These allow notes to reference a range of verses (e.g., John 3:16-18)
-- ============================================================================

-- Add verse_start_id column (start of verse range)
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS verse_start_id BIGINT;

-- Add verse_end_id column (end of verse range)
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS verse_end_id BIGINT;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_notes_verse_start_id ON public.notes(verse_start_id);
CREATE INDEX IF NOT EXISTS idx_notes_verse_end_id ON public.notes(verse_end_id);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Added columns:
-- - verse_start_id: Start of verse range (BIGINT, nullable)
-- - verse_end_id: End of verse range (BIGINT, nullable)
-- ============================================================================

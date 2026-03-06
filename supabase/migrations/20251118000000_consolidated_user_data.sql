-- ============================================================================
-- CONSOLIDATED SUPABASE MIGRATION
-- ============================================================================
-- This script creates all necessary tables for the Parables app
-- Bible data (books, chapters, verses) is stored in SQLite locally
-- User data (profiles, notes, bookmarks) is stored in Supabase
-- ============================================================================

-- ============================================================================
-- 1. USER PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    preferred_version TEXT DEFAULT 'ESV',
    reading_plan_id UUID,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON public.user_profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_version ON public.user_profiles(preferred_version);
CREATE INDEX IF NOT EXISTS idx_user_profiles_settings ON public.user_profiles USING gin(settings);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, display_name)
    VALUES (new.id, new.email);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. BOOKMARKS (Modified - removed FK to verse_lines)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    verse_line_id TEXT NOT NULL, -- Logical reference to SQLite verse_lines.id
    title TEXT,
    color TEXT DEFAULT '#FFD700',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, verse_line_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_verse_line_id ON public.bookmarks(verse_line_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON public.bookmarks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_tags ON public.bookmarks USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_bookmarks_color ON public.bookmarks(color);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 3. NOTES (Modified - removed FKs to Bible tables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    -- Logical references to SQLite tables (no FK constraints)
    book_id BIGINT,           -- References SQLite books.id
    chapter_id BIGINT,        -- References SQLite chapters.id
    verse_id BIGINT,          -- Verse ID format: BBCCCVVV (e.g., 43003016)
    verse_line_id TEXT,       -- References SQLite verse_lines.id

    title TEXT,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    is_private BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    edit_history TIMESTAMPTZ[] DEFAULT '{}',

    formatting_type TEXT DEFAULT 'prose' CHECK (formatting_type IN ('prose', 'poetry', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_book_id ON public.notes(book_id);
CREATE INDEX IF NOT EXISTS idx_notes_chapter_id ON public.notes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_notes_verse_id ON public.notes(verse_id);
CREATE INDEX IF NOT EXISTS idx_notes_verse_line_id ON public.notes(verse_line_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON public.notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON public.notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_tags ON public.notes USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_notes_is_private ON public.notes(is_private);
CREATE INDEX IF NOT EXISTS idx_notes_content_search ON public.notes USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_notes_title_search ON public.notes USING gin(to_tsvector('english', title));

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes" ON public.notes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON public.notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON public.notes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON public.notes
    FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_note_edit_history()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.edit_history = array_append(OLD.edit_history, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_note_edit_history ON public.notes;
CREATE TRIGGER trigger_update_note_edit_history
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_note_edit_history();

-- ============================================================================
-- 4. DISPLAY NAMES (username#0000 system)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_display_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    discriminator INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_display_name_discriminator UNIQUE (display_name, discriminator),
    CONSTRAINT valid_display_name CHECK (display_name ~ '^[a-zA-Z0-9_]{3,20}$'),
    CONSTRAINT positive_discriminator CHECK (discriminator >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_display_names_user_id ON public.user_display_names(user_id);
CREATE INDEX IF NOT EXISTS idx_user_display_names_display_name ON public.user_display_names(display_name);
CREATE INDEX IF NOT EXISTS idx_user_display_names_combo ON public.user_display_names(display_name, discriminator);

CREATE OR REPLACE FUNCTION public.generate_unique_discriminator(p_display_name TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_discriminator INTEGER;
BEGIN
    LOCK TABLE public.user_display_names IN SHARE ROW EXCLUSIVE MODE;

    SELECT COALESCE(MAX(discriminator), -1)
    INTO v_max_discriminator
    FROM public.user_display_names
    WHERE display_name = p_display_name;

    IF v_max_discriminator = -1 THEN
        RETURN 0;
    END IF;

    IF v_max_discriminator < 9999 THEN
        RETURN v_max_discriminator + 1;
    END IF;

    IF v_max_discriminator = 9999 THEN
        RETURN 10001;
    END IF;

    RETURN v_max_discriminator + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_full_display_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_display_name TEXT;
    v_discriminator INTEGER;
BEGIN
    SELECT display_name, discriminator
    INTO v_display_name, v_discriminator
    FROM public.user_display_names
    WHERE user_id = p_user_id;

    IF v_display_name IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN v_display_name || '#' || LPAD(v_discriminator::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_display_names_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_user_display_names_updated_at ON public.user_display_names;
CREATE TRIGGER trigger_update_user_display_names_updated_at
    BEFORE UPDATE ON public.user_display_names
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_display_names_updated_at();

ALTER TABLE public.user_display_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Display names are publicly viewable" ON public.user_display_names
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own display name" ON public.user_display_names
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own display name" ON public.user_display_names
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users cannot delete display names" ON public.user_display_names
    FOR DELETE USING (false);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
-- - user_profiles: Extended user information
-- - bookmarks: User saved verses (logical refs to SQLite)
-- - notes: User study notes (logical refs to SQLite)
-- - user_display_names: Unique username#0000 system
--
-- All tables have Row Level Security (RLS) enabled
-- All user data is isolated per user via RLS policies
-- ============================================================================

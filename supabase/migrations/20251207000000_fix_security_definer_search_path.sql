-- Migration: Fix SECURITY DEFINER functions with SET search_path
-- This resolves the "Function search path mutable" security warnings
-- All SECURITY DEFINER functions must have SET search_path = '' to prevent
-- search path manipulation attacks.

-- ============================================================================
-- 1. handle_new_user() - Creates user profile and display name on signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_discriminator INTEGER;
    v_default_display_name TEXT;
BEGIN
    -- Create user profile WITHOUT display_name (removed redundant column)
    INSERT INTO public.user_profiles (id)
    VALUES (new.id);

    -- Generate default display name from email username part
    -- Example: "john.doe@gmail.com" -> "johndoe"
    v_default_display_name := REGEXP_REPLACE(
        SPLIT_PART(new.email, '@', 1),
        '[^a-zA-Z0-9_]',
        '',
        'g'
    );

    -- Truncate to 20 chars max (schema constraint)
    v_default_display_name := SUBSTRING(v_default_display_name FROM 1 FOR 20);

    -- Ensure minimum 3 chars (schema constraint)
    -- If too short, use "user" + first 8 chars of UUID
    IF LENGTH(v_default_display_name) < 3 THEN
        v_default_display_name := 'user' || SUBSTRING(new.id::text FROM 1 FOR 8);
    END IF;

    -- Generate unique discriminator (0-9999, then 10001+)
    v_discriminator := public.generate_unique_discriminator(v_default_display_name);

    -- Auto-create display name entry with is_customized = FALSE
    -- This happens atomically with user creation, preventing race conditions
    INSERT INTO public.user_display_names (user_id, display_name, discriminator, is_customized)
    VALUES (new.id, v_default_display_name, v_discriminator, FALSE);

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 2. generate_unique_discriminator() - Generates unique discriminators for display names
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_unique_discriminator(p_display_name TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- ============================================================================
-- 3. update_user_display_name() - Updates user display name and sets is_customized
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_user_display_name(
    p_user_id UUID,
    p_new_display_name TEXT
)
RETURNS TABLE (
    display_name TEXT,
    discriminator INTEGER,
    is_customized BOOLEAN
) AS $$
DECLARE
    v_discriminator INTEGER;
    v_old_display_name TEXT;
    v_old_discriminator INTEGER;
BEGIN
    -- Get current display name info
    SELECT udn.display_name, udn.discriminator
    INTO v_old_display_name, v_old_discriminator
    FROM public.user_display_names udn
    WHERE udn.user_id = p_user_id;

    -- If display name changed, generate new discriminator
    IF v_old_display_name != p_new_display_name THEN
        v_discriminator := public.generate_unique_discriminator(p_new_display_name);
    ELSE
        -- Keep existing discriminator if name unchanged
        v_discriminator := v_old_discriminator;
    END IF;

    -- Update the display name and set is_customized = TRUE
    UPDATE public.user_display_names
    SET
        display_name = p_new_display_name,
        discriminator = v_discriminator,
        is_customized = TRUE,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING
        user_display_names.display_name,
        user_display_names.discriminator,
        user_display_names.is_customized
    INTO display_name, discriminator, is_customized;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 4. update_comment_like_count() - Updates like count on comments
-- ============================================================================
CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.comments
        SET like_count = like_count + 1
        WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.comments
        SET like_count = GREATEST(0, like_count - 1)
        WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 5. update_comment_reply_count() - Updates reply count on comments
-- ============================================================================
CREATE OR REPLACE FUNCTION update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        UPDATE public.comments
        SET reply_count = reply_count + 1
        WHERE id = NEW.parent_comment_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        UPDATE public.comments
        SET reply_count = GREATEST(0, reply_count - 1)
        WHERE id = OLD.parent_comment_id;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes (soft delete)
        IF OLD.status = 'active' AND NEW.status = 'inactive' AND NEW.parent_comment_id IS NOT NULL THEN
            UPDATE public.comments
            SET reply_count = GREATEST(0, reply_count - 1)
            WHERE id = NEW.parent_comment_id;
        ELSIF OLD.status = 'inactive' AND NEW.status = 'active' AND NEW.parent_comment_id IS NOT NULL THEN
            UPDATE public.comments
            SET reply_count = reply_count + 1
            WHERE id = NEW.parent_comment_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Fixed functions:
-- 1. handle_new_user() - User signup trigger
-- 2. generate_unique_discriminator() - Display name discriminator generation
-- 3. update_user_display_name() - Display name update RPC
-- 4. update_comment_like_count() - Comment like trigger
-- 5. update_comment_reply_count() - Comment reply trigger
--
-- All SECURITY DEFINER functions now have SET search_path = '' to prevent
-- search path manipulation attacks.
-- ============================================================================

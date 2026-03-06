-- Add is_customized flag to track whether user has customized their display name
-- Auto-generated display names will have is_customized = FALSE
-- User-chosen display names will have is_customized = TRUE

-- Add the column with default FALSE
ALTER TABLE public.user_display_names
ADD COLUMN IF NOT EXISTS is_customized BOOLEAN DEFAULT FALSE NOT NULL;

-- Set all existing display names to is_customized = FALSE (they were all auto-generated)
UPDATE public.user_display_names
SET is_customized = FALSE
WHERE is_customized IS NULL;

-- Update the trigger function to set is_customized = FALSE for auto-generated names
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_discriminator INTEGER;
    v_default_display_name TEXT;
BEGIN
    -- Create user profile (existing functionality)
    INSERT INTO public.user_profiles (id, display_name)
    VALUES (new.id, new.email);

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to update display name and set is_customized = TRUE
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_display_name(UUID, TEXT) TO authenticated;

-- Add RLS policy for updating display names (if it doesn't already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_display_names'
        AND policyname = 'Users can update their own display name'
    ) THEN
        CREATE POLICY "Users can update their own display name"
        ON public.user_display_names
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

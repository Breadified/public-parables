-- Remove redundant display_name column from user_profiles
-- The user_display_names table is the single source of truth for usernames

-- Drop the redundant column
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS display_name;

-- Update the trigger to not set display_name anymore
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

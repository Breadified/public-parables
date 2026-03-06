-- Auto-create display names on user signup
-- This prevents RLS violations and race conditions by handling display name creation server-side

-- Modify existing trigger function to auto-create display names
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

    -- Auto-create display name entry
    -- This happens atomically with user creation, preventing race conditions
    INSERT INTO public.user_display_names (user_id, display_name, discriminator)
    VALUES (new.id, v_default_display_name, v_discriminator);

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing users who don't have display names
-- This ensures all existing users get display names retroactively
INSERT INTO public.user_display_names (user_id, display_name, discriminator)
SELECT
    up.id as user_id,
    CASE
        WHEN LENGTH(REGEXP_REPLACE(
            SPLIT_PART(au.email, '@', 1),
            '[^a-zA-Z0-9_]',
            '',
            'g'
        )) >= 3 THEN
            SUBSTRING(
                REGEXP_REPLACE(
                    SPLIT_PART(au.email, '@', 1),
                    '[^a-zA-Z0-9_]',
                    '',
                    'g'
                ) FROM 1 FOR 20
            )
        ELSE
            'user' || SUBSTRING(up.id::text FROM 1 FOR 8)
    END as display_name,
    public.generate_unique_discriminator(
        CASE
            WHEN LENGTH(REGEXP_REPLACE(
                SPLIT_PART(au.email, '@', 1),
                '[^a-zA-Z0-9_]',
                '',
                'g'
            )) >= 3 THEN
                SUBSTRING(
                    REGEXP_REPLACE(
                        SPLIT_PART(au.email, '@', 1),
                        '[^a-zA-Z0-9_]',
                        '',
                        'g'
                    ) FROM 1 FOR 20
                )
            ELSE
                'user' || SUBSTRING(up.id::text FROM 1 FOR 8)
        END
    ) as discriminator
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
LEFT JOIN public.user_display_names udn ON udn.user_id = up.id
WHERE udn.id IS NULL;

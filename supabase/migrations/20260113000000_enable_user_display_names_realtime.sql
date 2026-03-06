-- Enable realtime for user_display_names table
-- This was missing, causing display name sync to not work when users change their display name

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_display_names;

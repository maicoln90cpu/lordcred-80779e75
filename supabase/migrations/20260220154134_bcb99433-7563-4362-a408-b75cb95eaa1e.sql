
-- Modify handle_new_user to associate existing migrated data with new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_user_id uuid;
BEGIN
    -- Check if a profile already exists with this email (migrated data)
    SELECT user_id INTO old_user_id
    FROM public.profiles
    WHERE email = NEW.email
    LIMIT 1;

    IF old_user_id IS NOT NULL AND old_user_id != NEW.id THEN
        -- Update all references from old user_id to new user_id
        UPDATE public.profiles SET user_id = NEW.id WHERE user_id = old_user_id;
        UPDATE public.user_roles SET user_id = NEW.id WHERE user_id = old_user_id;
        UPDATE public.chips SET user_id = NEW.id WHERE user_id = old_user_id;
    ELSIF old_user_id IS NULL THEN
        -- No existing data, create fresh profile and role
        INSERT INTO public.profiles (user_id, email)
        VALUES (NEW.id, NEW.email);

        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'seller');
    END IF;
    -- If old_user_id = NEW.id, data is already correct, do nothing

    RETURN NEW;
END;
$$;

-- Create the trigger on auth.users (it doesn't exist yet)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

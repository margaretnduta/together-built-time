ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_display_name_len,
  DROP CONSTRAINT IF EXISTS profiles_phone_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_len
    CHECK (char_length(display_name) BETWEEN 1 AND 60),
  ADD CONSTRAINT profiles_phone_format
    CHECK (phone IS NULL OR phone ~ '^\+?[0-9 ()\-]{6,20}$');

CREATE OR REPLACE FUNCTION public.touch_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_profile_updated_at ON public.profiles;
CREATE TRIGGER trg_touch_profile_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_profile_updated_at();
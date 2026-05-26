ALTER TABLE public.important_dates
  ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS done_at timestamptz,
  ADD COLUMN IF NOT EXISTS done_by uuid;

CREATE OR REPLACE FUNCTION public.sync_date_done_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_done AND (OLD.is_done IS DISTINCT FROM NEW.is_done) THEN
    NEW.done_at := now();
    NEW.done_by := auth.uid();
  ELSIF NOT NEW.is_done THEN
    NEW.done_at := NULL;
    NEW.done_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_date_done_at_trg ON public.important_dates;
CREATE TRIGGER sync_date_done_at_trg
BEFORE UPDATE ON public.important_dates
FOR EACH ROW
EXECUTE FUNCTION public.sync_date_done_at();
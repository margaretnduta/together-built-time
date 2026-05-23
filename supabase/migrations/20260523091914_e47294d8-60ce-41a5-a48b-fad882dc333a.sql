ALTER TABLE public.important_dates
  ADD COLUMN IF NOT EXISTS deliverables        text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at        timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decline_reason      text,
  ADD COLUMN IF NOT EXISTS declined_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.important_dates DROP CONSTRAINT IF EXISTS important_dates_approval_status_check;
ALTER TABLE public.important_dates
  ADD CONSTRAINT important_dates_approval_status_check
  CHECK (approval_status = ANY (ARRAY['pending','accepted','declined','cancelled']));

ALTER TABLE public.couple_goals
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS declined_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.couple_goals DROP CONSTRAINT IF EXISTS couple_goals_approval_status_check;
ALTER TABLE public.couple_goals
  ADD CONSTRAINT couple_goals_approval_status_check
  CHECK (approval_status = ANY (ARRAY['pending','accepted','declined']));
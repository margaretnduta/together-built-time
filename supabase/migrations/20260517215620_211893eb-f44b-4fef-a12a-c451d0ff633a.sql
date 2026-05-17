
CREATE TABLE public.important_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  date date NOT NULL,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('anniversary','birthday','ritual','other')),
  recurrence text NOT NULL DEFAULT 'yearly' CHECK (recurrence IN ('none','yearly','monthly')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.important_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see dates in my partnership"
  ON public.important_dates FOR SELECT TO authenticated
  USING (public.is_in_partnership(partnership_id));

CREATE POLICY "create dates in my partnership"
  ON public.important_dates FOR INSERT TO authenticated
  WITH CHECK (public.is_in_partnership(partnership_id) AND created_by = auth.uid());

CREATE POLICY "update dates in my partnership"
  ON public.important_dates FOR UPDATE TO authenticated
  USING (public.is_in_partnership(partnership_id))
  WITH CHECK (public.is_in_partnership(partnership_id));

CREATE POLICY "delete dates in my partnership"
  ON public.important_dates FOR DELETE TO authenticated
  USING (public.is_in_partnership(partnership_id));

CREATE TRIGGER trg_important_dates_touch
BEFORE UPDATE ON public.important_dates
FOR EACH ROW EXECUTE FUNCTION public.touch_reflection_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.important_dates;

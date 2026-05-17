CREATE TABLE public.weekly_reflections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partnership_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  week_start date NOT NULL,
  went_well text,
  was_hard text,
  appreciation_for_partner text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partnership_id, week_start, owner_id)
);

ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see reflections in my partnership" ON public.weekly_reflections
  FOR SELECT TO authenticated USING (public.is_in_partnership(partnership_id));

CREATE POLICY "create own reflection" ON public.weekly_reflections
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_in_partnership(partnership_id));

CREATE POLICY "update own reflection" ON public.weekly_reflections
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "delete own reflection" ON public.weekly_reflections
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE INDEX idx_reflections_partnership_week ON public.weekly_reflections(partnership_id, week_start);

CREATE OR REPLACE FUNCTION public.touch_reflection_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reflections_touch
  BEFORE UPDATE ON public.weekly_reflections
  FOR EACH ROW EXECUTE FUNCTION public.touch_reflection_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_reflections;
ALTER TABLE public.weekly_reflections REPLICA IDENTITY FULL;
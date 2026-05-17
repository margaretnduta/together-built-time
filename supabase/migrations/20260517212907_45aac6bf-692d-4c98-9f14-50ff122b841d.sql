CREATE TABLE public.couple_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partnership_id uuid NOT NULL,
  month date NOT NULL,
  title text NOT NULL,
  description text,
  is_complete boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  created_by uuid NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.couple_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see goals in my partnership" ON public.couple_goals
  FOR SELECT TO authenticated USING (public.is_in_partnership(partnership_id));

CREATE POLICY "create goals in my partnership" ON public.couple_goals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_in_partnership(partnership_id) AND created_by = auth.uid());

CREATE POLICY "update goals in my partnership" ON public.couple_goals
  FOR UPDATE TO authenticated
  USING (public.is_in_partnership(partnership_id))
  WITH CHECK (public.is_in_partnership(partnership_id));

CREATE POLICY "delete goals in my partnership" ON public.couple_goals
  FOR DELETE TO authenticated USING (public.is_in_partnership(partnership_id));

CREATE INDEX idx_couple_goals_partnership_month ON public.couple_goals(partnership_id, month);

CREATE OR REPLACE FUNCTION public.sync_goal_completed_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_complete AND (OLD.is_complete IS DISTINCT FROM NEW.is_complete) THEN
    NEW.completed_at := now();
    NEW.completed_by := auth.uid();
  ELSIF NOT NEW.is_complete THEN
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_couple_goals_sync
  BEFORE UPDATE ON public.couple_goals
  FOR EACH ROW EXECUTE FUNCTION public.sync_goal_completed_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.couple_goals;
ALTER TABLE public.couple_goals REPLICA IDENTITY FULL;
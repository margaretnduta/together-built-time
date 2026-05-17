CREATE TABLE public.personal_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  month date NOT NULL,
  title text NOT NULL,
  description text,
  is_complete boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see own personal goals" ON public.personal_goals
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "create own personal goals" ON public.personal_goals
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "update own personal goals" ON public.personal_goals
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "delete own personal goals" ON public.personal_goals
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE INDEX idx_personal_goals_owner_month ON public.personal_goals(owner_id, month);

CREATE OR REPLACE FUNCTION public.sync_personal_goal_completed_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_complete AND (OLD.is_complete IS DISTINCT FROM NEW.is_complete) THEN
    NEW.completed_at := now();
  ELSIF NOT NEW.is_complete THEN
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_personal_goals_sync
  BEFORE UPDATE ON public.personal_goals
  FOR EACH ROW EXECUTE FUNCTION public.sync_personal_goal_completed_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_goals;
ALTER TABLE public.personal_goals REPLICA IDENTITY FULL;
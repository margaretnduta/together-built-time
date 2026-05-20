
-- 1. Recurring task templates
CREATE TABLE public.recurring_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  partnership_id uuid NOT NULL,
  title text NOT NULL,
  recurrence text NOT NULL CHECK (recurrence IN ('daily','weekly')),
  weekday smallint CHECK (weekday IS NULL OR (weekday BETWEEN 0 AND 6)),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see templates in my partnership" ON public.recurring_task_templates
  FOR SELECT TO authenticated USING (public.is_in_partnership(partnership_id));
CREATE POLICY "create own templates" ON public.recurring_task_templates
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_in_partnership(partnership_id));
CREATE POLICY "update own templates" ON public.recurring_task_templates
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "delete own templates" ON public.recurring_task_templates
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

ALTER TABLE public.daily_tasks ADD COLUMN template_id uuid;

-- 2. Materialize today's recurring tasks for current user
CREATE OR REPLACE FUNCTION public.materialize_recurring_tasks_for_today()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _inserted int := 0;
  _today date := CURRENT_DATE;
  _dow smallint := EXTRACT(DOW FROM CURRENT_DATE)::smallint;
  _t record;
BEGIN
  IF _uid IS NULL THEN RETURN 0; END IF;
  FOR _t IN
    SELECT * FROM public.recurring_task_templates
    WHERE owner_id = _uid AND active = true
      AND (recurrence = 'daily' OR (recurrence = 'weekly' AND weekday = _dow))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.daily_tasks
      WHERE owner_id = _uid AND task_date = _today AND template_id = _t.id
    ) THEN
      INSERT INTO public.daily_tasks (owner_id, partnership_id, title, task_date, template_id)
      VALUES (_uid, _t.partnership_id, _t.title, _today, _t.id);
      _inserted := _inserted + 1;
    END IF;
  END LOOP;
  RETURN _inserted;
END $$;

REVOKE EXECUTE ON FUNCTION public.materialize_recurring_tasks_for_today() FROM public;
GRANT EXECUTE ON FUNCTION public.materialize_recurring_tasks_for_today() TO authenticated;

-- 3. Approval workflow on couple_goals & important_dates
ALTER TABLE public.couple_goals
  ADD COLUMN approval_status text NOT NULL DEFAULT 'accepted' CHECK (approval_status IN ('pending','accepted')),
  ADD COLUMN proposed_by uuid,
  ADD COLUMN approved_by uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.important_dates
  ADD COLUMN approval_status text NOT NULL DEFAULT 'accepted' CHECK (approval_status IN ('pending','accepted')),
  ADD COLUMN proposed_by uuid,
  ADD COLUMN approved_by uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN dress_code text;

CREATE OR REPLACE FUNCTION public.sync_partner_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _a uuid; _b uuid;
BEGIN
  SELECT partner_a_id, partner_b_id INTO _a, _b
    FROM public.partnerships WHERE id = NEW.partnership_id;
  IF _a IS NOT NULL AND _b IS NOT NULL
     AND _a = ANY(NEW.approved_by) AND _b = ANY(NEW.approved_by) THEN
    NEW.approval_status := 'accepted';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_couple_goals_approval BEFORE INSERT OR UPDATE OF approved_by
  ON public.couple_goals FOR EACH ROW EXECUTE FUNCTION public.sync_partner_approval();
CREATE TRIGGER trg_important_dates_approval BEFORE INSERT OR UPDATE OF approved_by
  ON public.important_dates FOR EACH ROW EXECUTE FUNCTION public.sync_partner_approval();

-- 4. Streak functions ignore pending couple goals
CREATE OR REPLACE FUNCTION public.get_monthly_couple_streak(_partnership_id uuid)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _streak int := 0;
  _month date := date_trunc('month', CURRENT_DATE)::date;
  _total int; _done int;
  _qualifying boolean;
BEGIN
  IF NOT public.is_in_partnership(_partnership_id) THEN RETURN 0; END IF;
  LOOP
    SELECT count(*), count(*) FILTER (WHERE is_complete) INTO _total, _done
      FROM public.couple_goals
      WHERE partnership_id = _partnership_id AND month = _month
        AND approval_status = 'accepted';
    _qualifying := (_total > 0 AND _done = _total);
    IF _qualifying THEN
      _streak := _streak + 1;
      _month := (_month - INTERVAL '1 month')::date;
    ELSE
      IF _streak = 0 AND _month = date_trunc('month', CURRENT_DATE)::date THEN
        _month := (_month - INTERVAL '1 month')::date;
      ELSE EXIT; END IF;
    END IF;
    IF _streak > 1200 THEN EXIT; END IF;
  END LOOP;
  RETURN _streak;
END $$;

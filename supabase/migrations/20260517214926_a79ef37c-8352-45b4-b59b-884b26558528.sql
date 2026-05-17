
-- ============ CELEBRATIONS TABLE ============
CREATE TABLE public.celebrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL,
  honoree_id uuid NOT NULL,
  celebrant_id uuid NOT NULL,
  month date NOT NULL,
  goal_count smallint NOT NULL DEFAULT 0,
  message text,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partnership_id, honoree_id, month)
);

ALTER TABLE public.celebrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see celebrations in my partnership"
  ON public.celebrations FOR SELECT TO authenticated
  USING (public.is_in_partnership(partnership_id));

-- Insert is done by trigger (SECURITY DEFINER) but we still allow partnership members
-- to insert in case of manual repair. honoree_id must NOT equal auth.uid (no self-celebration).
CREATE POLICY "system can create celebrations in my partnership"
  ON public.celebrations FOR INSERT TO authenticated
  WITH CHECK (public.is_in_partnership(partnership_id) AND honoree_id <> celebrant_id);

-- Only the partner (celebrant) can update message/acknowledged_at
CREATE POLICY "celebrant can acknowledge"
  ON public.celebrations FOR UPDATE TO authenticated
  USING (celebrant_id = auth.uid())
  WITH CHECK (celebrant_id = auth.uid());

-- Allow partnership members to delete (used by retraction trigger via SECURITY DEFINER and manual cleanup)
CREATE POLICY "delete celebrations in my partnership"
  ON public.celebrations FOR DELETE TO authenticated
  USING (public.is_in_partnership(partnership_id));

-- ============ TRIGGER: auto-create / retract celebration ============
CREATE OR REPLACE FUNCTION public.sync_personal_goal_celebration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _month date;
  _partnership_id uuid;
  _partner_id uuid;
  _total int;
  _done int;
BEGIN
  -- Determine which row we are reacting to
  IF TG_OP = 'DELETE' THEN
    _owner := OLD.owner_id;
    _month := OLD.month;
  ELSE
    _owner := NEW.owner_id;
    _month := NEW.month;
  END IF;

  -- Find an active partnership for the owner
  SELECT id,
    CASE WHEN partner_a_id = _owner THEN partner_b_id ELSE partner_a_id END
    INTO _partnership_id, _partner_id
  FROM public.partnerships
  WHERE status = 'active'
    AND (partner_a_id = _owner OR partner_b_id = _owner)
  LIMIT 1;

  -- No partnership = nothing to do
  IF _partnership_id IS NULL OR _partner_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT count(*), count(*) FILTER (WHERE is_complete)
    INTO _total, _done
  FROM public.personal_goals
  WHERE owner_id = _owner AND month = _month;

  IF _total > 0 AND _done = _total THEN
    -- All complete: create celebration if not exists (don't overwrite acknowledgment)
    INSERT INTO public.celebrations (partnership_id, honoree_id, celebrant_id, month, goal_count)
    VALUES (_partnership_id, _owner, _partner_id, _month, _total)
    ON CONFLICT (partnership_id, honoree_id, month) DO UPDATE
      SET goal_count = EXCLUDED.goal_count;
  ELSE
    -- Not all complete: retract any UNACKNOWLEDGED celebration for that month
    DELETE FROM public.celebrations
    WHERE partnership_id = _partnership_id
      AND honoree_id = _owner
      AND month = _month
      AND acknowledged_at IS NULL;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_personal_goals_celebration
AFTER INSERT OR UPDATE OR DELETE ON public.personal_goals
FOR EACH ROW EXECUTE FUNCTION public.sync_personal_goal_celebration();

-- ============ STREAK FUNCTIONS ============

-- Daily couple streak: consecutive days (ending today or yesterday) where BOTH partners
-- had >=1 task and completed all of them.
CREATE OR REPLACE FUNCTION public.get_daily_streak(_partnership_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _a uuid; _b uuid;
  _streak int := 0;
  _day date := CURRENT_DATE;
  _qualifying boolean;
  _a_total int; _a_done int;
  _b_total int; _b_done int;
BEGIN
  IF NOT public.is_in_partnership(_partnership_id) THEN
    RETURN 0;
  END IF;
  SELECT partner_a_id, partner_b_id INTO _a, _b
  FROM public.partnerships WHERE id = _partnership_id;
  IF _b IS NULL THEN RETURN 0; END IF;

  -- If today not qualifying, allow streak to end yesterday
  LOOP
    SELECT count(*), count(*) FILTER (WHERE is_complete) INTO _a_total, _a_done
      FROM public.daily_tasks WHERE partnership_id = _partnership_id AND owner_id = _a AND task_date = _day;
    SELECT count(*), count(*) FILTER (WHERE is_complete) INTO _b_total, _b_done
      FROM public.daily_tasks WHERE partnership_id = _partnership_id AND owner_id = _b AND task_date = _day;
    _qualifying := (_a_total > 0 AND _a_done = _a_total AND _b_total > 0 AND _b_done = _b_total);

    IF _qualifying THEN
      _streak := _streak + 1;
      _day := _day - INTERVAL '1 day';
    ELSE
      -- Allow today to be a "grace" day (streak not yet broken)
      IF _streak = 0 AND _day = CURRENT_DATE THEN
        _day := _day - INTERVAL '1 day';
      ELSE
        EXIT;
      END IF;
    END IF;
    -- safety bound
    IF _streak > 3650 THEN EXIT; END IF;
  END LOOP;

  RETURN _streak;
END;
$$;

-- Monthly couple goal streak
CREATE OR REPLACE FUNCTION public.get_monthly_couple_streak(_partnership_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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
      FROM public.couple_goals WHERE partnership_id = _partnership_id AND month = _month;
    _qualifying := (_total > 0 AND _done = _total);

    IF _qualifying THEN
      _streak := _streak + 1;
      _month := (_month - INTERVAL '1 month')::date;
    ELSE
      IF _streak = 0 AND _month = date_trunc('month', CURRENT_DATE)::date THEN
        _month := (_month - INTERVAL '1 month')::date;
      ELSE
        EXIT;
      END IF;
    END IF;
    IF _streak > 1200 THEN EXIT; END IF;
  END LOOP;

  RETURN _streak;
END;
$$;

-- Personal monthly streak (per caller)
CREATE OR REPLACE FUNCTION public.get_personal_streak()
RETURNS int
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _streak int := 0;
  _month date := date_trunc('month', CURRENT_DATE)::date;
  _total int; _done int;
  _qualifying boolean;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN 0; END IF;

  LOOP
    SELECT count(*), count(*) FILTER (WHERE is_complete) INTO _total, _done
      FROM public.personal_goals WHERE owner_id = _uid AND month = _month;
    _qualifying := (_total > 0 AND _done = _total);

    IF _qualifying THEN
      _streak := _streak + 1;
      _month := (_month - INTERVAL '1 month')::date;
    ELSE
      IF _streak = 0 AND _month = date_trunc('month', CURRENT_DATE)::date THEN
        _month := (_month - INTERVAL '1 month')::date;
      ELSE
        EXIT;
      END IF;
    END IF;
    IF _streak > 1200 THEN EXIT; END IF;
  END LOOP;

  RETURN _streak;
END;
$$;

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.celebrations;

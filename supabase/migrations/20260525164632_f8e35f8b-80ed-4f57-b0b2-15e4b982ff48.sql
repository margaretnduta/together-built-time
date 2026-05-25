
-- Challenges: flexible date-range commitments with daily check-ins and streak tracking.
CREATE TABLE public.challenges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  partnership_id uuid null,
  partner_id uuid null,
  title text not null,
  description text null,
  start_date date not null,
  end_date date not null,
  is_solo boolean not null default true,
  status text not null default 'active' check (status in ('active','pending','declined','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

CREATE INDEX challenges_owner_idx ON public.challenges(owner_id);
CREATE INDEX challenges_partner_idx ON public.challenges(partner_id);
CREATE INDEX challenges_partnership_idx ON public.challenges(partnership_id);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see own or partner challenges" ON public.challenges
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "create own challenges" ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "update own or partner challenges" ON public.challenges
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR partner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() OR partner_id = auth.uid());

CREATE POLICY "delete own challenges" ON public.challenges
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER challenges_touch_updated
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.touch_reflection_updated_at();

-- Daily check-ins
CREATE TABLE public.challenge_check_ins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null,
  check_in_date date not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id, check_in_date)
);

CREATE INDEX challenge_check_ins_lookup_idx ON public.challenge_check_ins(challenge_id, user_id, check_in_date DESC);

ALTER TABLE public.challenge_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "see check-ins for accessible challenges" ON public.challenge_check_ins
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_id AND (c.owner_id = auth.uid() OR c.partner_id = auth.uid())
  ));

CREATE POLICY "create own check-ins" ON public.challenge_check_ins
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_id AND (c.owner_id = auth.uid() OR c.partner_id = auth.uid())
        AND c.status = 'active'
    )
  );

CREATE POLICY "delete own check-ins" ON public.challenge_check_ins
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_check_ins;

-- Streak function: counts consecutive days ending today (or yesterday if no check-in today yet).
CREATE OR REPLACE FUNCTION public.get_challenge_streak(_challenge_id uuid, _user_id uuid)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _streak int := 0;
  _day date := CURRENT_DATE;
  _start date;
BEGIN
  SELECT start_date INTO _start FROM public.challenges WHERE id = _challenge_id;
  IF _start IS NULL THEN RETURN 0; END IF;

  -- Allow grace: if no check-in today, start counting from yesterday.
  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_check_ins
    WHERE challenge_id = _challenge_id AND user_id = _user_id AND check_in_date = _day
  ) THEN
    _day := _day - 1;
  END IF;

  LOOP
    EXIT WHEN _day < _start;
    IF EXISTS (
      SELECT 1 FROM public.challenge_check_ins
      WHERE challenge_id = _challenge_id AND user_id = _user_id AND check_in_date = _day
    ) THEN
      _streak := _streak + 1;
      _day := _day - 1;
    ELSE
      EXIT;
    END IF;
    IF _streak > 3650 THEN EXIT; END IF;
  END LOOP;

  RETURN _streak;
END $$;

-- 1) get_challenge_streak: auth check + lock down execution
CREATE OR REPLACE FUNCTION public.get_challenge_streak(_challenge_id uuid, _user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _streak int := 0;
  _day date := CURRENT_DATE;
  _start date;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  -- Caller must own or be partnered on this challenge
  IF NOT EXISTS (
    SELECT 1 FROM public.challenges
    WHERE id = _challenge_id
      AND (owner_id = auth.uid() OR partner_id = auth.uid())
  ) THEN
    RETURN 0;
  END IF;

  SELECT start_date INTO _start FROM public.challenges WHERE id = _challenge_id;
  IF _start IS NULL THEN RETURN 0; END IF;

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
END $function$;

REVOKE ALL ON FUNCTION public.get_challenge_streak(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_challenge_streak(uuid, uuid) TO authenticated;

-- 2) Partnerships: block direct UPDATE. All state changes go through
--    accept_invite() / dissolve_partnership() SECURITY DEFINER functions.
REVOKE UPDATE ON public.partnerships FROM authenticated, anon;

-- 3) Celebrations: tighten INSERT to verify both honoree and celebrant
--    are the actual two members of the partnership.
DROP POLICY IF EXISTS "system can create celebrations in my partnership" ON public.celebrations;

CREATE POLICY "system can create celebrations in my partnership"
ON public.celebrations
FOR INSERT
TO authenticated
WITH CHECK (
  is_in_partnership(partnership_id)
  AND honoree_id <> celebrant_id
  AND EXISTS (
    SELECT 1 FROM public.partnerships p
    WHERE p.id = celebrations.partnership_id
      AND p.status = 'active'
      AND (
        (p.partner_a_id = celebrations.honoree_id AND p.partner_b_id = celebrations.celebrant_id)
        OR
        (p.partner_b_id = celebrations.honoree_id AND p.partner_a_id = celebrations.celebrant_id)
      )
  )
);

-- 4) Realtime: replace substring topic checks with exact equality matches
--    scoped to known channel naming conventions:
--      - 'partnerships-watch'              (presence channel for any signed-in user)
--      - 'dates-<partnership_id>'          (per-partnership)
--      - 'streaks-<user_id>-<partnership_id|none>' (per-user, optionally per-partnership)
DROP POLICY IF EXISTS "authenticated can read own scoped topics" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can write own scoped topics" ON realtime.messages;

CREATE POLICY "authenticated can read own scoped topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'partnerships-watch'
  OR realtime.topic() = 'streaks-' || auth.uid()::text || '-none'
  OR (
    public.get_my_partnership_id() IS NOT NULL
    AND (
      realtime.topic() = 'dates-' || public.get_my_partnership_id()::text
      OR realtime.topic() = 'streaks-' || auth.uid()::text || '-' || public.get_my_partnership_id()::text
    )
  )
);

CREATE POLICY "authenticated can write own scoped topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = 'partnerships-watch'
  OR realtime.topic() = 'streaks-' || auth.uid()::text || '-none'
  OR (
    public.get_my_partnership_id() IS NOT NULL
    AND (
      realtime.topic() = 'dates-' || public.get_my_partnership_id()::text
      OR realtime.topic() = 'streaks-' || auth.uid()::text || '-' || public.get_my_partnership_id()::text
    )
  )
);
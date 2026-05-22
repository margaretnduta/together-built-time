
-- 1. Reflection visibility
ALTER TABLE public.weekly_reflections
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'shared'
    CHECK (visibility IN ('private','shared'));

-- Update SELECT policy: partner can only see reflections marked shared.
DROP POLICY IF EXISTS "see reflections in my partnership" ON public.weekly_reflections;
CREATE POLICY "see reflections in my partnership"
  ON public.weekly_reflections
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR (public.is_in_partnership(partnership_id) AND visibility = 'shared')
  );

-- 2. Account deletion RPC. Wipes the current user's personal data and
--    dissolves any active or pending partnership. The partner's UI will
--    automatically fall back to the onboarding/invite state.
CREATE OR REPLACE FUNCTION public.delete_my_account_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  -- Dissolve every partnership this user is part of so the partner
  -- is released to pre-partnership state.
  FOR _pid IN
    SELECT id FROM public.partnerships
    WHERE partner_a_id = _uid OR partner_b_id = _uid
  LOOP
    UPDATE public.partnerships
       SET status = 'dissolved',
           invite_code = NULL,
           invite_expires_at = NULL
     WHERE id = _pid;
  END LOOP;

  -- Personal data fully owned by the user
  DELETE FROM public.personal_goals WHERE owner_id = _uid;
  DELETE FROM public.recurring_task_templates WHERE owner_id = _uid;
  DELETE FROM public.daily_tasks WHERE owner_id = _uid;
  DELETE FROM public.weekly_reflections WHERE owner_id = _uid;

  -- Shared records this user created. Partner copies they created stay
  -- archived behind the dissolved partnership and become inaccessible.
  DELETE FROM public.couple_goals WHERE created_by = _uid;
  DELETE FROM public.important_dates WHERE created_by = _uid;
  DELETE FROM public.celebrations
    WHERE honoree_id = _uid OR celebrant_id = _uid;

  -- Audit log + profile
  DELETE FROM public.account_audit_log WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account_data() TO authenticated;

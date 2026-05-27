
-- =========================================================
-- 1. Move profiles.phone into private per-user table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id uuid PRIMARY KEY,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own private profile"
ON public.profile_private FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "owner inserts own private profile"
ON public.profile_private FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner updates own private profile"
ON public.profile_private FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner deletes own private profile"
ON public.profile_private FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Backfill from existing profiles.phone
INSERT INTO public.profile_private (user_id, phone)
SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone;

-- Rewrite log_profile_change to drop the NEW.phone reference before dropping the column
CREATE OR REPLACE FUNCTION public.log_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN RETURN NEW; END IF;
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    INSERT INTO public.account_audit_log (user_id, actor_id, action, summary)
    VALUES (NEW.id, _actor, 'profile.display_name', 'display_name updated');
  END IF;
  RETURN NEW;
END;
$$;

-- Drop phone from the partner-visible profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;

-- Touch updated_at on profile_private updates
CREATE TRIGGER trg_profile_private_touch
  BEFORE UPDATE ON public.profile_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_profile_updated_at();

-- Make sure account deletion cleans up the private row too
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

  FOR _pid IN
    SELECT id FROM public.partnerships
    WHERE partner_a_id = _uid OR partner_b_id = _uid
  LOOP
    UPDATE public.partnerships
       SET status = 'dissolved', invite_code = NULL, invite_expires_at = NULL
     WHERE id = _pid;
  END LOOP;

  DELETE FROM public.personal_goals WHERE owner_id = _uid;
  DELETE FROM public.recurring_task_templates WHERE owner_id = _uid;
  DELETE FROM public.daily_tasks WHERE owner_id = _uid;
  DELETE FROM public.weekly_reflections WHERE owner_id = _uid;
  DELETE FROM public.couple_goals WHERE created_by = _uid;
  DELETE FROM public.important_dates WHERE created_by = _uid;
  DELETE FROM public.celebrations
    WHERE honoree_id = _uid OR celebrant_id = _uid;
  DELETE FROM public.profile_private WHERE user_id = _uid;
  DELETE FROM public.account_audit_log WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;
END;
$$;

-- =========================================================
-- 2. Restrict what a challenge partner (non-owner) can update
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_challenge_partner_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Owner may change anything (RLS already restricts to owner or partner)
  IF auth.uid() = OLD.owner_id THEN
    RETURN NEW;
  END IF;

  -- Non-owner (the invited partner) may only change `status`,
  -- and only to a safe accept/decline value.
  IF NEW.owner_id        IS DISTINCT FROM OLD.owner_id
  OR NEW.partner_id      IS DISTINCT FROM OLD.partner_id
  OR NEW.partnership_id  IS DISTINCT FROM OLD.partnership_id
  OR NEW.title           IS DISTINCT FROM OLD.title
  OR NEW.description     IS DISTINCT FROM OLD.description
  OR NEW.start_date      IS DISTINCT FROM OLD.start_date
  OR NEW.end_date        IS DISTINCT FROM OLD.end_date
  OR NEW.is_solo         IS DISTINCT FROM OLD.is_solo THEN
    RAISE EXCEPTION 'partner_can_only_change_status';
  END IF;

  IF NEW.status NOT IN ('active','declined','archived') THEN
    RAISE EXCEPTION 'partner_invalid_status_value';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_challenge_partner_update ON public.challenges;
CREATE TRIGGER trg_enforce_challenge_partner_update
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.enforce_challenge_partner_update();

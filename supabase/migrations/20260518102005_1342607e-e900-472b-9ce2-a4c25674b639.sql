CREATE TABLE IF NOT EXISTS public.account_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'profile.display_name','profile.phone',
    'email.change','password.change','account.signout_all'
  )),
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_created
  ON public.account_audit_log (user_id, created_at DESC);

ALTER TABLE public.account_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own audit log" ON public.account_audit_log;
CREATE POLICY "users read own audit log" ON public.account_audit_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_profile_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN RETURN NEW; END IF;
  IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    INSERT INTO public.account_audit_log (user_id, actor_id, action, summary)
    VALUES (NEW.id, _actor, 'profile.display_name', 'display_name updated');
  END IF;
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    INSERT INTO public.account_audit_log (user_id, actor_id, action, summary)
    VALUES (NEW.id, _actor, 'profile.phone',
      CASE WHEN NEW.phone IS NULL THEN 'phone removed'
           ELSE 'phone updated (ends ' || right(regexp_replace(NEW.phone,'\D','','g'),2) || ')' END);
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.log_profile_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_log_profile_change ON public.profiles;
CREATE TRIGGER trg_log_profile_change
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_profile_change();

CREATE OR REPLACE FUNCTION public.log_account_event(_action text, _summary text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _action NOT IN ('email.change','password.change','account.signout_all') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  INSERT INTO public.account_audit_log (user_id, actor_id, action, summary)
  VALUES (auth.uid(), auth.uid(), _action, left(coalesce(_summary,''),200));
END; $$;

REVOKE EXECUTE ON FUNCTION public.log_account_event(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_account_event(text, text) TO authenticated;
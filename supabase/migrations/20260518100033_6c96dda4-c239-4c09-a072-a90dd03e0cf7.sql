CREATE OR REPLACE FUNCTION public.dissolve_partnership()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT id INTO _pid
  FROM public.partnerships
  WHERE status IN ('active','pending')
    AND (partner_a_id = auth.uid() OR partner_b_id = auth.uid())
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF _pid IS NULL THEN
    RAISE EXCEPTION 'no_partnership';
  END IF;

  UPDATE public.partnerships
  SET status = 'dissolved',
      invite_code = NULL,
      invite_expires_at = NULL
  WHERE id = _pid;

  RETURN _pid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dissolve_partnership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dissolve_partnership() TO authenticated;
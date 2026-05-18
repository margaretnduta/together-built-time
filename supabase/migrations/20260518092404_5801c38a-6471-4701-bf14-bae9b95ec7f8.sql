-- 1) Profiles: explicit INSERT policy so only the user themselves can create their profile row
CREATE POLICY "users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 2) Realtime channel authorization — restrict subscriptions to topics scoped to the user
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read own scoped topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'partnerships-watch'
  OR position(auth.uid()::text in realtime.topic()) > 0
  OR (
    public.get_my_partnership_id() IS NOT NULL
    AND position(public.get_my_partnership_id()::text in realtime.topic()) > 0
  )
);

CREATE POLICY "authenticated can write own scoped topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = 'partnerships-watch'
  OR position(auth.uid()::text in realtime.topic()) > 0
  OR (
    public.get_my_partnership_id() IS NOT NULL
    AND position(public.get_my_partnership_id()::text in realtime.topic()) > 0
  )
);

-- 3) Lock down SECURITY DEFINER function execution.
--    Trigger-only functions: revoke from everyone (only the trigger system invokes them).
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_personal_goal_celebration() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_task_completed_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_goal_completed_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_personal_goal_completed_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_reflection_updated_at() FROM PUBLIC, anon, authenticated;

--    RPC / RLS helper functions: only authenticated users.
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_partnership_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_partnership_id() TO authenticated;

REVOKE ALL ON FUNCTION public.is_in_partnership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_in_partnership(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_daily_streak(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_streak(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_monthly_couple_streak(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_couple_streak(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_personal_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personal_streak() TO authenticated;
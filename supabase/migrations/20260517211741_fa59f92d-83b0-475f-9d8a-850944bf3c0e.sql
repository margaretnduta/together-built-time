
-- Pin search_path on remaining function
create or replace function public.sync_task_completed_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_complete and (old.is_complete is distinct from new.is_complete) then
    new.completed_at := now();
  elsif not new.is_complete then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

-- Revoke broad execute on security definer functions
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_task_completed_at() from public, anon, authenticated;

revoke all on function public.get_my_partnership_id() from public, anon;
revoke all on function public.is_in_partnership(uuid) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;

-- Grant only where needed
grant execute on function public.get_my_partnership_id() to authenticated;
grant execute on function public.is_in_partnership(uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

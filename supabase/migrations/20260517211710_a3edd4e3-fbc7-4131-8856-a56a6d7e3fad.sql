
-- =========================================================
-- PROFILES
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Partner',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles readable by authenticated"
  on public.profiles for select
  to authenticated using (true);

create policy "users can update own profile"
  on public.profiles for update
  to authenticated using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- PARTNERSHIPS
-- =========================================================
create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  partner_a_id uuid not null references public.profiles(id) on delete restrict,
  partner_b_id uuid references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','active','dissolved')),
  invite_code text unique,
  invite_expires_at timestamptz,
  formed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint no_self check (partner_a_id <> partner_b_id)
);

-- Only one active partnership per user
create unique index idx_partnership_a_active on public.partnerships(partner_a_id) where status = 'active';
create unique index idx_partnership_b_active on public.partnerships(partner_b_id) where status = 'active';
-- Only one pending invite per inviter
create unique index idx_partnership_a_pending on public.partnerships(partner_a_id) where status = 'pending';

alter table public.partnerships enable row level security;

-- Helper: current user's active partnership id
create or replace function public.get_my_partnership_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.partnerships
  where status = 'active' and (partner_a_id = auth.uid() or partner_b_id = auth.uid())
  limit 1
$$;

create policy "see own partnerships"
  on public.partnerships for select
  to authenticated using (partner_a_id = auth.uid() or partner_b_id = auth.uid());

create policy "create own invite"
  on public.partnerships for insert
  to authenticated with check (partner_a_id = auth.uid() and status = 'pending');

create policy "cancel own pending invite"
  on public.partnerships for delete
  to authenticated using (partner_a_id = auth.uid() and status = 'pending');

-- Secure RPC: accept an invite by code
create or replace function public.accept_invite(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _partnership_id uuid;
  _inviter uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  -- Lock the pending invite
  select id, partner_a_id into _partnership_id, _inviter
  from public.partnerships
  where invite_code = upper(_code)
    and status = 'pending'
    and (invite_expires_at is null or invite_expires_at > now())
  for update;

  if _partnership_id is null then
    raise exception 'invite_invalid_or_expired';
  end if;

  if _inviter = auth.uid() then
    raise exception 'cannot_accept_own_invite';
  end if;

  -- Block users already in an active partnership
  if exists (
    select 1 from public.partnerships
    where status = 'active' and (partner_a_id = auth.uid() or partner_b_id = auth.uid())
  ) then
    raise exception 'already_in_partnership';
  end if;

  update public.partnerships
  set partner_b_id = auth.uid(),
      status = 'active',
      formed_at = now(),
      invite_code = null,
      invite_expires_at = null
  where id = _partnership_id;

  return _partnership_id;
end;
$$;

-- =========================================================
-- DAILY TASKS
-- =========================================================
create table public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.partnerships(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  task_date date not null default current_date,
  title text not null check (length(title) between 1 and 200),
  is_complete boolean not null default false,
  completed_at timestamptz,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_tasks_partnership_date on public.daily_tasks(partnership_id, task_date);
create index idx_tasks_owner_date on public.daily_tasks(owner_id, task_date);

alter table public.daily_tasks enable row level security;

-- Helper: is uid in this partnership
create or replace function public.is_in_partnership(_partnership_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.partnerships
    where id = _partnership_id
      and status = 'active'
      and (partner_a_id = auth.uid() or partner_b_id = auth.uid())
  )
$$;

create policy "see tasks in my partnership"
  on public.daily_tasks for select
  to authenticated using (public.is_in_partnership(partnership_id));

create policy "create own tasks"
  on public.daily_tasks for insert
  to authenticated with check (
    owner_id = auth.uid() and public.is_in_partnership(partnership_id)
  );

create policy "update own tasks"
  on public.daily_tasks for update
  to authenticated using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "delete own tasks"
  on public.daily_tasks for delete
  to authenticated using (owner_id = auth.uid());

-- Keep completed_at in sync
create or replace function public.sync_task_completed_at()
returns trigger language plpgsql as $$
begin
  if new.is_complete and (old.is_complete is distinct from new.is_complete) then
    new.completed_at := now();
  elsif not new.is_complete then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_sync_completed_at
  before update on public.daily_tasks
  for each row execute function public.sync_task_completed_at();

-- =========================================================
-- REALTIME
-- =========================================================
alter publication supabase_realtime add table public.daily_tasks;
alter publication supabase_realtime add table public.partnerships;

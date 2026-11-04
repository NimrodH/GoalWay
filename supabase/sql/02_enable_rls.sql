-- Turns on Row-Level Security for GoalWay's public tables that still have it off,
-- and adds policies that keep the app working the way it does today:
--   * everyone (signed in or not) can still read, as the app's pages do now;
--   * only signed-in admins (profiles.role = 'admin') can add, change or delete rows.
-- Tables that already have RLS on are left exactly as they are, policies included.
-- Safe to run more than once.

-- Helper: is the signed-in user an admin? SECURITY DEFINER so it can read profiles
-- without being blocked by the profiles policies themselves.
create or replace function public.goalway_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

revoke all on function public.goalway_is_admin() from public;
grant execute on function public.goalway_is_admin() to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'missions', 'instructions', 'organizations', 'mission_organizations', 'image_keywords', 'profiles'
  ]
  loop
    if exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r' and not c.relrowsecurity
    ) then
      execute format('alter table public.%I enable row level security', t);

      execute format('drop policy if exists "goalway read" on public.%I', t);
      execute format('create policy "goalway read" on public.%I for select to anon, authenticated using (true)', t);

      execute format('drop policy if exists "goalway admin insert" on public.%I', t);
      execute format(
        'create policy "goalway admin insert" on public.%I for insert to authenticated with check (public.goalway_is_admin())', t);

      execute format('drop policy if exists "goalway admin update" on public.%I', t);
      execute format(
        'create policy "goalway admin update" on public.%I for update to authenticated using (public.goalway_is_admin()) with check (public.goalway_is_admin())', t);

      execute format('drop policy if exists "goalway admin delete" on public.%I', t);
      execute format(
        'create policy "goalway admin delete" on public.%I for delete to authenticated using (public.goalway_is_admin())', t);

      raise notice 'RLS enabled with GoalWay policies on public.%', t;
    else
      raise notice 'public.% already has RLS on (or does not exist), left unchanged', t;
    end if;
  end loop;
end $$;

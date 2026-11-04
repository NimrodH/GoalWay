-- Locks down public.profiles. Run only after PR #8 is live on main, because the
-- old code reads the admin user list without a login and would show it empty.
--
-- Today the policy "Service role full access profiles" applies to everyone, so anyone
-- with the project URL can read all emails and change any role (even make themselves
-- admin). The service role skips RLS anyway, so that policy is not needed for it.
--
-- After this:
--   * signed-in users still see and update their own profile;
--   * admins see and update every profile (user list, organization assignment);
--   * only admins can change role or organization_id;
--   * anonymous visitors can't read or change profiles.

begin;

-- Is the signed-in user an admin? SECURITY DEFINER so it can read profiles
-- without going through the profiles policies (avoids recursion).
create or replace function public.goalway_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.goalway_is_admin() from public, anon;
grant execute on function public.goalway_is_admin() to authenticated;

drop policy if exists "Service role full access profiles" on public.profiles;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select to authenticated using (public.goalway_is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles" on public.profiles
  for update to authenticated using (public.goalway_is_admin()) with check (public.goalway_is_admin());

-- Own-profile update stays, but only for the user's own row.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Non-admins can't change their own role or organization.
create or replace function public.goalway_guard_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.organization_id is distinct from old.organization_id)
     and auth.uid() is not null
     and not public.goalway_is_admin() then
    raise exception 'Only admins can change role or organization';
  end if;
  return new;
end;
$$;
revoke all on function public.goalway_guard_profile_fields() from public, anon, authenticated;

drop trigger if exists goalway_guard_profile_fields on public.profiles;
create trigger goalway_guard_profile_fields
  before update on public.profiles
  for each row execute function public.goalway_guard_profile_fields();

commit;

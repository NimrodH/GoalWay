-- Read-only check: run this first in the Supabase SQL editor. It changes nothing.
-- 1) Which public tables have Row-Level Security on or off.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 2) Policies that already exist on public tables.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Triggers on auth.users (how new profiles are created) and whether their
--    functions run as SECURITY DEFINER (needed once profiles has RLS).
select t.tgname as trigger_name, p.proname as function_name, p.prosecdef as security_definer
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;

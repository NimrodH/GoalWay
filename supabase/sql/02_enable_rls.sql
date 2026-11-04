-- Fixes the Supabase "Table publicly accessible" warning.
-- Checked on 2026-11-04: image_keywords is the only public table with RLS off.
-- All other tables already have RLS and keep their existing policies.

-- Step 1: safe to run now, while the live site still saves keywords with the anon key.
-- Turns RLS on and keeps today's access exactly as it is, so nothing breaks.
begin;
alter table public.image_keywords enable row level security;
drop policy if exists "Allow public read access to image_keywords" on public.image_keywords;
create policy "Allow public read access to image_keywords" on public.image_keywords
  for select to public using (true);
drop policy if exists "Temporary app write access to image_keywords" on public.image_keywords;
create policy "Temporary app write access to image_keywords" on public.image_keywords
  for all to anon, authenticated using (true) with check (true);
commit;

-- Step 2: run only after PR #8 is live on main (keyword saves then send the user's login).
-- Limits writes to signed-in users, the same rule missions and instructions use.
-- begin;
-- drop policy if exists "Temporary app write access to image_keywords" on public.image_keywords;
-- create policy "Allow authenticated insert to image_keywords" on public.image_keywords
--   for insert to authenticated with check (true);
-- create policy "Allow authenticated update to image_keywords" on public.image_keywords
--   for update to authenticated using (true) with check (true);
-- create policy "Allow authenticated delete to image_keywords" on public.image_keywords
--   for delete to authenticated using (true);
-- commit;

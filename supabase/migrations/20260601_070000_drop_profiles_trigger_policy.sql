-- security: drop the unused "Allow profile creation via trigger" policy
-- (INSERT, with_check=true). public.handle_new_user is SECURITY DEFINER
-- and runs as the function owner (postgres), which bypasses RLS; the
-- permissive policy never gates anything, but it does advertise to a
-- linter / a future maintainer that anyone can INSERT a profile row.
drop policy if exists "Allow profile creation via trigger" on public.profiles;

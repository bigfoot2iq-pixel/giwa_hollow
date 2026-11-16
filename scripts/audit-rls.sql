-- Read-only audit: is Row Level Security actually protecting the LitVM tables?
--
-- The anon key ships in every browser bundle, so any table in the public
-- schema that lacks RLS (or has a permissive INSERT/UPDATE/DELETE policy) is
-- directly writable by anyone who views the site. The API routes use the
-- service-role key and are unaffected by RLS, so the goal here is:
--
--   * RLS enabled on every litvm_* table
--   * no INSERT / UPDATE / DELETE / ALL policies for anon or authenticated
--   * SELECT policies may stay (public leaderboards/profiles are intentional)
--
-- Run this in the Supabase SQL editor and fix anything flagged before launch.

-- 1. RLS state + every policy attached to the table.
select
  c.relname                                   as table_name,
  c.relrowsecurity                            as rls_enabled,
  c.relforcerowsecurity                       as rls_forced,
  coalesce(
    string_agg(
      p.policyname || ' [' || p.cmd || '] roles=' || array_to_string(p.roles, ','),
      '; ' order by p.policyname
    ),
    '—'
  )                                           as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname
 and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'litvm\_%'
group by c.relname, c.relrowsecurity, c.relforcerowsecurity
order by c.relrowsecurity asc, c.relname;

-- 2. Table grants held by the browser-facing roles.
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'litvm\_%'
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;

-- 3. Any write policy that targets a browser-facing role is a finding.
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename like 'litvm\_%'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and (
    'anon' = any(roles)
    or 'authenticated' = any(roles)
    or 'public' = any(roles)
  )
order by tablename, policyname;

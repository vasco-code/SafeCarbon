-- ============================================================================
-- Bug real encontrado via teste no browser: toda policy de org_members que
-- fazia subquery na PRÓPRIA org_members (org_members_write, _update, _delete
-- da migration 000009, e org_members_team_read da 000010) disparava
-- "infinite recursion detected in policy for relation org_members" — Postgres
-- não permite que a USING/WITH CHECK de uma policy referencie a mesma tabela
-- diretamente, mesmo que a subquery tenha um filtro simples.
--
-- Fix: mesmo padrão já usado em has_project_role/is_platform_admin — mover a
-- checagem para uma function SECURITY DEFINER, que roda sem RLS por dentro.
-- ============================================================================

create or replace function is_org_manager(p_org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from org_members om
    where om.org_id = p_org_id and om.user_id = auth.uid() and om.member_role in ('owner', 'manager')
  );
$$;

drop policy if exists org_members_write on org_members;
create policy org_members_write
  on org_members for insert
  to authenticated
  with check (is_org_manager(org_id) or is_platform_admin());

drop policy if exists org_members_update on org_members;
create policy org_members_update
  on org_members for update
  to authenticated
  using (is_org_manager(org_id) or is_platform_admin())
  with check (is_org_manager(org_id) or is_platform_admin());

drop policy if exists org_members_delete on org_members;
create policy org_members_delete
  on org_members for delete
  to authenticated
  using (is_org_manager(org_id) or is_platform_admin());

drop policy if exists org_members_team_read on org_members;
create policy org_members_team_read
  on org_members for select
  to authenticated
  using (is_org_manager(org_id) or is_platform_admin());

create or replace function get_org_members_with_email(p_org_id uuid)
returns table (user_id uuid, email text, member_role text, created_at timestamptz)
language sql
security definer
stable
as $$
  select om.user_id, u.email, om.member_role, om.created_at
  from org_members om
  join auth.users u on u.id = om.user_id
  where om.org_id = p_org_id
    and (is_org_manager(p_org_id) or is_platform_admin());
$$;

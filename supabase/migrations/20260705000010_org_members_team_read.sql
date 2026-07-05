-- ============================================================================
-- org_members_self_read (Sprint 0) só deixava o usuário ver a própria linha —
-- para gerir a equipe (UsuariosPage), owner/manager precisa ver todos os
-- membros da própria organização. Soma-se à policy existente por OR (padrão
-- já usado em várias tabelas do projeto) — nenhuma das duas usa USING(true).
--
-- org_members não guarda e-mail (só user_id, FK para auth.users, que não é
-- exposto via PostgREST). A function abaixo resolve isso com o mesmo padrão
-- já usado em has_project_role/is_platform_admin: security definer, com a
-- checagem de permissão feita dentro da própria function.
-- ============================================================================

create policy org_members_team_read
  on org_members for select
  to authenticated
  using (
    exists (
      select 1 from org_members om2
      where om2.org_id = org_members.org_id and om2.user_id = auth.uid() and om2.member_role in ('owner', 'manager')
    )
  );

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
    and (
      exists (
        select 1 from org_members om2
        where om2.org_id = p_org_id and om2.user_id = auth.uid() and om2.member_role in ('owner', 'manager')
      )
      or is_platform_admin()
    );
$$;

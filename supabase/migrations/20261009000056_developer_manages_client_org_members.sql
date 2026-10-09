-- ============================================================================
-- Desenvolvedora (ex.: E2Carbon) gerencia usuários das organizações
-- proponentes e verificadoras dos SEUS projetos — convidar, trocar papel e
-- remover. Antes, org_members só aceitava escrita de owner/manager da própria
-- org-alvo (is_org_manager) ou platform admin, então a E2Carbon só conseguia
-- gerir a si mesma.
--
-- Escopo (decisão do usuário): só orgs que aparecem em project_roles como
-- proponent/verifier de um projeto em que a desenvolvedora do chamador tem
-- role 'developer'; e o chamador precisa ser owner/manager de uma org
-- project_developer. Não alcança outras desenvolvedoras nem orgs sem projeto
-- em comum.
-- ============================================================================

create or replace function can_manage_org_members(p_org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select
    is_platform_admin()
    or is_org_manager(p_org_id)
    or exists (
      select 1
      from org_members om
      join organizations dev on dev.id = om.org_id and dev.org_type = 'project_developer'
      join project_roles dpr on dpr.org_id = dev.id and dpr.role = 'developer'
      join project_roles tpr on tpr.project_id = dpr.project_id
                            and tpr.org_id = p_org_id
                            and tpr.role in ('proponent', 'verifier')
      where om.user_id = auth.uid()
        and om.member_role in ('owner', 'manager')
    );
$$;

drop policy if exists org_members_write on org_members;
create policy org_members_write
  on org_members for insert
  to authenticated
  with check (can_manage_org_members(org_id));

drop policy if exists org_members_update on org_members;
create policy org_members_update
  on org_members for update
  to authenticated
  using (can_manage_org_members(org_id))
  with check (can_manage_org_members(org_id));

drop policy if exists org_members_delete on org_members;
create policy org_members_delete
  on org_members for delete
  to authenticated
  using (can_manage_org_members(org_id));

drop policy if exists org_members_team_read on org_members;
create policy org_members_team_read
  on org_members for select
  to authenticated
  using (can_manage_org_members(org_id));

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
    and can_manage_org_members(p_org_id);
$$;

-- Organizações onde o chamador pode gerenciar usuários — alimenta o seletor
-- da tela Usuários (antes listava TODAS as orgs e falhava só ao convidar).
create or replace function get_manageable_orgs()
returns table (id uuid, name text, org_type text)
language sql
security definer
stable
as $$
  select o.id, o.name, o.org_type::text
  from organizations o
  where can_manage_org_members(o.id)
  order by o.name;
$$;

-- Desenvolvedoras não têm usuário com papel owner. Antes era só um filtro na
-- tela (UsuariosPage); agora vale também para a edge function e para update
-- direto de papel. Só dispara em INSERT ou mudança de member_role, então
-- linhas antigas não são afetadas.
create or replace function org_members_no_developer_owner()
returns trigger
language plpgsql
as $$
begin
  if new.member_role = 'owner'
     and exists (select 1 from organizations o where o.id = new.org_id and o.org_type = 'project_developer') then
    raise exception 'Organizações desenvolvedoras não podem ter usuários com papel de owner.';
  end if;
  return new;
end;
$$;

drop trigger if exists org_members_no_developer_owner_trg on org_members;
create trigger org_members_no_developer_owner_trg
  before insert or update of member_role on org_members
  for each row execute function org_members_no_developer_owner();

-- ============================================================================
-- Mesmo problema de "RETURNING vê o mundo antes do resto do fluxo terminar"
-- da migration 000013, agora em carbon_projects: criar um projeto (INSERT
-- ... RETURNING id) falhava com 42501 porque carbon_projects_member_read só
-- reconhecia quem já tem project_roles — e o project_roles do criador só é
-- inserido no PRÓXIMO passo do fluxo (ProjetosListPage.handleCreateProject),
-- depois que o id do projeto já retornou.
--
-- Fix: ampliar a leitura para incluir quem já é membro da organização
-- proponente OU desenvolvedora nomeada no projeto — mesma condição já usada
-- em carbon_projects_write, então não há novo requisito de permissão, só
-- torna a leitura consistente com quem pode criar. project_roles continua
-- sendo o mecanismo fino para verifier/admin adicionados depois.
-- ============================================================================

drop policy if exists carbon_projects_member_read on carbon_projects;
create policy carbon_projects_member_read
  on carbon_projects for select
  to authenticated
  using (
    has_project_role(id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
    or exists (
      select 1 from org_members om
      where om.user_id = auth.uid() and om.org_id in (proponent_org_id, developer_org_id)
    )
    or is_platform_admin()
  );

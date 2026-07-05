-- ============================================================================
-- Sprint 8 — RLS de project_sites (sem policy até agora, deliberado). Mesmo
-- padrão de leitura por papel do projeto / escrita restrita a developer/admin
-- já usado em todo o resto do schema.
-- ============================================================================

create policy project_sites_read
  on project_sites for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

create policy project_sites_write
  on project_sites for insert
  to authenticated
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

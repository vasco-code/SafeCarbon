-- ============================================================================
-- Sprint 3 — RLS de leakage_assessments (única tabela do Requisito 4 que
-- ficou com RLS habilitado sem nenhuma policy na migration inicial —
-- deliberado, pendente até este sprint implementar a leitura/escrita).
-- Mesmo padrão de production_records / emission_inventory_entries: leitura
-- para qualquer papel do projeto, escrita restrita a proponent/developer/admin.
-- ============================================================================

create policy leakage_assessments_read
  on leakage_assessments for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

create policy leakage_assessments_write
  on leakage_assessments for insert
  to authenticated
  with check (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

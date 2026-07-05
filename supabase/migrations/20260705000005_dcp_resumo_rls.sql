-- ============================================================================
-- Sprint 5 — RLS de dcp_documents, dcp_sections e resumo_calculo_documents
-- (as 3 tabelas do Requisito 2/3 que ficaram sem policy desde a migration
-- inicial — deliberado, pendente até este sprint). Leitura para qualquer
-- papel do projeto; escrita (inclusive das seções narrativas manuais)
-- restrita a developer/admin, mesmo padrão já usado em produção/inventário/
-- motor de cálculo. dcp_sections e resumo_calculo_documents não têm
-- project_id direto — a checagem sobe até o projeto via join.
-- ============================================================================

create policy dcp_documents_read
  on dcp_documents for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

create policy dcp_documents_write
  on dcp_documents for insert
  to authenticated
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

create policy dcp_documents_update
  on dcp_documents for update
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]))
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

create policy dcp_sections_read
  on dcp_sections for select
  to authenticated
  using (
    exists (
      select 1 from dcp_documents d
      where d.id = dcp_sections.dcp_document_id
        and (has_project_role(d.project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

create policy dcp_sections_write
  on dcp_sections for insert
  to authenticated
  with check (
    exists (
      select 1 from dcp_documents d
      where d.id = dcp_sections.dcp_document_id
        and has_project_role(d.project_id, array['developer', 'admin']::project_role[])
    )
  );

create policy dcp_sections_update
  on dcp_sections for update
  to authenticated
  using (
    exists (
      select 1 from dcp_documents d
      where d.id = dcp_sections.dcp_document_id
        and has_project_role(d.project_id, array['developer', 'admin']::project_role[])
    )
  )
  with check (
    exists (
      select 1 from dcp_documents d
      where d.id = dcp_sections.dcp_document_id
        and has_project_role(d.project_id, array['developer', 'admin']::project_role[])
    )
  );

create policy resumo_calculo_documents_read
  on resumo_calculo_documents for select
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = resumo_calculo_documents.cycle_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

create policy resumo_calculo_documents_write
  on resumo_calculo_documents for insert
  to authenticated
  with check (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = resumo_calculo_documents.cycle_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
  );

create policy resumo_calculo_documents_delete
  on resumo_calculo_documents for delete
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = resumo_calculo_documents.cycle_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
  );

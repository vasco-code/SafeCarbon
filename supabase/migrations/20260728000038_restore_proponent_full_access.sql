-- ============================================================================
-- Reverte a restrição de acesso do proponent (Premix) — decisão do usuário:
-- Premix passa a ver/fazer tudo que developer/admin/platform_admin ('full')
-- vê nas abas do projeto (Documentos, Cálculo, Verificação, Comercialização
-- de Créditos), assim como já acontecia antes da migration
-- 20260708000027_narrow_proponent_verifier_rls.sql. A restrição do verifier
-- (VVB) NÃO muda — continua limitado à área de upload de auditoria.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SELECT — production_records, commercialization_documents,
-- emission_inventory_entries, leakage_assessments
-- ----------------------------------------------------------------------------

drop policy production_records_read on production_records;
create policy production_records_read
  on production_records for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy commercialization_documents_read on commercialization_documents;
create policy commercialization_documents_read
  on commercialization_documents for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy emission_inventory_entries_read on emission_inventory_entries;
create policy emission_inventory_entries_read
  on emission_inventory_entries for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy leakage_assessments_read on leakage_assessments;
create policy leakage_assessments_read
  on leakage_assessments for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[])
         or is_platform_admin());

-- ----------------------------------------------------------------------------
-- SELECT — credit_calculation_cycles, credit_calculation_steps, credit_batches
-- ----------------------------------------------------------------------------

drop policy credit_calculation_cycles_read on credit_calculation_cycles;
create policy credit_calculation_cycles_read
  on credit_calculation_cycles for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy credit_calculation_steps_read on credit_calculation_steps;
create policy credit_calculation_steps_read
  on credit_calculation_steps for select
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_calculation_steps.cycle_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

drop policy credit_batches_read on credit_batches;
create policy credit_batches_read
  on credit_batches for select
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_batches.cycle_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

-- ----------------------------------------------------------------------------
-- SELECT — dcp_documents, dcp_sections, resumo_calculo_documents
-- ----------------------------------------------------------------------------

drop policy dcp_documents_read on dcp_documents;
create policy dcp_documents_read
  on dcp_documents for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy dcp_sections_read on dcp_sections;
create policy dcp_sections_read
  on dcp_sections for select
  to authenticated
  using (
    exists (
      select 1 from dcp_documents d
      where d.id = dcp_sections.dcp_document_id
        and (has_project_role(d.project_id, array['proponent', 'developer', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

drop policy resumo_calculo_documents_read on resumo_calculo_documents;
create policy resumo_calculo_documents_read
  on resumo_calculo_documents for select
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = resumo_calculo_documents.cycle_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

-- ----------------------------------------------------------------------------
-- SELECT — monitoring_reports, credit_issuances, blockchain_tokens
-- ----------------------------------------------------------------------------

drop policy monitoring_reports_read on monitoring_reports;
create policy monitoring_reports_read
  on monitoring_reports for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy credit_issuances_read on credit_issuances;
create policy credit_issuances_read
  on credit_issuances for select
  to authenticated
  using (
    exists (
      select 1 from credit_batches b
      join credit_calculation_cycles c on c.id = b.cycle_id
      where b.id = credit_issuances.credit_batch_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

drop policy blockchain_tokens_read on blockchain_tokens;
create policy blockchain_tokens_read
  on blockchain_tokens for select
  to authenticated
  using (
    exists (
      select 1 from credit_issuances i
      join credit_batches b on b.id = i.credit_batch_id
      join credit_calculation_cycles c on c.id = b.cycle_id
      where i.id = blockchain_tokens.credit_issuance_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

-- ----------------------------------------------------------------------------
-- INSERT — production_records, commercialization_documents,
-- emission_inventory_entries, leakage_assessments
-- ----------------------------------------------------------------------------

drop policy production_records_write on production_records;
create policy production_records_write
  on production_records for insert
  to authenticated
  with check (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

drop policy commercialization_documents_write on commercialization_documents;
create policy commercialization_documents_write
  on commercialization_documents for insert
  to authenticated
  with check (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

drop policy emission_inventory_entries_write on emission_inventory_entries;
create policy emission_inventory_entries_write
  on emission_inventory_entries for insert
  to authenticated
  with check (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

drop policy leakage_assessments_write on leakage_assessments;
create policy leakage_assessments_write
  on leakage_assessments for insert
  to authenticated
  with check (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

-- ----------------------------------------------------------------------------
-- verification_cycles — proponent nunca teve insert/update aqui (só select);
-- para paridade total com developer/admin, adiciona nos dois.
-- ----------------------------------------------------------------------------

drop policy verification_cycles_write on verification_cycles;
create policy verification_cycles_write
  on verification_cycles for insert
  to authenticated
  with check (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[])
              or is_platform_admin());

drop policy verification_cycles_update on verification_cycles;
create policy verification_cycles_update
  on verification_cycles for update
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin())
  with check (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
              or is_platform_admin());

-- ----------------------------------------------------------------------------
-- project_documents — aba "Documentos" (área full) liberada para proponent.
-- A policy project_documents_select_proponent_photos (doc_type='foto') se
-- torna redundante mas é inofensiva; não é removida.
-- ----------------------------------------------------------------------------

drop policy project_documents_select_full on project_documents;
create policy project_documents_select_full
  on project_documents for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[]) or is_platform_admin());

drop policy project_documents_insert_full on project_documents;
create policy project_documents_insert_full
  on project_documents for insert
  to authenticated
  with check (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[]) or is_platform_admin());

drop policy project_documents_storage_select_full on storage.objects;
create policy project_documents_storage_select_full
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      has_project_role((storage.foldername(name))[1]::uuid, array['proponent', 'developer', 'admin']::project_role[])
      or is_platform_admin()
    )
  );

drop policy project_documents_storage_insert_full on storage.objects;
create policy project_documents_storage_insert_full
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and (
      has_project_role((storage.foldername(name))[1]::uuid, array['proponent', 'developer', 'admin']::project_role[])
      or is_platform_admin()
    )
  );

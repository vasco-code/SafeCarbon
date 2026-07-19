-- ============================================================================
-- Reestruturação de acesso por perfil — parte 3/3, ÚLTIMA ETAPA.
--
-- !!! NÃO APLICAR ainda !!! Só depois que:
--   1) As migrations 20260708000025 e 20260708000026 (aditivas) já estiverem
--      aplicadas.
--   2) O frontend novo (useProjectRole, ProjetoLayout com abas filtradas,
--      Visão Geral/Descritivo/Documentos/Cálculo/Verificação/Comercialização
--      de Créditos/Carteira de Ativos) já estiver em produção e validado —
--      Premix e VVB não podem mais pedir, pela UI, os dados que esta
--      migration vai bloquear.
--
-- Aplicar fora de horário de uso da Premix/VVB: tecnicamente é rápido (lock
-- de catálogo, não de dado), mas é uma mudança de comportamento perceptível
-- numa sessão já aberta — quem já carregou uma tela antiga (link direto,
-- aba aberta) passa a receber "sem permissão" no meio da sessão.
--
-- Remove 'proponent' e 'verifier' das policies de SELECT que hoje dão
-- leitura ampla a qualquer papel de projeto, deixando só developer/admin (+
-- is_platform_admin() onde já existia) — Premix (proponent) e VVB
-- (verifier) passam a depender só do que já foi desenhado nas migrations
-- aditivas: carbon_projects/project_sites (descritivo), holder_org_id
-- (carteira do proponent), project_documents (área de auditoria do
-- verifier). Também remove 'proponent' das policies de INSERT que ainda
-- permitiam escrita direta (achado da revisão: não eram só os _update/
-- _delete, os _write/INSERT originais também incluíam proponent), e dropa
-- credit_calculation_cycles_verifier_update (deixava o verifier gravar
-- status de ciclo diretamente).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SELECT — production_records, commercialization_documents,
-- emission_inventory_entries, leakage_assessments
-- ----------------------------------------------------------------------------

drop policy production_records_read on production_records;
create policy production_records_read
  on production_records for select
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy commercialization_documents_read on commercialization_documents;
create policy commercialization_documents_read
  on commercialization_documents for select
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy emission_inventory_entries_read on emission_inventory_entries;
create policy emission_inventory_entries_read
  on emission_inventory_entries for select
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy leakage_assessments_read on leakage_assessments;
create policy leakage_assessments_read
  on leakage_assessments for select
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[])
         or is_platform_admin());

-- ----------------------------------------------------------------------------
-- SELECT — credit_calculation_cycles, credit_calculation_steps, credit_batches
-- ----------------------------------------------------------------------------

drop policy credit_calculation_cycles_read on credit_calculation_cycles;
create policy credit_calculation_cycles_read
  on credit_calculation_cycles for select
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy credit_calculation_steps_read on credit_calculation_steps;
create policy credit_calculation_steps_read
  on credit_calculation_steps for select
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_calculation_steps.cycle_id
        and (has_project_role(c.project_id, array['developer', 'admin']::project_role[])
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
        and (has_project_role(c.project_id, array['developer', 'admin']::project_role[])
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
  using (has_project_role(project_id, array['developer', 'admin']::project_role[])
         or is_platform_admin());

drop policy dcp_sections_read on dcp_sections;
create policy dcp_sections_read
  on dcp_sections for select
  to authenticated
  using (
    exists (
      select 1 from dcp_documents d
      where d.id = dcp_sections.dcp_document_id
        and (has_project_role(d.project_id, array['developer', 'admin']::project_role[])
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
        and (has_project_role(c.project_id, array['developer', 'admin']::project_role[])
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
  using (has_project_role(project_id, array['developer', 'admin']::project_role[])
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
        and (has_project_role(c.project_id, array['developer', 'admin']::project_role[])
             or is_platform_admin())
    )
  );
-- credit_issuances_select_holder (20260708000026) permanece — sustenta a
-- leitura do proponent via holder_org_id.

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
        and (has_project_role(c.project_id, array['developer', 'admin']::project_role[])
             or is_platform_admin())
    )
  );
-- blockchain_tokens_select_holder (20260708000026) permanece — sustenta a
-- leitura do proponent via holder_org_id.

-- ----------------------------------------------------------------------------
-- INSERT — achado da revisão: production_records_write,
-- commercialization_documents_write, emission_inventory_entries_write e
-- leakage_assessments_write ainda incluíam 'proponent', não só os
-- _update/_delete adicionados depois.
-- ----------------------------------------------------------------------------

drop policy production_records_write on production_records;
create policy production_records_write
  on production_records for insert
  to authenticated
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

drop policy commercialization_documents_write on commercialization_documents;
create policy commercialization_documents_write
  on commercialization_documents for insert
  to authenticated
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

drop policy emission_inventory_entries_write on emission_inventory_entries;
create policy emission_inventory_entries_write
  on emission_inventory_entries for insert
  to authenticated
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

drop policy leakage_assessments_write on leakage_assessments;
create policy leakage_assessments_write
  on leakage_assessments for insert
  to authenticated
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

-- ----------------------------------------------------------------------------
-- credit_calculation_cycles_verifier_update — achado da revisão: policy
-- distinta de verification_cycles_update, deixava o verifier gravar
-- credit_calculation_cycles.status diretamente (aprovar/rejeitar). No novo
-- modelo, VVB só sobe documento; developer/admin decide o status manualmente
-- depois de ler o documento.
-- ----------------------------------------------------------------------------

drop policy credit_calculation_cycles_verifier_update on credit_calculation_cycles;

-- carbon_projects e project_sites NÃO mudam — continuam legíveis por
-- proponent/verifier/developer/admin (é o "descritivo").

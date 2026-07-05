-- ============================================================================
-- Sprint 6 — MRV e Verificação (verification_cycles, monitoring_reports sem
-- policy até agora, deliberado). Também adiciona as permissões que o papel
-- verifier precisa para revisar um ciclo: UPDATE em credit_calculation_cycles
-- (mover status para verified/rejected) e credit_batches (aprovar o lote) —
-- políticas adicionais que somam por OR às já existentes de developer/admin
-- (múltiplas policies permissivas por comando se combinam com OR no Postgres).
-- ============================================================================

create policy verification_cycles_read
  on verification_cycles for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

create policy verification_cycles_write
  on verification_cycles for insert
  to authenticated
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[])
              or is_platform_admin());

create policy verification_cycles_update
  on verification_cycles for update
  to authenticated
  using (has_project_role(project_id, array['developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin())
  with check (has_project_role(project_id, array['developer', 'verifier', 'admin']::project_role[])
              or is_platform_admin());

-- credit_calculation_cycles já tem UPDATE para developer/admin (Sprint 4) — soma
-- aqui a permissão do verifier concluir a verificação (status -> verified/rejected).
create policy credit_calculation_cycles_verifier_update
  on credit_calculation_cycles for update
  to authenticated
  using (has_project_role(project_id, array['verifier']::project_role[]))
  with check (has_project_role(project_id, array['verifier']::project_role[]));

-- credit_batches não tinha UPDATE nenhum ainda — developer/admin e verifier podem
-- avançar o status do lote (ex.: para approved, após parecer positivo).
create policy credit_batches_update
  on credit_batches for update
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_batches.cycle_id
        and has_project_role(c.project_id, array['developer', 'verifier', 'admin']::project_role[])
    )
  )
  with check (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_batches.cycle_id
        and has_project_role(c.project_id, array['developer', 'verifier', 'admin']::project_role[])
    )
  );

create policy monitoring_reports_read
  on monitoring_reports for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

create policy monitoring_reports_write
  on monitoring_reports for insert
  to authenticated
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

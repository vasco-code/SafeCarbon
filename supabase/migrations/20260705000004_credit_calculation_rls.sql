-- ============================================================================
-- Sprint 4 — RLS de credit_calculation_steps e credit_batches (ficaram sem
-- policy desde a migration inicial — deliberado, pendente até o motor de
-- cálculo existir). credit_calculation_cycles já tinha SELECT/INSERT; ganha
-- aqui UPDATE/DELETE para suportar recálculo idempotente (mesmo project_id +
-- period_year, nunca duplicar cycle — recalcular substitui etapas e lote).
-- ============================================================================

create policy credit_calculation_cycles_update
  on credit_calculation_cycles for update
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]))
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

create policy credit_calculation_cycles_delete
  on credit_calculation_cycles for delete
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]));

create policy credit_calculation_steps_read
  on credit_calculation_steps for select
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_calculation_steps.cycle_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

create policy credit_calculation_steps_write
  on credit_calculation_steps for insert
  to authenticated
  with check (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_calculation_steps.cycle_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
  );

create policy credit_calculation_steps_delete
  on credit_calculation_steps for delete
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_calculation_steps.cycle_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
  );

create policy credit_batches_read
  on credit_batches for select
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_batches.cycle_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

create policy credit_batches_write
  on credit_batches for insert
  to authenticated
  with check (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_batches.cycle_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
  );

create policy credit_batches_delete
  on credit_batches for delete
  to authenticated
  using (
    exists (
      select 1 from credit_calculation_cycles c
      where c.id = credit_batches.cycle_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
  );

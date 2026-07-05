-- ============================================================================
-- Sprint 7 — Emissão e Tokenização (credit_issuances, blockchain_tokens sem
-- policy até agora, deliberado). Leitura para qualquer papel do projeto;
-- escrita (emitir/aposentar) restrita a developer/admin — nunca ao proponent
-- diretamente, e nunca ao verifier (o papel dele termina na aprovação do
-- credit_batch, Sprint 6). As duas tabelas não têm project_id direto: a
-- checagem sobe via credit_batches -> credit_calculation_cycles.
-- ============================================================================

create policy credit_issuances_read
  on credit_issuances for select
  to authenticated
  using (
    exists (
      select 1 from credit_batches b
      join credit_calculation_cycles c on c.id = b.cycle_id
      where b.id = credit_issuances.credit_batch_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

create policy credit_issuances_write
  on credit_issuances for insert
  to authenticated
  with check (
    exists (
      select 1 from credit_batches b
      join credit_calculation_cycles c on c.id = b.cycle_id
      where b.id = credit_issuances.credit_batch_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
  );

create policy blockchain_tokens_read
  on blockchain_tokens for select
  to authenticated
  using (
    exists (
      select 1 from credit_issuances i
      join credit_batches b on b.id = i.credit_batch_id
      join credit_calculation_cycles c on c.id = b.cycle_id
      where i.id = blockchain_tokens.credit_issuance_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
             or is_platform_admin())
    )
  );

create policy blockchain_tokens_write
  on blockchain_tokens for insert
  to authenticated
  with check (
    exists (
      select 1 from credit_issuances i
      join credit_batches b on b.id = i.credit_batch_id
      join credit_calculation_cycles c on c.id = b.cycle_id
      where i.id = blockchain_tokens.credit_issuance_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
  );

create policy blockchain_tokens_update
  on blockchain_tokens for update
  to authenticated
  using (
    exists (
      select 1 from credit_issuances i
      join credit_batches b on b.id = i.credit_batch_id
      join credit_calculation_cycles c on c.id = b.cycle_id
      where i.id = blockchain_tokens.credit_issuance_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
  )
  with check (
    exists (
      select 1 from credit_issuances i
      join credit_batches b on b.id = i.credit_batch_id
      join credit_calculation_cycles c on c.id = b.cycle_id
      where i.id = blockchain_tokens.credit_issuance_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
  );

-- credit_batches precisa de UPDATE também para developer/admin marcarem o
-- lote como 'issued' após a tokenização (a policy do Sprint 6 já cobre
-- developer/verifier/admin, então isto já está coberto — nenhuma policy nova
-- necessária aqui, mantido só como nota).

-- ============================================================================
-- Reestruturação de acesso por perfil — parte 2/3, schema aditivo para a
-- Carteira de Ativos. Créditos nascem no nome do PROPONENTE (holder_org_id =
-- proponent_org_id no momento da emissão, ver issue-credit-batch) — é o dono
-- real da redução; developer/admin continuam enxergando/operando a carteira
-- porque têm papel de projeto, sem precisar "ser dono" pra isso.
--
-- Também aditivo — não toca em nenhuma policy existente.
-- ============================================================================

alter table blockchain_tokens add column holder_org_id uuid references organizations (id);

-- Backfill: tokens emitidos antes desta migration passam a ter como holder o
-- proponente do projeto do respectivo ciclo de cálculo.
update blockchain_tokens t
set holder_org_id = cp.proponent_org_id
from credit_issuances ci
join credit_batches cb on cb.id = ci.credit_batch_id
join credit_calculation_cycles c on c.id = cb.cycle_id
join carbon_projects cp on cp.id = c.project_id
where t.credit_issuance_id = ci.id
  and t.holder_org_id is null;

create index idx_blockchain_tokens_holder on blockchain_tokens (holder_org_id);

-- ----------------------------------------------------------------------------
-- token_transfers — histórico de movimentação (Carteira de Ativos).
-- ----------------------------------------------------------------------------

create table token_transfers (
  id uuid primary key default gen_random_uuid(),
  blockchain_token_id uuid not null references blockchain_tokens (id) on delete cascade,
  from_org_id uuid references organizations (id),
  to_org_id uuid not null references organizations (id),
  tx_hash text not null,
  note text,
  transferred_at timestamptz not null default now()
);

create index idx_token_transfers_token on token_transfers (blockchain_token_id, transferred_at);

alter table token_transfers enable row level security;

-- Select: mesma regra de blockchain_tokens hoje (join até o projeto) — soma
-- por OR com a leitura por holder_org_id abaixo.
create policy token_transfers_select
  on token_transfers for select
  to authenticated
  using (
    exists (
      select 1 from blockchain_tokens t
      join credit_issuances i on i.id = t.credit_issuance_id
      join credit_batches b on b.id = i.credit_batch_id
      join credit_calculation_cycles c on c.id = b.cycle_id
      where t.id = token_transfers.blockchain_token_id
        and (has_project_role(c.project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
             or is_platform_admin())
    )
    or exists (
      select 1 from org_members om
      where om.user_id = auth.uid()
        and om.org_id in (token_transfers.from_org_id, token_transfers.to_org_id)
    )
  );

-- Sem policy de INSERT para o client — só via edge function transfer-credit,
-- que roda com o JWT do próprio chamador (não service role) e faz a mesma
-- checagem de permissão explícita que retire-credit já faz hoje.

-- ----------------------------------------------------------------------------
-- blockchain_tokens / credit_issuances: leitura adicional (soma por OR, não
-- substitui a policy existente) para quem é dono atual do token via
-- holder_org_id — comparação direta de coluna, sem subquery recursiva.
-- Esta é a policy que sustenta a leitura do proponent depois que a migration
-- de afunilamento (parte 3/3) remover 'proponent' do array genérico.
-- ----------------------------------------------------------------------------

create policy blockchain_tokens_select_holder
  on blockchain_tokens for select
  to authenticated
  using (
    holder_org_id is not null
    and exists (
      select 1 from org_members om
      where om.org_id = blockchain_tokens.holder_org_id and om.user_id = auth.uid()
    )
  );

create policy credit_issuances_select_holder
  on credit_issuances for select
  to authenticated
  using (
    exists (
      select 1 from blockchain_tokens t
      where t.credit_issuance_id = credit_issuances.id
        and t.holder_org_id is not null
        and exists (
          select 1 from org_members om
          where om.org_id = t.holder_org_id and om.user_id = auth.uid()
        )
    )
  );

-- UPDATE de holder_org_id: só quem já é o holder atual (transferir), ou
-- developer/admin do projeto (operador agindo em nome do dono), ou platform
-- admin. A escrita real só acontece via edge function (transfer-credit,
-- retire-credit) — RLS é a rede de segurança, a checagem de negócio (motivo
-- obrigatório etc.) fica na function, igual ao padrão já usado em
-- retire-credit hoje.
create policy blockchain_tokens_update_holder
  on blockchain_tokens for update
  to authenticated
  using (
    (holder_org_id is not null and exists (
      select 1 from org_members om where om.org_id = blockchain_tokens.holder_org_id and om.user_id = auth.uid()
    ))
    or exists (
      select 1 from credit_issuances i
      join credit_batches b on b.id = i.credit_batch_id
      join credit_calculation_cycles c on c.id = b.cycle_id
      where i.id = blockchain_tokens.credit_issuance_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
    or is_platform_admin()
  )
  with check (
    (holder_org_id is not null and exists (
      select 1 from org_members om where om.org_id = blockchain_tokens.holder_org_id and om.user_id = auth.uid()
    ))
    or exists (
      select 1 from credit_issuances i
      join credit_batches b on b.id = i.credit_batch_id
      join credit_calculation_cycles c on c.id = b.cycle_id
      where i.id = blockchain_tokens.credit_issuance_id
        and has_project_role(c.project_id, array['developer', 'admin']::project_role[])
    )
    or is_platform_admin()
  );

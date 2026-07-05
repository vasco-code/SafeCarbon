-- ============================================================================
-- Página pública de verificação por QR code (pedido do usuário): qualquer
-- pessoa que escaneie o QR de um token de crédito precisa ver um resumo
-- verificável, SEM login. As tabelas envolvidas (blockchain_tokens,
-- credit_issuances, credit_batches, carbon_projects, ...) têm RLS restrita a
-- `authenticated` com papel no projeto — correto para o app interno, mas
-- incompatível com um visitante anônimo.
--
-- Em vez de abrir RLS para `anon` nessas tabelas (exporia dado interno
-- demais), seguimos o mesmo padrão já usado no projeto para leitura
-- controlada (has_project_role/is_platform_admin/get_org_members_with_email):
-- uma function SECURITY DEFINER que devolve só o subconjunto seguro de campos
-- pensado para o público — nome do projeto, metodologia, quantidade emitida,
-- status do token, hash — nunca dados de organização, e-mail, ou valores
-- comerciais internos.
-- ============================================================================

create or replace function get_public_token_verification(p_token_id text)
returns table (
  token_id text,
  tx_hash text,
  ledger_ref text,
  status text,
  issued_amount_tco2e numeric,
  issued_at timestamptz,
  retired_at timestamptz,
  retired_reason text,
  project_name text,
  methodology_name text,
  methodology_version text,
  registry_standard text,
  period_year int
)
language sql
security definer
stable
as $$
  select
    bt.token_id,
    bt.tx_hash,
    bt.ledger_ref,
    bt.status,
    ci.issued_amount_tco2e,
    ci.issued_at,
    bt.retired_at,
    bt.retired_reason,
    cp.name,
    m.name,
    mv.version_label,
    cp.registry_standard,
    c.period_year
  from blockchain_tokens bt
  join credit_issuances ci on ci.id = bt.credit_issuance_id
  join credit_batches cb on cb.id = ci.credit_batch_id
  join credit_calculation_cycles c on c.id = cb.cycle_id
  join carbon_projects cp on cp.id = c.project_id
  left join methodology_versions mv on mv.id = cp.methodology_version_id
  left join methodologies m on m.id = mv.methodology_id
  where bt.token_id = p_token_id;
$$;

grant execute on function get_public_token_verification(text) to anon, authenticated;

-- ============================================================================
-- Correções do vintage 2025 do Premix - Fator P (solicitação E2Carbon de
-- 16/11/2026) — parte 1/3: schema. Os DADOS vão na 20261116000058; valores de
-- enum novos só podem ser usados depois do commit desta migration, por isso as
-- duas ficam separadas (rodar uma de cada vez no SQL Editor).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Token cancelado (item 1 da carta)
-- ----------------------------------------------------------------------------
alter type token_status add value if not exists 'cancelled';
alter type registry_standard add value if not exists 'safe_trace_proprio';

alter table blockchain_tokens
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_reason text,
  add column if not exists cancelled_by uuid references auth.users (id);

-- A policy blockchain_tokens_update_holder deixa o titular atualizar o token
-- direto (sem passar pelas edge functions), então bloquear só nas functions
-- não basta: um token cancelado não pode mais mudar de status nem de titular.
-- Comparação por ::text porque o valor novo do enum só é utilizável após o
-- commit desta migration.
create or replace function prevent_cancelled_token_change()
returns trigger
language plpgsql
as $$
begin
  if old.status::text = 'cancelled'
     and (new.status::text is distinct from 'cancelled'
          or new.holder_org_id is distinct from old.holder_org_id) then
    raise exception 'Token cancelado não pode ser alterado.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_cancelled_token_change on blockchain_tokens;
create trigger trg_prevent_cancelled_token_change
  before update on blockchain_tokens
  for each row execute function prevent_cancelled_token_change();

-- ----------------------------------------------------------------------------
-- 2. Bloqueio de emissão + proveniência do cálculo
-- ----------------------------------------------------------------------------
alter table credit_calculation_cycles
  add column if not exists issuance_hold boolean not null default false,
  add column if not exists issuance_hold_reason text,
  add column if not exists engine_version text,
  add column if not exists source text not null default 'engine' check (source in ('engine', 'external'));

-- Divisão contratual dos créditos entre as partes: {org_id: percentual}.
alter table carbon_projects add column if not exists credit_split jsonb;

-- credit_calculation_steps e credit_batches ficaram sem trilha de auditoria
-- desde a migration inicial (só o ciclo tinha).
drop trigger if exists trg_audit_credit_calculation_steps on credit_calculation_steps;
create trigger trg_audit_credit_calculation_steps
  after insert or update or delete on credit_calculation_steps
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_credit_batches on credit_batches;
create trigger trg_audit_credit_batches
  after insert or update or delete on credit_batches
  for each row execute function fn_audit_trigger();

-- ----------------------------------------------------------------------------
-- 3. Inventário: chave de alocação por fonte e fator do SIN (item 6)
-- ----------------------------------------------------------------------------
-- calculated_tco2e continua sendo o valor que entra nos totais (motor,
-- relatórios): passa a ser gross_tco2e × allocation_pct / 100. Percentual
-- (1,00072 = 1,00072%), não fração.
alter table emission_inventory_entries
  add column if not exists allocation_pct numeric not null default 100
    check (allocation_pct > 0 and allocation_pct <= 100),
  add column if not exists gross_tco2e numeric;

insert into emission_factors (id, category, value, unit, gwp_version, source_citation, valid_from) values
  ('00000000-0000-0000-0000-0000000000d7', 'electricity_grid', 0.0461, 'tCO2/MWh', null,
   'MCTI — fator médio do SIN, média anual 2025 (Memória de Cálculo PMX-EM v2.0, Parâmetros EF_SIN)', '2025-01-01')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Insumos anuais do motor v2.0 que não são parâmetro da metodologia
-- ----------------------------------------------------------------------------
-- Base comercial, bovinos de corte, exportação, estoques... variam por ano e
-- por projeto; ficam em tabela própria editável pela desenvolvedora (antes o
-- "comercializado" só saía da soma de NF-e, travado para o proponente).
create table if not exists project_period_inputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  period_year int not null,
  input_key text not null,
  value numeric not null,
  unit text not null,
  source_ref text,
  created_at timestamptz not null default now(),
  unique (project_id, period_year, input_key)
);

alter table project_period_inputs enable row level security;

create policy project_period_inputs_read
  on project_period_inputs for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

create policy project_period_inputs_insert
  on project_period_inputs for insert
  to authenticated
  with check (has_project_write_role(project_id, array['developer', 'admin']::project_role[])
              or is_platform_admin());

create policy project_period_inputs_update
  on project_period_inputs for update
  to authenticated
  using (has_project_write_role(project_id, array['developer', 'admin']::project_role[])
         or is_platform_admin())
  with check (has_project_write_role(project_id, array['developer', 'admin']::project_role[])
              or is_platform_admin());

create policy project_period_inputs_delete
  on project_period_inputs for delete
  to authenticated
  using (has_project_write_role(project_id, array['developer', 'admin']::project_role[])
         or is_platform_admin());

create trigger trg_audit_project_period_inputs
  after insert or update or delete on project_period_inputs
  for each row execute function fn_audit_trigger();

-- ----------------------------------------------------------------------------
-- 5. Persistência atômica do ciclo de cálculo
-- ----------------------------------------------------------------------------
-- O motor v1 recalcula apagando o ciclo e recriando — o cascade leva junto
-- lote, emissões e tokens, o que destruiria o histórico dos tokens
-- cancelados. Esta função atualiza o ciclo e o lote NO LUGAR, substitui só as
-- etapas, e roda numa transação só (security definer: as policies de
-- escrita das tabelas filhas não cobrem todos os caminhos).
create or replace function persist_credit_cycle(
  p_project_id uuid,
  p_period_year int,
  p_methodology_version_id uuid,
  p_engine_version text,
  p_tco2e_amount numeric,
  p_commercialization_factor numeric,
  p_eligibility_factor numeric,
  p_steps jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle credit_calculation_cycles%rowtype;
  v_cycle_id uuid;
  v_batch_id uuid;
begin
  if not (is_platform_admin()
          or has_project_write_role(p_project_id, array['developer', 'admin']::project_role[])) then
    raise exception 'Sem permissão para calcular o ciclo de créditos deste projeto.' using errcode = '42501';
  end if;

  select * into v_cycle
  from credit_calculation_cycles
  where project_id = p_project_id and period_year = p_period_year;

  if found then
    -- Só recalcula antes da verificação — ou depois dela, se a registradora
    -- reabriu o ciclo com bloqueio de emissão (retificação de vintage).
    if v_cycle.status::text not in ('draft', 'calculated')
       and not (v_cycle.status::text = 'verified' and v_cycle.issuance_hold) then
      raise exception 'Ciclo já está em ''%'' — não é possível recalcular após início da verificação.', v_cycle.status
        using errcode = 'P0001';
    end if;

    v_cycle_id := v_cycle.id;
    update credit_calculation_cycles
    set methodology_version_id = p_methodology_version_id,
        status = 'calculated',
        calculated_at = now(),
        calculated_by = auth.uid(),
        engine_version = p_engine_version,
        source = 'engine'
    where id = v_cycle_id;

    delete from credit_calculation_steps where cycle_id = v_cycle_id;

    select id into v_batch_id
    from credit_batches where cycle_id = v_cycle_id
    order by created_at limit 1;

    if v_batch_id is null then
      insert into credit_batches (cycle_id, tco2e_amount, commercialization_factor, eligibility_factor)
      values (v_cycle_id, p_tco2e_amount, p_commercialization_factor, p_eligibility_factor);
    else
      update credit_batches
      set tco2e_amount = p_tco2e_amount,
          commercialization_factor = p_commercialization_factor,
          eligibility_factor = p_eligibility_factor,
          status = 'pending_verification'
      where id = v_batch_id;
    end if;
  else
    insert into credit_calculation_cycles
      (project_id, period_year, methodology_version_id, status, calculated_at, calculated_by, engine_version, source)
    values
      (p_project_id, p_period_year, p_methodology_version_id, 'calculated', now(), auth.uid(), p_engine_version, 'engine')
    returning id into v_cycle_id;

    insert into credit_batches (cycle_id, tco2e_amount, commercialization_factor, eligibility_factor)
    values (v_cycle_id, p_tco2e_amount, p_commercialization_factor, p_eligibility_factor);
  end if;

  insert into credit_calculation_steps (cycle_id, step_number, step_key, input_values, output_value, unit)
  select v_cycle_id,
         (s ->> 'step_number')::int,
         s ->> 'step_key',
         s -> 'input_values',
         (s ->> 'output_value')::numeric,
         s ->> 'unit'
  from jsonb_array_elements(p_steps) s;

  return v_cycle_id;
end;
$$;

grant execute on function persist_credit_cycle(uuid, int, uuid, text, numeric, numeric, numeric, jsonb) to authenticated;

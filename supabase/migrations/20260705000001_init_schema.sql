-- SafeCarbon — schema inicial
-- Implementa o modelo de dados descrito em docs/03-modelo-de-dados.md.
-- Projeto Supabase dedicado ao SafeCarbon (não é o mesmo projeto do Conecta Pecuária).

-- ============================================================================
-- 1. Identidade e Tenancy
-- ============================================================================

create type org_type as enum (
  'platform_operator',
  'project_developer',
  'proponent',
  'verifier',
  'buyer'
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type org_type not null,
  tax_id text,
  created_at timestamptz not null default now()
);

create table org_members (
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_role text not null check (member_role in ('owner', 'manager', 'contributor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create type project_role as enum ('proponent', 'developer', 'verifier', 'admin');

-- carbon_projects é declarada abaixo; project_roles referencia ela.

-- ============================================================================
-- 2. Metodologia (Requisito 1)
-- ============================================================================

create table methodologies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text not null,
  ipcc_category text,
  owner_org_id uuid not null references organizations (id),
  created_at timestamptz not null default now()
);

create type methodology_status as enum ('draft', 'published', 'deprecated');

create table methodology_versions (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references methodologies (id) on delete cascade,
  version_label text not null,
  status methodology_status not null default 'draft',
  supersedes_version_id uuid references methodology_versions (id),
  sections jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (methodology_id, version_label)
);

create table methodology_parameters (
  id uuid primary key default gen_random_uuid(),
  methodology_version_id uuid not null references methodology_versions (id) on delete cascade,
  param_key text not null,
  value numeric not null,
  unit text,
  source_citation text,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now()
);

create index idx_methodology_parameters_lookup
  on methodology_parameters (methodology_version_id, param_key, valid_from);

-- ============================================================================
-- 3. Projetos e DCP (Requisito 2)
-- ============================================================================

create type registry_standard as enum ('verra', 'gold_standard', 'mbre', 'none_yet');
create type project_status as enum ('design', 'validation', 'active', 'suspended', 'closed');

create table carbon_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  proponent_org_id uuid not null references organizations (id),
  developer_org_id uuid not null references organizations (id),
  methodology_version_id uuid references methodology_versions (id),
  registry_standard registry_standard not null default 'none_yet',
  location_text text,
  status project_status not null default 'design',
  created_at timestamptz not null default now()
);

create table project_roles (
  project_id uuid not null references carbon_projects (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  role project_role not null,
  created_at timestamptz not null default now(),
  primary key (project_id, org_id, role)
);

create type dcp_status as enum ('draft', 'published');

create table dcp_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  version_number int not null,
  status dcp_status not null default 'draft',
  exported_docx_url text,
  exported_pdf_url text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create table dcp_sections (
  id uuid primary key default gen_random_uuid(),
  dcp_document_id uuid not null references dcp_documents (id) on delete cascade,
  section_key text not null,
  content jsonb not null default '{}'::jsonb,
  is_generated boolean not null default false,
  source_reference jsonb,
  updated_at timestamptz not null default now(),
  unique (dcp_document_id, section_key)
);

-- ============================================================================
-- 4. Produção e Comercialização
-- ============================================================================

create type production_source as enum ('erp_integration', 'manual_entry');

create table production_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  period_year int not null,
  period_month int check (period_month between 1 and 12),
  quantity_kg numeric not null check (quantity_kg >= 0),
  source production_source not null default 'manual_entry',
  evidence_doc_url text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index idx_production_records_period
  on production_records (project_id, period_year);

create table commercialization_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  nfe_key text not null unique,
  nfe_number text,
  issue_date date not null,
  buyer_tax_id text,
  quantity_kg numeric not null check (quantity_kg >= 0),
  raw_file_url text,
  linked_production_period_year int,
  already_credited boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_commercialization_documents_period
  on commercialization_documents (project_id, issue_date);

-- View agregada: produção e comercialização por projeto/ano (Pfp, Tc, Fc).
create view production_period_summary as
select
  pr.project_id,
  pr.period_year,
  sum(pr.quantity_kg) as total_produced_kg,
  coalesce(cd.total_commercialized_kg, 0) as total_commercialized_kg,
  case
    when sum(pr.quantity_kg) > 0
      then coalesce(cd.total_commercialized_kg, 0) / sum(pr.quantity_kg)
    else null
  end as commercialization_factor
from production_records pr
left join (
  select
    project_id,
    extract(year from issue_date)::int as period_year,
    sum(quantity_kg) as total_commercialized_kg
  from commercialization_documents
  group by project_id, extract(year from issue_date)
) cd
  on cd.project_id = pr.project_id and cd.period_year = pr.period_year
group by pr.project_id, pr.period_year, cd.total_commercialized_kg;

-- ============================================================================
-- 5. Inventário de Emissões e Vazamentos (Requisito 4)
-- ============================================================================

create table emission_factors (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  value numeric not null,
  unit text not null,
  gwp_version text,
  source_citation text,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now()
);

create table emission_inventory_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  period_year int not null,
  source_type text not null,
  activity_quantity numeric not null,
  activity_unit text not null,
  emission_factor_ids uuid[] not null default '{}',
  calculated_tco2e numeric not null,
  justification text,
  created_at timestamptz not null default now()
);

create index idx_emission_inventory_period
  on emission_inventory_entries (project_id, period_year);

create type leakage_category as enum (
  'rebound_effect',
  'technology_substitution',
  'supply_chain',
  'geographic_displacement',
  'other'
);

create table leakage_assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  period_year int not null,
  category leakage_category not null,
  conclusion text not null,
  justification text not null,
  leakage_factor_pct numeric not null default 0,
  created_at timestamptz not null default now()
);

create index idx_leakage_assessments_period
  on leakage_assessments (project_id, period_year);

-- ============================================================================
-- 6. Cálculo e Créditos (Requisito 5)
-- ============================================================================

create type cycle_status as enum (
  'draft',
  'calculated',
  'in_verification',
  'verified',
  'approved',
  'issued',
  'rejected'
);

create table credit_calculation_cycles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  period_year int not null,
  methodology_version_id uuid not null references methodology_versions (id),
  status cycle_status not null default 'draft',
  calculated_at timestamptz,
  calculated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (project_id, period_year)
);

create table credit_calculation_steps (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references credit_calculation_cycles (id) on delete cascade,
  step_number int not null,
  step_key text not null,
  input_values jsonb not null default '{}'::jsonb,
  output_value numeric not null,
  unit text,
  created_at timestamptz not null default now(),
  unique (cycle_id, step_number)
);

create type batch_status as enum (
  'pending_verification',
  'verified',
  'approved',
  'issued',
  'retired'
);

create table credit_batches (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references credit_calculation_cycles (id) on delete cascade,
  tco2e_amount numeric not null,
  commercialization_factor numeric,
  eligibility_factor numeric not null default 1,
  status batch_status not null default 'pending_verification',
  created_at timestamptz not null default now()
);

create type verification_status as enum ('scheduled', 'in_progress', 'approved', 'rejected');

create table verification_cycles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  period_start_year int not null,
  period_end_year int not null,
  vvb_org_id uuid references organizations (id),
  status verification_status not null default 'scheduled',
  verification_statement_url text,
  findings jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table credit_issuances (
  id uuid primary key default gen_random_uuid(),
  credit_batch_id uuid not null references credit_batches (id) on delete cascade,
  verification_cycle_id uuid references verification_cycles (id),
  issued_amount_tco2e numeric not null,
  serial_number_start text,
  serial_number_end text,
  issued_at timestamptz not null default now()
);

-- ============================================================================
-- 7. Blockchain (integração Safe Trace)
-- ============================================================================

create type token_status as enum ('active', 'transferred', 'retired');

create table blockchain_tokens (
  id uuid primary key default gen_random_uuid(),
  credit_issuance_id uuid not null references credit_issuances (id) on delete cascade,
  token_id text not null,
  tx_hash text not null,
  ledger_ref text,
  status token_status not null default 'active',
  owner_reference text,
  retired_at timestamptz,
  retired_reason text,
  created_at timestamptz not null default now(),
  unique (credit_issuance_id)
);

-- ============================================================================
-- 8. Referências geoespaciais (SafeGisTrace)
-- ============================================================================

create table project_sites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  label text not null,
  latitude numeric(10, 6),
  longitude numeric(10, 6),
  safegistrace_analysis_id text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 9. Relatórios
-- ============================================================================

create table monitoring_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  period_year int not null,
  exported_docx_url text,
  exported_pdf_url text,
  generated_at timestamptz not null default now()
);

create table resumo_calculo_documents (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references credit_calculation_cycles (id) on delete cascade,
  narrative_text text not null,
  exported_docx_url text,
  exported_pdf_url text,
  generated_at timestamptz not null default now()
);

-- ============================================================================
-- 10. Auditoria
-- ============================================================================

create table audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now()
);

create index idx_audit_log_record on audit_log (table_name, record_id);

create or replace function fn_audit_trigger()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into audit_log (table_name, record_id, action, old_value, new_value, changed_by)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('update', 'delete') then to_jsonb(old) else null end,
    case when tg_op in ('update', 'insert') then to_jsonb(new) else null end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_production_records
  after insert or update or delete on production_records
  for each row execute function fn_audit_trigger();

create trigger trg_audit_commercialization_documents
  after insert or update or delete on commercialization_documents
  for each row execute function fn_audit_trigger();

create trigger trg_audit_emission_inventory_entries
  after insert or update or delete on emission_inventory_entries
  for each row execute function fn_audit_trigger();

create trigger trg_audit_methodology_parameters
  after insert or update or delete on methodology_parameters
  for each row execute function fn_audit_trigger();

create trigger trg_audit_credit_calculation_cycles
  after insert or update or delete on credit_calculation_cycles
  for each row execute function fn_audit_trigger();

-- ============================================================================
-- 11. RLS — princípio: nunca coexistir uma policy USING(true) com policy
-- restritiva de SELECT na mesma tabela (ver docs/03-modelo-de-dados.md,
-- lição herdada do Conecta Pecuária / feedback_security_rls).
-- ============================================================================

create or replace function has_project_role(p_project_id uuid, p_roles project_role[])
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from project_roles pr
    join org_members om on om.org_id = pr.org_id
    where pr.project_id = p_project_id
      and om.user_id = auth.uid()
      and pr.role = any(p_roles)
  );
$$;

create or replace function is_platform_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from org_members om
    join organizations o on o.id = om.org_id
    where om.user_id = auth.uid()
      and o.org_type = 'platform_operator'
  );
$$;

alter table organizations enable row level security;
alter table org_members enable row level security;
alter table methodologies enable row level security;
alter table methodology_versions enable row level security;
alter table methodology_parameters enable row level security;
alter table carbon_projects enable row level security;
alter table project_roles enable row level security;
alter table dcp_documents enable row level security;
alter table dcp_sections enable row level security;
alter table production_records enable row level security;
alter table commercialization_documents enable row level security;
alter table emission_inventory_entries enable row level security;
alter table leakage_assessments enable row level security;
alter table credit_calculation_cycles enable row level security;
alter table credit_calculation_steps enable row level security;
alter table credit_batches enable row level security;
alter table verification_cycles enable row level security;
alter table credit_issuances enable row level security;
alter table blockchain_tokens enable row level security;
alter table project_sites enable row level security;
alter table monitoring_reports enable row level security;
alter table resumo_calculo_documents enable row level security;

-- Metodologias publicadas são de leitura pública para qualquer usuário autenticado
-- (Requisito 1 — consulta aberta). É a única exceção deliberada ao isolamento por projeto.
create policy methodology_versions_public_read
  on methodology_versions for select
  to authenticated
  using (status = 'published' or is_platform_admin());

create policy methodologies_public_read
  on methodologies for select
  to authenticated
  using (true);

create policy methodology_parameters_public_read
  on methodology_parameters for select
  to authenticated
  using (
    exists (
      select 1 from methodology_versions mv
      where mv.id = methodology_parameters.methodology_version_id
        and (mv.status = 'published' or is_platform_admin())
    )
  );

-- carbon_projects: visível para membros de organizações com algum papel no projeto,
-- ou platform_admin.
create policy carbon_projects_member_read
  on carbon_projects for select
  to authenticated
  using (has_project_role(id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

-- Dado primário de projeto (produção, comercialização, inventário, vazamento):
-- leitura para qualquer papel do projeto; escrita restrita a proponent/developer/admin.
create policy production_records_read
  on production_records for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

create policy production_records_write
  on production_records for insert
  to authenticated
  with check (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

create policy commercialization_documents_read
  on commercialization_documents for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

create policy commercialization_documents_write
  on commercialization_documents for insert
  to authenticated
  with check (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

create policy emission_inventory_entries_read
  on emission_inventory_entries for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

create policy emission_inventory_entries_write
  on emission_inventory_entries for insert
  to authenticated
  with check (has_project_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

-- Cálculo de créditos: leitura para todos os papéis do projeto; escrita (rodar o motor)
-- restrita a developer/admin; aprovação de verificação é ação separada do verifier
-- (feita via update em verification_cycles / credit_batches, não aqui).
create policy credit_calculation_cycles_read
  on credit_calculation_cycles for select
  to authenticated
  using (has_project_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin());

create policy credit_calculation_cycles_write
  on credit_calculation_cycles for insert
  to authenticated
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

-- Nota: as demais tabelas (dcp_documents, dcp_sections, verification_cycles,
-- credit_batches, credit_issuances, blockchain_tokens, project_sites,
-- monitoring_reports, resumo_calculo_documents, org_members, project_roles)
-- seguem o mesmo padrão (leitura por papel do projeto, escrita restrita por papel)
-- e serão adicionadas como policies específicas no Sprint 0 de implementação
-- (docs/06-roadmap-sprints.md), junto com os testes de RLS que provam que não há
-- policy `USING (true)` coexistindo com uma restritiva.

-- ============================================================================
-- Calculadora de Pegada de Carbono (GHG Protocol) — módulo novo, Fase 1.
--
-- Schema completo desde já (arquitetura para paridade total com a Ferramenta
-- GHG Protocol v2026.0.1 / FGV); fontes implementadas em fases. Um inventário
-- pertence a uma organização + um ano. Modelo de lançamento GENÉRICO
-- (source_category + activity_data/computed em JSONB) para adicionar fontes
-- novas sem migração. Fatores oficiais extraídos da planilha (seed no fim).
--
-- Aplicar no SQL Editor do Supabase (deploy manual — o ambiente de dev não
-- resolve *.supabase.co).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Inventário (dado do usuário)
-- ----------------------------------------------------------------------------

create table ghg_inventories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  inventory_year int not null,
  name text,
  status text not null default 'draft' check (status in ('draft', 'final')),
  responsible_name text,
  responsible_phone text,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, inventory_year)
);

create index idx_ghg_inventories_org on ghg_inventories (organization_id, inventory_year);

create table ghg_activity_entries (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references ghg_inventories (id) on delete cascade,
  scope int not null check (scope between 1 and 3),
  source_category text not null check (source_category in (
    'stationary_combustion', 'mobile_combustion', 'electricity_location',
    'electricity_market', 'business_travel', 'commuting'
  )),
  source_ref text,
  description text,
  activity_data jsonb not null default '{}'::jsonb,
  computed jsonb not null default '{}'::jsonb,
  -- Coluna gerada: agregação/índice SQL barato sem abrir mão do JSONB.
  co2e_t numeric generated always as (((computed ->> 'co2e_t'))::numeric) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ghg_activity_entries_inv on ghg_activity_entries (inventory_id, source_category);

-- ----------------------------------------------------------------------------
-- Fatores (referência — leitura pública a authenticated, escrita só via seed)
-- ----------------------------------------------------------------------------

create table ghg_fuel_factors (
  id uuid primary key default gen_random_uuid(),
  ref_no int,
  name_pt text not null,
  name_en text,
  unit text not null,
  pci_gj_t numeric,
  density_kg_unit numeric,
  co2_kg_tj numeric,
  -- Fatores JÁ CONVERTIDOS por unidade (kg/un). CO2 único; CH4/N2O por setor.
  co2_kg_un numeric not null default 0,
  ch4_kg_un_energy numeric not null default 0,
  ch4_kg_un_manufacturing numeric not null default 0,
  ch4_kg_un_commercial numeric not null default 0,
  ch4_kg_un_residential numeric not null default 0,
  n2o_kg_un_energy numeric not null default 0,
  n2o_kg_un_manufacturing numeric not null default 0,
  n2o_kg_un_commercial numeric not null default 0,
  n2o_kg_un_residential numeric not null default 0,
  is_biofuel boolean not null default false,
  source_ref text,
  source text
);

create table ghg_grid_factors (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int,
  region text not null default 'SIN',
  method text not null default 'location',
  co2_t_mwh numeric not null default 0,
  co2_upstream_t_mwh numeric,
  ch4_t_mwh numeric not null default 0,
  n2o_t_mwh numeric not null default 0,
  source text
);

create index idx_ghg_grid_factors_lookup on ghg_grid_factors (region, year, month);

create table ghg_generic_factors (
  id uuid primary key default gen_random_uuid(),
  source_category text not null,
  factor_key text not null,
  description text,
  unit text,
  co2_kg numeric not null default 0,
  ch4_kg numeric not null default 0,
  n2o_kg numeric not null default 0,
  co2e_kg numeric,
  biogenic_co2_kg numeric not null default 0,
  meta jsonb,
  source_ref text,
  source text,
  unique (source_category, factor_key)
);

create table ghg_gwp (
  gas text primary key,
  gwp numeric not null,
  ar_version text not null default 'AR5'
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table ghg_inventories enable row level security;
alter table ghg_activity_entries enable row level security;
alter table ghg_fuel_factors enable row level security;
alter table ghg_grid_factors enable row level security;
alter table ghg_generic_factors enable row level security;
alter table ghg_gwp enable row level security;

-- Function SECURITY DEFINER para resolver inventory -> org sem subquery
-- recursiva na policy da entry (mesmo padrão de is_org_manager).
create or replace function can_access_inventory(p_inventory_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from ghg_inventories inv
    join org_members om on om.org_id = inv.organization_id
    where inv.id = p_inventory_id and om.user_id = auth.uid()
  ) or is_platform_admin();
$$;

-- Inventários: membros da organização + platform admin.
create policy ghg_inventories_read
  on ghg_inventories for select to authenticated
  using (
    exists (select 1 from org_members om where om.org_id = ghg_inventories.organization_id and om.user_id = auth.uid())
    or is_platform_admin()
  );

create policy ghg_inventories_write
  on ghg_inventories for insert to authenticated
  with check (
    exists (select 1 from org_members om where om.org_id = ghg_inventories.organization_id and om.user_id = auth.uid())
    or is_platform_admin()
  );

create policy ghg_inventories_update
  on ghg_inventories for update to authenticated
  using (
    exists (select 1 from org_members om where om.org_id = ghg_inventories.organization_id and om.user_id = auth.uid())
    or is_platform_admin()
  )
  with check (
    exists (select 1 from org_members om where om.org_id = ghg_inventories.organization_id and om.user_id = auth.uid())
    or is_platform_admin()
  );

create policy ghg_inventories_delete
  on ghg_inventories for delete to authenticated
  using (
    exists (select 1 from org_members om where om.org_id = ghg_inventories.organization_id and om.user_id = auth.uid())
    or is_platform_admin()
  );

-- Entries: via function (evita join recursivo; a policy de SELECT enxerga a
-- linha recém-inserida, mas o client insere sem RETURNING e recarrega).
create policy ghg_activity_entries_read
  on ghg_activity_entries for select to authenticated
  using (can_access_inventory(inventory_id));

create policy ghg_activity_entries_write
  on ghg_activity_entries for insert to authenticated
  with check (can_access_inventory(inventory_id));

create policy ghg_activity_entries_update
  on ghg_activity_entries for update to authenticated
  using (can_access_inventory(inventory_id))
  with check (can_access_inventory(inventory_id));

create policy ghg_activity_entries_delete
  on ghg_activity_entries for delete to authenticated
  using (can_access_inventory(inventory_id));

-- Tabelas de fator: uma única policy de leitura pública a authenticated
-- (referência). Escrita bloqueada por ausência de policy (default deny); a
-- gestão é via seed/migração. Mesmo padrão de emission_factors_public_read.
create policy ghg_fuel_factors_read on ghg_fuel_factors for select to authenticated using (true);
create policy ghg_grid_factors_read on ghg_grid_factors for select to authenticated using (true);
create policy ghg_generic_factors_read on ghg_generic_factors for select to authenticated using (true);
create policy ghg_gwp_read on ghg_gwp for select to authenticated using (true);

-- ============================================================================
-- SEED — fatores oficiais extraídos da Ferramenta GHG Protocol v2026.0.1 (FGV)
-- por scripts/extract_ghg_factors.py. Ver o script para regenerar.
-- ============================================================================

delete from ghg_fuel_factors; delete from ghg_grid_factors; delete from ghg_gwp; delete from ghg_generic_factors;

insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (2, 'Acetileno', '-', 'kg', null, null, null, 3.3846153846153846, 0, 0, 0, 0, 0, 0, 0, 0, false, 'Programa Brasileiro GHG Protocol', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (3, 'Alcatrão', 'Coal Tar', 'm³', 35.79714, 1000.0, 80666.66666666666, 2887.6359599999996, 0.03579714, 0.35797140000000005, 0.35797140000000005, 10.739142, 0.05369571, 0.05369571, 0.05369571, 0.05369571, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (4, 'Asfaltos', 'Bitumen', 'm³', 40.988772, 1025.0, 80666.66666666666, 3389.0882981999994, 0.1260404739, 0.1260404739, 0.42013491299999994, 0.42013491299999994, 0.02520809478, 0.02520809478, 0.02520809478, 0.02520809478, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (5, 'Carvão Metalúrgico Importado', 'Coking Coal', 'Toneladas', 30.98232, 1000.0, 94600.0, 2930.927472, 0.03098232, 0.3098232000000001, 0.3098232000000001, 9.294696, 0.046473480000000005, 0.046473480000000005, 0.046473480000000005, 0.046473480000000005, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (6, 'Carvão Metalúrgico Nacional', 'Coking Coal', 'Toneladas', 26.879255999999998, 1000.0, 94600.0, 2542.7776175999998, 0.026879255999999997, 0.26879256, 0.26879256, 8.0637768, 0.040318884, 0.040318884, 0.040318884, 0.040318884, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (7, 'Carvão Vapor 3100 kcal / kg', 'Other Bituminous Coal', 'Toneladas', 12.35106, 1000.0, 101200.0, 1249.927272, 0.012351059999999999, 0.12351060000000001, 0.12351060000000001, 3.705318, 0.01852659, 0.01852659, 0.01852659, 0.01852659, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (8, 'Carvão Vapor 3300 kcal / kg', 'Other Bituminous Coal', 'Toneladas', 12.97908, 1000.0, 101200.0, 1313.482896, 0.01297908, 0.12979079999999998, 0.12979079999999998, 3.8937239999999997, 0.019468620000000002, 0.019468620000000002, 0.019468620000000002, 0.019468620000000002, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (9, 'Carvão Vapor 3700 kcal / kg', 'Other Bituminous Coal', 'Toneladas', 14.653799999999999, 1000.0, 101200.0, 1482.9645599999997, 0.0146538, 0.14653799999999997, 0.14653799999999997, 4.396139999999999, 0.021980699999999995, 0.021980699999999995, 0.021980699999999995, 0.021980699999999995, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (10, 'Carvão Vapor 4200 kcal / kg', 'Other Bituminous Coal', 'Toneladas', 16.7472, 1000.0, 96066.66666666666, 1608.8476799999999, 0.0167472, 0.16747199999999998, 0.16747199999999998, 5.02416, 0.0251208, 0.0251208, 0.0251208, 0.0251208, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (11, 'Carvão Vapor 4500 kcal / kg', 'Other Bituminous Coal', 'Toneladas', 17.793899999999997, 1000.0, 96066.66666666666, 1709.4006599999996, 0.017793899999999998, 0.17793899999999996, 0.17793899999999996, 5.338169999999999, 0.02669085, 0.02669085, 0.02669085, 0.02669085, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (12, 'Carvão Vapor 4700 kcal / kg', 'Other Bituminous Coal', 'Toneladas', 18.631259999999997, 1000.0, 94600.0, 1762.5171959999998, 0.018631259999999997, 0.18631259999999997, 0.18631259999999997, 5.589377999999999, 0.027946889999999995, 0.027946889999999995, 0.027946889999999995, 0.027946889999999995, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (13, 'Carvão Vapor 5200 kcal / kg', 'Other Bituminous Coal', 'Toneladas', 20.51532, 1000.0, 96066.66666666666, 1970.8384079999998, 0.02051532, 0.2051532, 0.2051532, 6.154596, 0.030772979999999995, 0.030772979999999995, 0.030772979999999995, 0.030772979999999995, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (14, 'Carvão Vapor 5900 kcal / kg', 'Other Bituminous Coal', 'Toneladas', 23.44608, 1000.0, 94600.0, 2217.999168, 0.023446079999999998, 0.2344608, 0.2344608, 7.033824, 0.035169120000000005, 0.035169120000000005, 0.035169120000000005, 0.035169120000000005, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (15, 'Carvão Vapor 6000 kcal / kg', 'Other Bituminous Coal', 'Toneladas', 23.864759999999997, 1000.0, 94600.0, 2257.6062959999995, 0.02386476, 0.23864759999999996, 0.23864759999999996, 7.159427999999999, 0.03579714, 0.03579714, 0.03579714, 0.03579714, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (16, 'Carvão Vapor sem Especificação', 'Other Bituminous Coal', 'Toneladas', 11.932379999999998, 1000.0, 101200.0, 1207.556856, 0.01193238, 0.11932379999999998, 0.11932379999999998, 3.5797139999999996, 0.01789857, 0.01789857, 0.01789857, 0.01789857, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (17, 'Coque de Carvão Mineral', 'Coke Oven Coke and Lignite Coke', 'Toneladas', 28.88892, 1000.0, 107066.66666666666, 3093.040368, 0.02888892, 0.28888919999999996, 0.28888919999999996, 8.666676, 0.04333338, 0.04333338, 0.04333338, 0.04333338, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (18, 'Coque de Petróleo', 'Petroleum Coke', 'm³', 35.127252, 1040.0, 97533.33333333333, 3563.121097536, 0.10959702623999999, 0.10959702623999999, 0.36532342079999996, 0.36532342079999996, 0.021919405248, 0.021919405248, 0.021919405248, 0.021919405248, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (19, 'Etano', 'Ethane', 'Toneladas', 46.4, 1000.0, 61600.0, 2858.24, 0.0464, 0.0464, 0.232, 0.232, 0.00464, 0.00464, 0.00464, 0.00464, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (20, 'Gás de Coqueria', 'Coke Oven Gas', 'Toneladas', 38.7, 1000.0, 44366.66666666666, 1716.9899999999998, 0.0387, 0.0387, 0.1935, 0.1935, 0.0038700000000000006, 0.0038700000000000006, 0.0038700000000000006, 0.0038700000000000006, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (21, 'Gás de Refinaria', 'Refinery Gas', 'Toneladas', 49.5, 1000.0, 57566.666666666664, 2849.55, 0.0495, 0.0495, 0.2475, 0.2475, 0.00495, 0.00495, 0.00495, 0.00495, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (22, 'Gás Liquefeito de Petróleo (GLP)', 'Liquefied Petroleum Gases', 'Toneladas', 46.473479999999995, 1000.0, 63066.666666666664, 2930.9274719999994, 0.04647348, 0.04647348, 0.23236739999999997, 0.23236739999999997, 0.004647348, 0.004647348, 0.004647348, 0.004647348, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (23, 'Gás Natural Seco', 'Natural Gas', 'm³', 49.78897297297297, 0.74, 56100.0, 2.066939424, 3.684384e-05, 3.684384e-05, 0.0001842192, 0.0001842192, 3.6843840000000007e-06, 3.6843840000000007e-06, 3.6843840000000007e-06, 3.6843840000000007e-06, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (24, 'Gás Natural Úmido', 'Natural Gas', 'm³', 56.18232972972972, 0.74, 56100.0, 2.3323532364, 4.157492399999999e-05, 4.157492399999999e-05, 0.00020787461999999997, 0.00020787461999999997, 4.1574924e-06, 4.1574924e-06, 4.1574924e-06, 4.1574924e-06, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (25, 'Gasolina Automotiva (pura)', 'Motor Gasoline', 'Litros', 43.54272, 0.742, 69300.0, 2.2389927880319997, 9.692609472e-05, 9.692609472e-05, 0.0003230869824, 0.0003230869824, 1.9385218944e-05, 1.9385218944e-05, 1.9385218944e-05, 1.9385218944e-05, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (26, 'Gasolina de Aviação', 'Aviation Gasoline', 'Litros', 44.38008, 0.726, 70033.33333333333, 2.2564696635359995, 9.665981424e-05, 9.665981424e-05, 0.0003221993808, 0.0003221993808, 1.9331962848e-05, 1.9331962848e-05, 1.9331962848e-05, 1.9331962848e-05, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (27, 'Líquidos de Gás Natural (LGN)', 'Natural Gas Liquids', 'Toneladas', 44.2, 1000.0, 64166.66666666666, 2836.1666666666665, 0.13260000000000002, 0.13260000000000002, 0.442, 0.442, 0.02652, 0.02652, 0.02652, 0.02652, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (28, 'Lubrificantes', 'Lubricants', 'Litros', 42.370416, 0.875, 73333.33333333333, 2.71876836, 0.000111222342, 0.000111222342, 0.00037074114, 0.00037074114, 2.22444684e-05, 2.22444684e-05, 2.22444684e-05, 2.22444684e-05, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (29, 'Nafta', 'Naphtha', 'm³', 44.505684, 702.0, 73333.33333333333, 2291.15261232, 0.09372897050400002, 0.09372897050400002, 0.31242990168, 0.31242990168, 0.018745794100799996, 0.018745794100799996, 0.018745794100799996, 0.018745794100799996, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (30, 'Óleo Combustível', 'Residual Fuel Oil', 'Litros', 40.15141199999999, 1.0, 77366.66666666667, 3.1063809084, 0.00012045423599999997, 0.00012045423599999997, 0.00040151411999999996, 0.00040151411999999996, 2.4090847199999995e-05, 2.4090847199999995e-05, 2.4090847199999995e-05, 2.4090847199999995e-05, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (31, 'Óleo de Xisto', 'Shale Oil', 'Toneladas', 38.1, 1000.0, 73300.0, 2792.73, 0.11430000000000001, 0.11430000000000001, 0.381, 0.381, 0.02286, 0.02286, 0.02286, 0.02286, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (32, 'Óleo Diesel (puro)', 'Diesel Oil', 'Litros', 42.28668, 0.84, 74066.66666666666, 2.6309080828799996, 0.0001065624336, 0.0001065624336, 0.00035520811199999996, 0.00035520811199999996, 2.1312486719999996e-05, 2.1312486719999996e-05, 2.1312486719999996e-05, 2.1312486719999996e-05, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (33, 'Óleos Residuais', 'Waste Oils', 'Toneladas', 40.2, 1000.0, 73300.0, 2946.66, 1.206, 1.206, 12.06, 12.06, 0.1608, 0.1608, 0.1608, 0.1608, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (34, 'Outros Produtos de Petróleo', 'Other Petroleum Products', 'Toneladas', 42.70536, 1000.0, 73333.33333333333, 3131.7264, 0.12811608000000002, 0.12811608000000002, 0.4270536, 0.4270536, 0.025623216, 0.025623216, 0.025623216, 0.025623216, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (35, 'Parafina', 'Paraffin Waxes', 'Toneladas', 40.2, 1000.0, 73300.0, 2946.66, 0.12060000000000001, 0.12060000000000001, 0.402, 0.402, 0.02412, 0.02412, 0.02412, 0.02412, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (36, 'Petróleo Bruto', 'Crude Oil', 'm³', 45.217439999999996, 884.0, 73333.33333333333, 2931.2959103999997, 0.11991665087999998, 0.11991665087999998, 0.39972216959999995, 0.39972216959999995, 0.023983330175999996, 0.023983330175999996, 0.023983330175999996, 0.023983330175999996, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (37, 'Querosene de Aviação', 'Jet Kerosene', 'Toneladas', 43.54272, 1000.0, 71500.0, 3113.30448, 0.13062816, 0.13062816, 0.4354272, 0.4354272, 0.026125632, 0.026125632, 0.026125632, 0.026125632, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (38, 'Querosene Iluminante', 'Other Kerosene', 'Toneladas', 43.54272, 1000.0, 71866.66666666667, 3129.2701440000005, 0.13062816, 0.13062816, 0.4354272, 0.4354272, 0.026125632, 0.026125632, 0.026125632, 0.026125632, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (39, 'Resíduos Industriais', 'Industrial Wastes', 'TJ', null, null, 143000.0, 143000.0, 30.0, 30.0, 300.0, 300.0, 4.0, 4.0, 4.0, 4.0, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (40, 'Resíduos Municipais (fração não-biomassa)', 'Municipal Wastes (non-biomass fraction)', 'Toneladas', 10.0, 1000.0, 91700.0, 917.0, 0.3, 0.3, 3.0, 3.0, 0.04, 0.04, 0.04, 0.04, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (41, 'Solventes', 'Other Petroleum Products', 'Litros', 44.170739999999995, 0.741, 73333.33333333333, 2.4002380116, 9.819155501999998e-05, 9.819155501999998e-05, 0.00032730518339999995, 0.00032730518339999995, 1.9638311004e-05, 1.9638311004e-05, 1.9638311004e-05, 1.9638311004e-05, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (42, 'Turfa', 'Peat', 'Toneladas', 9.76, 1000.0, 106000.0, 1034.56, 0.00976, 0.01952, 0.0976, 2.928, 0.01464, 0.01464, 0.013664, 0.013664, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (43, 'Xisto Betuminoso e Areias Betuminosas', 'Oil Shale and Tar Sands', 'Toneladas', 8.9, 1000.0, 107000.0, 952.3, 0.0089, 0.089, 0.089, 2.67, 0.013350000000000002, 0.013350000000000002, 0.013350000000000002, 0.013350000000000002, false, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (49, 'Etanol Anidro', 'Other Liquid Biofuels', 'Litros', 28.2609, 0.791, 70766.66666666667, 1.5819443847900003, 6.706311570000001e-05, 6.706311570000001e-05, 0.00022354371899999998, 0.00022354371899999998, 1.3412623140000001e-05, 1.3412623140000001e-05, 1.3412623140000001e-05, 1.3412623140000001e-05, true, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (50, 'Etanol Hidratado', 'Other Liquid Biofuels', 'Litros', 26.37684, 0.809, 70766.66666666667, 1.5100802445960002, 6.401659068000001e-05, 6.401659068000001e-05, 0.00021338863560000005, 0.00021338863560000005, 1.2803318136000002e-05, 1.2803318136000002e-05, 1.2803318136000002e-05, 1.2803318136000002e-05, true, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (51, 'Bagaço de Cana', 'Other Primary Solid Biomass', 'Toneladas', 8.917884, 1000.0, 100100.0, 892.6801884000001, 0.26753652, 0.26753652, 2.6753652000000003, 2.6753652000000003, 0.035671536, 0.035671536, 0.035671536, 0.035671536, true, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (52, 'Biodiesel (B100)', 'Biodiesels', 'Litros', 37.6812, 0.88, 74066.66666666666, 2.4560103743999995, 9.9478368e-05, 9.9478368e-05, 0.00033159455999999993, 0.00033159455999999993, 1.98956736e-05, 1.98956736e-05, 1.98956736e-05, 1.98956736e-05, true, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (53, 'Biogás (outros)', 'Other biogas', 'Toneladas', 20.0, 1000.0, 85271.31782945737, 1705.4263565891474, 0.02, 0.02, 0.1, 0.1, 0.002, 0.002, 0.002, 0.002, true, 'DEFRA, 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (54, 'Biogás de aterro', 'Landfill biogas', 'Toneladas', 12.3, 1000.0, 119241.1924119241, 1466.6666666666665, 0.0123, 0.0123, 0.0615, 0.0615, 0.0012300000000000002, 0.0012300000000000002, 0.0012300000000000002, 0.0012300000000000002, true, 'DEFRA, 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (55, 'Biometano', 'Other biogas', 'Toneladas', 49.0, 1000.0, 56100.0, 2748.9, 0.049, 0.049, 0.245, 0.245, 0.0049, 0.0049, 0.0049, 0.0049, true, 'DEFRA, 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (56, 'Biopropano (bioGLP)', 'Other biogas', 'Toneladas', 46.4, 1000.0, 63066.666666666664, 2926.293333333333, 0.0464, 0.0464, 0.232, 0.232, 0.00464, 0.00464, 0.00464, 0.00464, true, 'DEFRA, 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (57, 'Caldo de Cana', 'Other Liquid Biofuels', 'Toneladas', 2.5958159999999997, 1000.0, 79566.66666666666, 206.54042639999994, 0.007787448, 0.007787448, 0.025958159999999997, 0.025958159999999997, 0.0015574895999999998, 0.0015574895999999998, 0.0015574895999999998, 0.0015574895999999998, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (58, 'Carvão Vegetal', 'Charcoal', 'Toneladas', 27.046727999999998, 1000.0, 106700.0, 2885.8858775999997, 5.4093456, 5.4093456, 5.4093456, 5.4093456, 0.108186912, 0.108186912, 0.027046728, 0.027046728, true, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (59, 'Lenha Comercial', 'Wood / Wood Waste', 'Toneladas', 12.97908, 1000.0, 111833.33333333333, 1451.4937799999998, 0.38937239999999995, 0.38937239999999995, 3.8937239999999997, 3.8937239999999997, 0.05191632, 0.05191632, 0.05191632, 0.05191632, true, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (60, 'Licor Negro (Lixívia)', 'Sulphite lyes (Black Liquor)', 'Toneladas', 11.974248, 1000.0, 95333.33333333333, 1141.5449759999997, 0.03592274399999999, 0.03592274399999999, 0.03592274399999999, 0.03592274399999999, 0.023948496, 0.023948496, 0.023948496, 0.023948496, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (61, 'Melaço', 'Other Liquid Biofuels', 'Toneladas', 7.74558, 1000.0, 79566.66666666666, 616.289982, 0.023236740000000002, 0.023236740000000002, 0.07745580000000002, 0.07745580000000002, 0.004647348, 0.004647348, 0.004647348, 0.004647348, false, 'BEN 2023', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (62, 'Resíduos Municipais (fração biomassa)', 'Municipal Wastes (biomass fraction)', 'Toneladas', 11.6, 1000.0, 100000.0, 1160.0, 0.348, 0.348, 3.48, 3.48, 0.0464, 0.0464, 0.0464, 0.0464, true, 'IPCC 2006', 'GHG Protocol FGV v2026.0.1');
insert into ghg_fuel_factors (ref_no, name_pt, name_en, unit, pci_gj_t, density_kg_unit, co2_kg_tj, co2_kg_un, ch4_kg_un_energy, ch4_kg_un_manufacturing, ch4_kg_un_commercial, ch4_kg_un_residential, n2o_kg_un_energy, n2o_kg_un_manufacturing, n2o_kg_un_commercial, n2o_kg_un_residential, is_biofuel, source_ref, source) values (63, 'Resíduos Vegetais', 'Other Primary Solid Biomass', 'Toneladas', 11.6, 1000.0, 100100.0, 1161.16, 0.348, 0.348, 3.48, 3.48, 0.0464, 0.0464, 0.0464, 0.0464, true, 'MCTIC 2016', 'GHG Protocol FGV v2026.0.1');

insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2006, null, 'SIN', 'location', 0.0323, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2007, null, 'SIN', 'location', 0.0293, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2008, null, 'SIN', 'location', 0.0484, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2009, null, 'SIN', 'location', 0.0246, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2010, null, 'SIN', 'location', 0.051274999999999994, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2011, null, 'SIN', 'location', 0.0292, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2012, null, 'SIN', 'location', 0.06534166666666667, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2013, null, 'SIN', 'location', 0.09603333333333335, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2014, null, 'SIN', 'location', 0.13548333333333332, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2015, null, 'SIN', 'location', 0.12444166666666666, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2016, null, 'SIN', 'location', 0.08168333333333333, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2017, null, 'SIN', 'location', 0.09273333333333333, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2018, null, 'SIN', 'location', 0.07398333333333333, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2019, null, 'SIN', 'location', 0.07504166666666667, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2020, null, 'SIN', 'location', 0.061724999999999995, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2021, null, 'SIN', 'location', 0.1264166666666667, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2022, null, 'SIN', 'location', 0.04259554853294196, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2023, null, 'SIN', 'location', 0.038509564776270926, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2024, null, 'SIN', 'location', 0.05446244773345652, 0, 0, 'MCTI/SIN via GHG Protocol FGV');
insert into ghg_grid_factors (year, month, region, method, co2_t_mwh, ch4_t_mwh, n2o_t_mwh, source) values (2025, null, 'SIN', 'location', 0.04608333333333334, 0, 0, 'MCTI/SIN via GHG Protocol FGV');

insert into ghg_gwp (gas, gwp, ar_version) values ('CO2', 1.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('CH4', 28.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('N2O', 265.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-23', 12400.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-32', 677.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-41', 116.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-125', 3170.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-134', 1120.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-134a', 1300.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-143', 328.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-143a', 4800.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-152', 16.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-152a', 138.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-161', 4.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-227ea', 3350.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-236cb', 1210.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-236ea', 1330.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-236fa', 8060.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-245ca', 716.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-245fa', 858.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-365mfc', 804.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('HFC-43-10mee', 1650.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('SF6', 23500.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('NF3', 16100.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('PFC-14', 6630.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('PFC-116', 11100.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('PFC-218', 8900.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('PFC-318', 9540.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('PFC-3-1-10', 9200.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('PFC-4-1-12', 8550.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('PFC-5-1-14', 7910.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('PFC-9-1-18', 7190.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('SF5CF3', 17400.0, 'AR5');
insert into ghg_gwp (gas, gwp, ar_version) values ('c-C3F6', 9200.0, 'AR5');

insert into ghg_generic_factors (source_category, factor_key, description, unit, co2_kg, ch4_kg, n2o_kg, co2e_kg, biogenic_co2_kg, source) values ('business_travel', 'air_short', 'Viagem aérea — curta distância (≤ 500 km)', 'kg/p.km', 0.12402777777777778, 7.2751322751322755e-06, 4.682040531097135e-06, null, 0, 'DEFRA via GHG Protocol FGV');
insert into ghg_generic_factors (source_category, factor_key, description, unit, co2_kg, ch4_kg, n2o_kg, co2e_kg, biogenic_co2_kg, source) values ('business_travel', 'air_medium', 'Viagem aérea — média distância (500–3700 km)', 'kg/p.km', 0.06912962962962962, 3.306878306878307e-07, 3.214535290006988e-06, null, 0, 'DEFRA via GHG Protocol FGV');
insert into ghg_generic_factors (source_category, factor_key, description, unit, co2_kg, ch4_kg, n2o_kg, co2e_kg, biogenic_co2_kg, source) values ('business_travel', 'air_long', 'Viagem aérea — longa distância (> 3700 km)', 'kg/p.km', 0.08252777777777777, 3.306878306878307e-07, 4.50733752620545e-06, null, 0, 'DEFRA via GHG Protocol FGV');
insert into ghg_generic_factors (source_category, factor_key, description, unit, co2_kg, ch4_kg, n2o_kg, co2e_kg, biogenic_co2_kg, source) values ('commuting', 'bus_municipal_diesel', 'Ônibus municipal a diesel (por passageiro.km)', 'kg/p.km', 0.10945070180029441, 7.683861878784e-06, 4.137464088576001e-06, null, 0, 'GHG Protocol FGV v2026.0.1');

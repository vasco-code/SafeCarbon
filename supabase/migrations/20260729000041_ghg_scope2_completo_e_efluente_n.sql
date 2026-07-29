-- ============================================================================
-- Fecha o Escopo 2 completo (5/5 abordagens da planilha FGV, Resumo linha 128):
-- eletricidade localização/escolha de compra (já existiam) + as 3 que
-- faltavam — Perdas T&D (localização), Perdas T&D (escolha de compra) e
-- Compra de Energia Térmica. Nenhuma delas precisa de tabela de fator nova:
-- as duas de T&D reusam exatamente o mesmo fator (SIN por ano / fator do
-- instrumento informado pelo usuário) que electricity_location/market já
-- usam — só troca o rótulo/categoria; Compra de Energia Térmica reusa
-- ghg_fuel_factors (mesmos ~60 combustíveis de Combustão estacionária), mas
-- precisa do fator BRUTO kg/TJ (setor Energia) porque a entrada é em GJ de
-- vapor comprado/eficiência do fervedor, não na unidade física do
-- combustível — daí as 2 colunas novas abaixo.
--
-- Também fecha um gap em Efluentes: a planilha usa VLOOKUP(tipo_efluente,
-- efu_tipo_de_eflu) como default de nitrogênio (kgN/m3) quando o usuário não
-- informa o teor de N, para 8 origens industriais conhecidas (Esgoto
-- doméstico e "Outros efluentes industriais" continuam exigindo teor de N
-- manual — a planilha não tem default pra eles).
-- ============================================================================

alter table ghg_fuel_factors add column ch4_kg_tj_energy numeric;
alter table ghg_fuel_factors add column n2o_kg_tj_energy numeric;

update ghg_fuel_factors set ch4_kg_tj_energy = null, n2o_kg_tj_energy = null where ref_no = 2;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 3;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 4;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 5;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 6;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 7;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 8;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 9;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 10;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 11;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 12;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 13;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 14;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 15;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 16;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 17;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 18;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 0.1 where ref_no = 19;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 0.1 where ref_no = 20;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 0.1 where ref_no = 21;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 0.1 where ref_no = 22;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 0.1 where ref_no = 23;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 0.1 where ref_no = 24;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 25;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 26;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 27;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 28;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 29;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 30;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 31;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 32;
update ghg_fuel_factors set ch4_kg_tj_energy = 30.0, n2o_kg_tj_energy = 4.0 where ref_no = 33;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 34;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 35;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 36;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 37;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 38;
update ghg_fuel_factors set ch4_kg_tj_energy = 30.0, n2o_kg_tj_energy = 4.0 where ref_no = 39;
update ghg_fuel_factors set ch4_kg_tj_energy = 30.0, n2o_kg_tj_energy = 4.0 where ref_no = 40;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 41;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 42;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 1.5 where ref_no = 43;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 49;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 50;
update ghg_fuel_factors set ch4_kg_tj_energy = 30.0, n2o_kg_tj_energy = 4.0 where ref_no = 51;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 52;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 0.1 where ref_no = 53;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 0.1 where ref_no = 54;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 0.1 where ref_no = 55;
update ghg_fuel_factors set ch4_kg_tj_energy = 1.0, n2o_kg_tj_energy = 0.1 where ref_no = 56;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 57;
update ghg_fuel_factors set ch4_kg_tj_energy = 200.0, n2o_kg_tj_energy = 4.0 where ref_no = 58;
update ghg_fuel_factors set ch4_kg_tj_energy = 30.0, n2o_kg_tj_energy = 4.0 where ref_no = 59;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 2.0 where ref_no = 60;
update ghg_fuel_factors set ch4_kg_tj_energy = 3.0, n2o_kg_tj_energy = 0.6 where ref_no = 61;
update ghg_fuel_factors set ch4_kg_tj_energy = 30.0, n2o_kg_tj_energy = 4.0 where ref_no = 62;
update ghg_fuel_factors set ch4_kg_tj_energy = 30.0, n2o_kg_tj_energy = 4.0 where ref_no = 63;

-- ----------------------------------------------------------------------------
-- ghg_effluent_nitrogen_defaults — default de N por origem industrial do
-- efluente (Listas!CA39:CB46, named range efu_tipo_de_eflu).
-- ----------------------------------------------------------------------------

create table ghg_effluent_nitrogen_defaults (
  id uuid primary key default gen_random_uuid(),
  effluent_type text not null unique,
  nitrogen_kg_m3 numeric not null,
  source text
);

alter table ghg_effluent_nitrogen_defaults enable row level security;
create policy ghg_effluent_nitrogen_defaults_read on ghg_effluent_nitrogen_defaults for select to authenticated using (true);

insert into ghg_effluent_nitrogen_defaults (effluent_type, nitrogen_kg_m3, source) values ('Efluentes do refino de álcool', 2.4, 'IPCC 2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_nitrogen_defaults (effluent_type, nitrogen_kg_m3, source) values ('Efluentes da produção de cerveja e malte', 0.055, 'IPCC 2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_nitrogen_defaults (effluent_type, nitrogen_kg_m3, source) values ('Efluentes da processamento de peixes', 0.6, 'IPCC 2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_nitrogen_defaults (effluent_type, nitrogen_kg_m3, source) values ('Efluentes da produção de ferro e aço', 0.25, 'IPCC 2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_nitrogen_defaults (effluent_type, nitrogen_kg_m3, source) values ('Efluentes de frigoríficos', 0.19, 'IPCC 2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_nitrogen_defaults (effluent_type, nitrogen_kg_m3, source) values ('Efluentes da produção de fertilizantes nitrogenados', 0.5, 'IPCC 2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_nitrogen_defaults (effluent_type, nitrogen_kg_m3, source) values ('Efluentes da produção de plásticos e resinas', 0.25, 'IPCC 2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_nitrogen_defaults (effluent_type, nitrogen_kg_m3, source) values ('Efluentes da produção de amido', 0.9, 'IPCC 2019 via GHG Protocol FGV v2026.0.1');

-- ----------------------------------------------------------------------------
-- Amplia o check de source_category para as 3 fontes novas de Escopo 2.
-- ----------------------------------------------------------------------------

alter table ghg_activity_entries drop constraint ghg_activity_entries_source_category_check;

alter table ghg_activity_entries add constraint ghg_activity_entries_source_category_check
  check (source_category in (
    -- Escopo 1
    'stationary_combustion', 'mobile_combustion', 'fugitive',
    'industrial_processes', 'agriculture', 'land_use', 'solid_waste', 'effluents',
    -- Escopo 2 — 5/5 abordagens
    'electricity_location', 'electricity_market',
    'td_losses_location', 'td_losses_market', 'thermal_energy_purchased',
    -- Escopo 3 — as 15 categorias, na ordem oficial
    'purchased_goods', 'capital_goods', 'fuel_energy_upstream',
    'transport_distribution_upstream', 'waste_generated_operations',
    'business_travel', 'commuting', 'leased_assets_upstream',
    'transport_distribution_downstream', 'processing_sold_products',
    'use_sold_products', 'end_of_life_sold_products',
    'leased_assets_downstream', 'franchises', 'investments'
  ));

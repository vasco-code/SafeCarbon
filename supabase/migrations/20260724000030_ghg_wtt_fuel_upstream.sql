-- ============================================================================
-- Calculadora de Pegada de Carbono — Fase 2 (parte 2): Escopo 3 Categoria 3
-- (Atividades relacionadas a combustível e energia), Tabela 1 da aba
-- "Emissões energia (upstream)" — WTT/cradle-to-gate do combustível já
-- lançado em Combustão estacionária/móvel (Escopo 1), mesma quantidade em
-- GJ, fator diferente (extrair/produzir/transportar o combustível, não
-- queimá-lo). Tabelas 2-5 dessa aba (WTT de eletricidade/energia térmica
-- comprada, perdas T&D) ficam para uma fase seguinte.
--
-- Nova tabela de fator, leitura pública a authenticated — mesmo padrão das
-- outras 4 tabelas de fator da Fase 1 (só policy de select, sem policy de
-- escrita — default deny, gestão via seed/migração).
-- ============================================================================

create table ghg_wtt_fuel_factors (
  id uuid primary key default gen_random_uuid(),
  name_pt text not null,
  co2_kg_gj numeric not null default 0,
  ch4_kg_gj numeric not null default 0,
  n2o_kg_gj numeric not null default 0,
  source text
);

alter table ghg_wtt_fuel_factors enable row level security;
create policy ghg_wtt_fuel_factors_read on ghg_wtt_fuel_factors for select to authenticated using (true);

-- Amplia o check de source_category (já alargado uma vez em 20260724000029)
-- para incluir fuel_energy_upstream, e de novo já contempla nomeações
-- prováveis das próximas categorias de Escopo 3 (bens comprados/de capital,
-- transporte upstream/downstream, resíduos da operação) — mesmo racional da
-- migration anterior: evitar repetir esse mesmo bug a cada fonte nova.
alter table ghg_activity_entries drop constraint ghg_activity_entries_source_category_check;

alter table ghg_activity_entries add constraint ghg_activity_entries_source_category_check
  check (source_category in (
    'stationary_combustion', 'mobile_combustion', 'electricity_location',
    'electricity_market', 'business_travel', 'commuting',
    'industrial_processes', 'agriculture',
    'fugitive', 'land_use', 'solid_waste', 'effluents',
    'fuel_energy_upstream', 'purchased_goods', 'capital_goods',
    'transport_distribution_upstream', 'transport_distribution_downstream',
    'waste_generated_operations'
  ));

-- ============================================================================
-- SEED — fatores WTT extraídos por scripts/extract_ghg_factors.py --wtt
-- ============================================================================

delete from ghg_wtt_fuel_factors;

insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Biodiesel (B100)', 17.083400000000005, 0.0322368, 0.017523888, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Bagaço de cana', 1.1037, 0.0013446, 4.3729e-06, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Biometano - decomposição de esterco líquido', 8.84586111111111, 0.000749999999999732, 0.00013888888888888892, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Biometano - decomposição de resíduos orgânicos municipais', 9.451444444444444, 0.0005, 0.00013888888888888892, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Biometano (liquefeito) - decomposição de esterco líquido', 13.093833333333333, 0.0008055555555556521, 0.00013888888888888892, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Biometano (liquefeito) - decomposição de resíduos orgânicos municipais', 13.699583333333333, 0.000555555555555556, 0.00013888888888888892, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Biometanol', 12.267, 0.019095, 0.0052927, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Biopropano (coproduto HVO soja)', 15.906999999999998, 0.041918, 0.022147, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Bioquerosene (SAF) - rota ATJ (etanol de cana, BR)', 25.291, 0.1785, 0.048049, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Bioquerosene (SAF) - rota Fischer-Tropsch (Resíduo florestal)', 4.133500000000001, 0.0053102, 0.00018463000000000003, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Bioquerosene (SAF) - rota HEFA (óleo de palma)', 19.421, 0.15002, 0.041248, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Bioquerosene (SAF) - rota HEFA (óleo de soja)', 28.362000000000002, 0.042364, 0.022153, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Carvão mineral', 1.5164, 0.14007, 3.0857e-05, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Coque de carvão', 9.3053, 0.12384999999999999, 0.00013408, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Coque de petróleo', 9.682400000000001, 0.097985, 0.00017254, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Etanol de cana de açúcar BR', 10.187, 0.1338, 0.042635, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Gás liquefeito de petróleo (GLP)', 13.589132306125377, 0.04241762753562882, 0.00023393207653341503, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Gás natural', 7.580972222222222, 0.15227777777777798, 0.00013888888888888892, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Gás natural liquefeito (GNL)', 14.007916666666667, 0.1333333333333332, 0.00025, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Gasolina automotiva (pura)', 17.50261517241379, 0.057557267530117015, 0.0002631533793103448, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Metanol', 21.21841666666667, 0.1241111111111112, 2.7777777777777786e-05, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Nafta', 11.516, 0.10042, 0.00021423, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Óleo combustível', 10.591000000000001, 0.099065, 0.00018123, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Óleo diesel (puro)', 13.07389952718676, 0.000218320269698818, 0.00025378264775413714, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Óleo diesel verde - HEFA (óleo de soja)', 25.285, 0.042365, 0.022153, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');
insert into ghg_wtt_fuel_factors (name_pt, co2_kg_gj, ch4_kg_gj, n2o_kg_gj, source) values ('Querosene de aviação', 8.2355, 0.09464399999999999, 0.00014584, 'JEC/Ecoinvent via GHG Protocol FGV v2026.0.1');

-- ============================================================================
-- Calculadora de Pegada — Escopo 3 completo: as 15 categorias do GHG Protocol.
--
-- A aba "Categorias de Escopo 3" da planilha usa, para as categorias sem
-- cálculo próprio, o modelo de ENTRADA DIRETA POR GÁS: o usuário relata a massa
-- de cada GEE (CO2, CH4, N2O, HFCs, PFCs, SF6, NF3) e o CO2e sai pelo GWP, com
-- CO2 biogênico emitido/removido reportado à parte. É exatamente o mesmo modelo
-- que Processos industriais e Agricultura já usam (calcDirectGasEmission), então
-- as 12 categorias restantes entram SEM nova tabela de fator — só ampliando o
-- check de source_category para as 7 que ainda faltavam.
--
-- Cat. 3 (combustível/energia), 6 (viagens) e 7 (casa-trabalho) mantêm o
-- cálculo próprio por fator de atividade, mais preciso.
-- ============================================================================

alter table ghg_activity_entries drop constraint ghg_activity_entries_source_category_check;

alter table ghg_activity_entries add constraint ghg_activity_entries_source_category_check
  check (source_category in (
    -- Escopo 1
    'stationary_combustion', 'mobile_combustion', 'fugitive',
    'industrial_processes', 'agriculture', 'land_use', 'solid_waste', 'effluents',
    -- Escopo 2
    'electricity_location', 'electricity_market',
    -- Escopo 3 — as 15 categorias, na ordem oficial
    'purchased_goods', 'capital_goods', 'fuel_energy_upstream',
    'transport_distribution_upstream', 'waste_generated_operations',
    'business_travel', 'commuting', 'leased_assets_upstream',
    'transport_distribution_downstream', 'processing_sold_products',
    'use_sold_products', 'end_of_life_sold_products',
    'leased_assets_downstream', 'franchises', 'investments'
  ));

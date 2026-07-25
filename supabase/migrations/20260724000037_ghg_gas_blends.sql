-- ============================================================================
-- Calculadora de Pegada — refinamento: COMPOSTOS (blends) nas emissões
-- fugitivas. A maioria dos equipamentos de refrigeração/ar-condicionado usa
-- mistura (R-410A, R-404A, R-407C...), não gás puro — até aqui a fonte
-- `fugitive` só aceitava os gases puros de ghg_gwp.
--
-- Cada blend se decompõe em até 5 gases componentes com sua fração mássica
-- (tabela auxiliar B328:Q453 da aba "Emissões fugitivas"). A massa líquida do
-- blend é rateada entre os componentes e cada parcela converte pelo GWP do seu
-- próprio gás — que é exatamente o que a planilha faz nas colunas M..AA.
--
-- Blends cuja composição não tem nenhum gás de Kyoto (só HCFC, fora do
-- inventário) não entram: 22 dos 126 da planilha.
-- ============================================================================

create table ghg_gas_blends (
  id uuid primary key default gen_random_uuid(),
  blend text not null,
  gas text not null,
  fraction numeric not null check (fraction > 0 and fraction <= 1),
  source text,
  unique (blend, gas)
);

alter table ghg_gas_blends enable row level security;
create policy ghg_gas_blends_read on ghg_gas_blends for select to authenticated using (true);

-- ============================================================================
-- SEED — 104 compostos, extraídos por scripts/extract_ghg_factors.py --blends
-- ============================================================================

delete from ghg_gas_blends;

insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-401A', 'HFC-152a', 0.13, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-401B', 'HFC-152a', 0.11, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-401C', 'HFC-152a', 0.15, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-402A', 'HFC-125', 0.6, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-402B', 'HFC-125', 0.38, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-403A', 'PFC-218', 0.2, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-403B', 'PFC-218', 0.39, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-404A', 'HFC-125', 0.44, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-404A', 'HFC-143a', 0.52, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-404A', 'HFC-134a', 0.04, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-405A', 'HFC-152a', 0.07, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-405A', 'PFC-318', 0.425, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407A', 'HFC-32', 0.2, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407A', 'HFC-125', 0.4, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407A', 'HFC-134a', 0.4, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407B', 'HFC-32', 0.1, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407B', 'HFC-125', 0.7, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407B', 'HFC-134a', 0.2, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407C', 'HFC-32', 0.23, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407C', 'HFC-125', 0.25, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407C', 'HFC-134a', 0.52, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407D', 'HFC-32', 0.15, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407D', 'HFC-125', 0.15, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407D', 'HFC-134a', 0.7, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407E', 'HFC-32', 0.25, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407E', 'HFC-125', 0.15, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407E', 'HFC-134a', 0.6, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407F', 'HFC-32', 0.3, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407F', 'HFC-125', 0.3, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407F', 'HFC-134a', 0.4, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407G', 'HFC-32', 0.025, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407G', 'HFC-125', 0.025, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407G', 'HFC-134a', 0.95, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407H', 'HFC-32', 0.325, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407H', 'HFC-125', 0.15, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407H', 'HFC-134a', 0.525, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407I', 'HFC-32', 0.195, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407I', 'HFC-125', 0.085, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-407I', 'HFC-134a', 0.72, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-408A', 'HFC-125', 0.07, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-408A', 'HFC-143a', 0.46, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-410A', 'HFC-32', 0.5, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-410A', 'HFC-125', 0.5, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-410B', 'HFC-32', 0.45, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-410B', 'HFC-125', 0.55, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-411A', 'HFC-152a', 0.11, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-411B', 'HFC-152a', 0.03, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-412A', 'PFC-218', 0.05, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-413A', 'HFC-134a', 0.88, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-413A', 'PFC-218', 0.09, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-415A', 'HFC-152a', 0.18, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-415B', 'HFC-152a', 0.75, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-416A', 'HFC-134a', 0.59, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-417A', 'HFC-125', 0.466, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-417A', 'HFC-134a', 0.5, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-417B', 'HFC-125', 0.79, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-417B', 'HFC-134a', 0.183, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-417C', 'HFC-125', 0.195, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-417C', 'HFC-134a', 0.788, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-418A', 'HFC-152a', 0.025, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-419A', 'HFC-125', 0.77, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-419A', 'HFC-134a', 0.19, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-419B', 'HFC-125', 0.485, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-419B', 'HFC-134a', 0.48, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-420A', 'HFC-134a', 0.88, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-421A', 'HFC-125', 0.58, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-421A', 'HFC-134a', 0.42, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-421B', 'HFC-125', 0.85, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-421B', 'HFC-134a', 0.15, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-422A', 'HFC-125', 0.851, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-422A', 'HFC-134a', 0.115, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-422B', 'HFC-125', 0.55, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-422B', 'HFC-134a', 0.42, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-422C', 'HFC-125', 0.82, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-422C', 'HFC-134a', 0.15, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-422D', 'HFC-125', 0.65, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-422D', 'HFC-134a', 0.315, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-422E', 'HFC-125', 0.58, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-422E', 'HFC-134a', 0.393, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-423A', 'HFC-134a', 0.525, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-423A', 'HFC-227ea', 0.475, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-424A', 'HFC-125', 0.505, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-424A', 'HFC-134a', 0.47, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-425A', 'HFC-32', 0.185, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-425A', 'HFC-134a', 0.695, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-425A', 'HFC-227ea', 0.12, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-426A', 'HFC-125', 0.051, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-426A', 'HFC-134a', 0.93, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-427A', 'HFC-32', 0.15, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-427A', 'HFC-125', 0.25, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-427A', 'HFC-134a', 0.5, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-427A', 'HFC-143a', 0.1, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-428A', 'HFC-125', 0.775, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-428A', 'HFC-143a', 0.2, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-429A', 'HFC-152a', 0.1, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-430A', 'HFC-152a', 0.76, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-431A', 'HFC-152a', 0.29, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-434A', 'HFC-125', 0.632, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-434A', 'HFC-134a', 0.16, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-434A', 'HFC-143a', 0.18, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-435A', 'HFC-152a', 0.2, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-437A', 'HFC-125', 0.195, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-437A', 'HFC-134a', 0.785, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-438A', 'HFC-32', 0.085, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-438A', 'HFC-125', 0.45, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-438A', 'HFC-134a', 0.442, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-439A', 'HFC-32', 0.5, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-439A', 'HFC-125', 0.47, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-440A', 'HFC-152a', 0.978, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-440A', 'HFC-134a', 0.016, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-442A', 'HFC-32', 0.31, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-442A', 'HFC-125', 0.31, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-442A', 'HFC-134a', 0.3, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-442A', 'HFC-152a', 0.03, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-442A', 'HFC-227ea', 0.05, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-444A', 'HFC-32', 0.12, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-444A', 'HFC-152a', 0.05, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-444B', 'HFC-32', 0.415, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-444B', 'HFC-152a', 0.1, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-445A', 'HFC-134a', 0.09, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-446A', 'HFC-32', 0.68, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-447A', 'HFC-32', 0.68, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-447A', 'HFC-125', 0.035, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-447B', 'HFC-32', 0.68, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-447B', 'HFC-125', 0.08, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-448A', 'HFC-32', 0.26, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-448A', 'HFC-125', 0.26, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-448A', 'HFC-134a', 0.21, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-449A', 'HFC-32', 0.243, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-449A', 'HFC-125', 0.247, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-449A', 'HFC-134a', 0.257, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-449B', 'HFC-32', 0.252, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-449B', 'HFC-125', 0.243, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-449B', 'HFC-134a', 0.273, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-449C', 'HFC-32', 0.2, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-449C', 'HFC-125', 0.2, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-449C', 'HFC-134a', 0.29, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-450A', 'HFC-134a', 0.42, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-451A', 'HFC-134a', 0.102, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-451B', 'HFC-134a', 0.11199999999999999, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-452A', 'HFC-32', 0.11, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-452A', 'HFC-125', 0.59, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-452B', 'HFC-32', 0.67, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-452B', 'HFC-125', 0.07, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-452C', 'HFC-32', 0.125, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-452C', 'HFC-125', 0.61, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-453A', 'HFC-32', 0.2, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-453A', 'HFC-125', 0.2, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-453A', 'HFC-134a', 0.5379999999999999, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-453A', 'HFC-227ea', 0.05, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-454A', 'HFC-32', 0.35, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-454B', 'HFC-32', 0.6890000000000001, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-454C', 'HFC-32', 0.215, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-455A', 'HFC-32', 0.215, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-456A', 'HFC-32', 0.06, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-456A', 'HFC-134a', 0.45, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-457A', 'HFC-32', 0.18, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-457A', 'HFC-152a', 0.12, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-458A', 'HFC-32', 0.205, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-458A', 'HFC-125', 0.04, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-458A', 'HFC-134a', 0.614, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-458A', 'HFC-227ea', 0.135, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-458A', 'HFC-236fa', 0.006, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-459A', 'HFC-32', 0.68, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-459B', 'HFC-32', 0.21, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-460A', 'HFC-32', 0.12, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-460A', 'HFC-125', 0.52, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-460A', 'HFC-134a', 0.14, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-460B', 'HFC-32', 0.28, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-460B', 'HFC-125', 0.25, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-460B', 'HFC-134a', 0.2, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-460C', 'HFC-32', 0.025, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-460C', 'HFC-125', 0.025, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-460C', 'HFC-134a', 0.46, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-461A', 'HFC-125', 0.55, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-461A', 'HFC-143a', 0.05, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-461A', 'HFC-134a', 0.32, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-461A', 'HFC-227ea', 0.05, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-462A', 'HFC-32', 0.09, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-462A', 'HFC-125', 0.42, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-462A', 'HFC-143a', 0.02, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-462A', 'HFC-134a', 0.44, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-463A', 'HFC-32', 0.36, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-463A', 'HFC-125', 0.3, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-463A', 'HFC-134a', 0.14, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-464A', 'HFC-32', 0.27, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-464A', 'HFC-125', 0.27, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-464A', 'HFC-227ea', 0.06, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-465A', 'HFC-32', 0.21, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-500', 'HFC-152a', 0.262, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-503', 'HFC-23', 0.401, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-504', 'HFC-32', 0.482, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-507 ou R-507A', 'HFC-125', 0.5, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-507 ou R-507A', 'HFC-143a', 0.5, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-508A', 'HFC-23', 0.39, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-508A', 'PFC-116', 0.61, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-508B', 'HFC-23', 0.46, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-508B', 'PFC-116', 0.54, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-509 ou R-509A', 'PFC-218', 0.56, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-512A', 'HFC-134a', 0.05, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-512A', 'HFC-152a', 0.95, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-513A', 'HFC-134a', 0.44, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-513B', 'HFC-134a', 0.415, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-515A', 'HFC-227ea', 0.12, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-516A', 'HFC-134a', 0.085, 'GHG Protocol FGV v2026.0.1');
insert into ghg_gas_blends (blend, gas, fraction, source) values ('R-516A', 'HFC-152a', 0.14, 'GHG Protocol FGV v2026.0.1');

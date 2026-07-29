-- ============================================================================
-- Fecha Emissões casa-trabalho (Escopo 3 Cat. 7): as 3 abordagens que
-- faltavam da aba "Emissões casa-trabalho" (Tabelas 1-6, confirmado por
-- inspeção direta da planilha via openpyxl — a memória anterior citava
-- "home office" como pendência, mas essa modalidade não existe na planilha).
--
-- Tabela 3 (balsas) segue o mesmo modelo flat kg/passageiro.km das Tabelas 1-2
-- (metrô/ônibus, já implementadas) — só precisa de seed, zero código novo.
-- Fatores de "Fatores de Emissão"!C404:H406 (named range tabela_balsas,
-- colunas F/G/H = CO2/CH4/N2O kg/passageiro.km; a linha "Exemplo" da aba
-- Emissões casa-trabalho usa valores hardcoded desatualizados — a fórmula
-- viva (VLOOKUP em tabela_balsas) é a fonte de verdade, mesmo padrão do
-- achado de Agricultura/GWP já documentado).
--
-- Tabelas 4-6 (veículo particular do colaborador, por frota/consumo/
-- distância) viraram o método "private_vehicle" de `commuting` no app —
-- reusa ghg_fuel_factors + ghg_fleet_factors (as mesmas tabelas de
-- Combustão móvel), sem tabela nova. Simplificação deliberada: a planilha
-- deriva o consumo mensal com blend etanol/biodiesel variável por mês
-- (perc_etanol_jan..dez); o app pede o litro/m³/kg total do ano direto —
-- mesma simplificação que Combustão móvel já usa, e o blend já está
-- embutido nas variantes "comercial" de ghg_fuel_factors.
-- ============================================================================

insert into ghg_generic_factors (source_category, factor_key, description, unit, co2_kg, ch4_kg, n2o_kg, co2e_kg, biogenic_co2_kg, source) values
  ('commuting', 'ferry_passenger', 'Balsa de passageiros (por passageiro.km)', 'kg/p.km', 0.019149005801607475, 1.3443341456508557e-06, 7.238722322735377e-07, null, 0, 'GHG Protocol FGV v2026.0.1 (Tabela 18, Fatores de Emissão)'),
  ('commuting', 'ferry_vehicle', 'Balsa de veículos (por passageiro.km)', 'kg/p.km', 0.13235765110880796, 9.292018168837605e-06, 5.003394398604864e-06, null, 0, 'GHG Protocol FGV v2026.0.1 (Tabela 18, Fatores de Emissão)'),
  ('commuting', 'ferry_hybrid', 'Balsa híbrida veículos e passageiros (por passageiro.km)', 'kg/p.km', 0.11533737697443305, 8.097129205711514e-06, 4.359992649229277e-06, null, 0, 'GHG Protocol FGV v2026.0.1 (Tabela 18, Fatores de Emissão)');

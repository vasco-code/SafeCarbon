-- ============================================================================
-- Calculadora de Pegada — refinamento: novos modais de casa-trabalho (Escopo 3
-- Cat. 7). A fonte `commuting` já lê todos os fatores de ghg_generic_factors e
-- monta o seletor de modal na UI — então basta seedar novas linhas, sem
-- mudança de código.
--
-- Fatores por passageiro.km da aba "Emissões casa-trabalho" (via tabelas em
-- "Fatores de Emissão"): ônibus (tabela_onibus, diesel/biodiesel) e metrô/trem
-- urbano (tabela_metro, elétrico → só CO2). Como o modelo atual é de fator
-- único por modal (sem dimensão de ano), usamos o valor mais recente (2025),
-- mesma convenção do modal de ônibus-diesel já existente. Balsa e rodoviário
-- privado (fuel-based) não entram aqui — exigem outro modelo.
-- ============================================================================

delete from ghg_generic_factors where source_category = 'commuting' and factor_key in ('bus_municipal_biodiesel', 'metro_train_electric');

insert into ghg_generic_factors (source_category, factor_key, description, unit, co2_kg, ch4_kg, n2o_kg, co2e_kg, biogenic_co2_kg, source) values
  ('commuting', 'bus_municipal_biodiesel', 'Ônibus municipal a biodiesel (por passageiro.km)', 'kg/p.km', 0.097622499566592, 4.926547748571429e-07, 5.361571210143396e-06, null, 0, 'GHG Protocol FGV v2026.0.1 (FE 2025)'),
  ('commuting', 'metro_train_electric', 'Metrô / trem urbano — elétrico (por passageiro.km)', 'kg/p.km', 0.002974, 0, 0, null, 0, 'GHG Protocol FGV v2026.0.1 (FE 2025)');

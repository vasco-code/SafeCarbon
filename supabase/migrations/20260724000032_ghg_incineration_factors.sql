-- ============================================================================
-- Calculadora de Pegada de Carbono — Escopo 1: Resíduos sólidos (Fase A).
-- Cobre compostagem, incineração e relato direto (aba "Resíduos sólidos").
-- O aterro (modelo FOD/First Order Decay, série de 30 anos) fica para a Fase B.
--
-- Esta tabela guarda os parâmetros de composição por categoria de resíduo
-- incinerado (umidade, teor de carbono na massa seca, fração de carbono
-- fóssil), usados no cálculo do CO2 fóssil e biogênico da incineração:
--   CO2_categoria (t) = 44/12 × frac_composição × massa × (1 − umidade)
--                       × teor_carbono × fração_fóssil
-- (o CO2 biogênico usa (1 − fração_fóssil) no lugar). Defaults IPCC — o usuário
-- só informa massa total e a % de cada categoria.
--
-- Compostagem (defaults 4 gCH4/kg, 0,24 gN2O/kg) e o FE de processo da
-- incineração (N2O 100 g/t) são constantes do motor, não desta tabela.
-- O check de source_category já inclui 'solid_waste' desde a migration 29.
-- ============================================================================

create table ghg_incineration_factors (
  id uuid primary key default gen_random_uuid(),
  position integer not null,
  category text not null,
  moisture numeric not null default 0,
  carbon_content numeric not null default 0,
  fossil_fraction numeric not null default 0,
  source text
);

alter table ghg_incineration_factors enable row level security;
create policy ghg_incineration_factors_read on ghg_incineration_factors for select to authenticated using (true);

-- ============================================================================
-- SEED — parâmetros de composição do resíduo incinerado (12 categorias),
-- extraídos por scripts/extract_ghg_factors.py --incineration
-- ============================================================================

delete from ghg_incineration_factors;

insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (1, 'A - Papéis/papelão', 0.1, 0.46, 0.01, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (2, 'B - Resíduos têxteis', 0.2, 0.5, 0.2, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (3, 'C - Resíduos alimentares', 0.6, 0.38, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (4, 'D - Madeira', 0.15, 0.5, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (5, 'E - Resíduos de jardim e parque', 0.6, 0.49, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (6, 'F - Fraldas', 0.6, 0.7, 0.1, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (7, 'G - Borracha e couro', 0.16, 0.67, 0.2, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (8, 'H - Lodo de esgoto', 0.9, 0.31, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (9, 'I - Plásticos', 0.0, 0.75, 1.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (10, 'J - Resíduos de serviços de saúde ¹', 0.35, 0.6, 0.4, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (11, 'K - Resíduos fósseis líquidos ²', 0, 0.8, 1.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_incineration_factors (position, category, moisture, carbon_content, fossil_fraction, source) values (12, 'Outros, resíduos inertes ³', 0.1, 0.03, 1.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');

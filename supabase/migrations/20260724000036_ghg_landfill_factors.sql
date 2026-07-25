-- ============================================================================
-- Calculadora de Pegada — Resíduos sólidos Fase B: ATERRO pelo modelo FOD
-- (First Order Decay), aba "Resíduos sólidos", Passos 1-5.
--
-- Diferente das demais fontes, o aterro NÃO é um cálculo de ano único: o
-- resíduo depositado continua gerando CH4 por décadas, então a emissão do ano
-- inventariado depende da série histórica de deposição. O motor roda a
-- recursão do IPCC por categoria de resíduo (cada uma com seu k):
--   DDOCmd_T   = W_T × fração × DOC × DOCf × MCF_T
--   DDOCma_T   = DDOCmd_T + DDOCma_{T-1} × e^(-k)
--   DDOCdec_T  = DDOCma_{T-1} × (1 − e^(-k))
--   CH4_ger_T  = Σ_categorias DDOCdec_T × F × 16/12         (F = 0,5)
--   CH4_emit_T = (CH4_ger_T − CH4_recuperado_T) × (1 − OX)
-- CO2 biogênico = CH4_recuperado × 44/16 quando o biogás é queimado em flare.
--
-- Esta tabela guarda os parâmetros por categoria de resíduo aterrado: DOC
-- (carbono orgânico degradável, base úmida), DOCf (fração que de fato
-- decompõe) e k (constante de decaimento). MCF por qualidade do aterro (A-H) e
-- OX (0,1 quando MCF ≥ 0,8) são constantes do motor, por serem um lookup
-- pequeno e acoplado aos rótulos da UI.
-- ============================================================================

create table ghg_landfill_factors (
  id uuid primary key default gen_random_uuid(),
  position integer not null,
  category text not null unique,
  doc numeric not null default 0,
  docf numeric not null default 0,
  k numeric not null default 0,
  source text
);

alter table ghg_landfill_factors enable row level security;
create policy ghg_landfill_factors_read on ghg_landfill_factors for select to authenticated using (true);

-- ============================================================================
-- SEED — 9 categorias, extraídas por scripts/extract_ghg_factors.py --landfill
-- ============================================================================

delete from ghg_landfill_factors;

insert into ghg_landfill_factors (position, category, doc, docf, k, source) values (1, 'A - Papéis/papelão', 0.4, 0.5, 0.07, 'IPCC 2006/2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_landfill_factors (position, category, doc, docf, k, source) values (2, 'B - Resíduos têxteis', 0.24, 0.5, 0.07, 'IPCC 2006/2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_landfill_factors (position, category, doc, docf, k, source) values (3, 'C - Resíduos alimentares', 0.15, 0.7, 0.4, 'IPCC 2006/2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_landfill_factors (position, category, doc, docf, k, source) values (4, 'D - Madeira', 0.43, 0.1, 0.035, 'IPCC 2006/2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_landfill_factors (position, category, doc, docf, k, source) values (5, 'E - Resíduos de jardim e parque', 0.2, 0.7, 0.17, 'IPCC 2006/2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_landfill_factors (position, category, doc, docf, k, source) values (6, 'F - Fraldas', 0.24, 0.5, 0.17, 'IPCC 2006/2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_landfill_factors (position, category, doc, docf, k, source) values (7, 'G - Borracha e couro', 0.39, 0.5, 0.17, 'IPCC 2006/2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_landfill_factors (position, category, doc, docf, k, source) values (8, 'H - Lodo de esgoto doméstico', 0.05, 0.7, 0.4, 'IPCC 2006/2019 via GHG Protocol FGV v2026.0.1');
insert into ghg_landfill_factors (position, category, doc, docf, k, source) values (9, 'I - Lodo industrial', 0.09, 0.7, 0.4, 'IPCC 2006/2019 via GHG Protocol FGV v2026.0.1');

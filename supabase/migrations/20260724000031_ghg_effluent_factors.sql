-- ============================================================================
-- Calculadora de Pegada de Carbono — Escopo 1: Efluentes (aba "Efluentes").
-- Tratamento e disposição final de efluentes líquidos. Metodologia IPCC:
--   CH4 (t) = Q (m³) × (carga_org − carga_removida) (kgDBO ou kgDQO/m³)
--             × EF_CH4 (kgCH4/kgDBO|DQO) / 1000 − CH4_recuperado
--   N2O (t) = Q × N (kgN/m³) × EF_N2O / 1000, EF_N2O = (44/28) × (kgN2O-N/kgN)
-- Os fatores por tipo de tratamento (MCF/EF_DBO/EF_DQO/EF_N2O-N) vêm da aba
-- "Listas" (eflu_tipo_tratamento_MCF_domestico/_industrial). Tabela nova de
-- fator, leitura pública a authenticated — mesmo padrão das demais tabelas de
-- fator (só policy de select; gestão via seed/migração).
--
-- Fase A: tratamento único (Passos 3-6) + método direto. Tratamento sequencial
-- (Passos 7-10) e disposição final separada (Passos 11-12) ficam para depois.
-- O check de source_category já inclui 'effluents' desde a migration 29 —
-- por isso esta migration NÃO mexe no constraint.
-- ============================================================================

create table ghg_effluent_factors (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('domestic', 'industrial')),
  treatment_type text not null,
  mcf numeric not null default 0,
  ef_ch4_kg_dbo numeric not null default 0,
  ef_ch4_kg_dqo numeric not null default 0,
  ef_n2o_n_kg_n numeric not null default 0,
  source text
);

alter table ghg_effluent_factors enable row level security;
create policy ghg_effluent_factors_read on ghg_effluent_factors for select to authenticated using (true);

-- ============================================================================
-- SEED — fatores de tratamento de efluentes (12 domésticos + 9 industriais)
-- extraídos por scripts/extract_ghg_factors.py --effluent
-- ============================================================================

delete from ghg_effluent_factors;

insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Tratamento aeróbio (lodo ativado, lagoa aerada, etc)', 0.03, 0.018, 0.0075, 0.016, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Fossa séptica', 0.5, 0.3, 0.125, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Reator anaeróbio', 0.8, 0.48, 0.2, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Lagoa anaeróbia profunda (profundidade > 2 metros)', 0.8, 0.48, 0.2, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Lagoa anaeróbia rasa (profundidade < 2 metros)', 0.2, 0.12, 0.05, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Lagoa facultativa (profundidade < 2 metros)', 0.2, 0.12, 0.05, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Lagoa de maturação (profundidade < 2 metros)', 0.2, 0.12, 0.05, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Fossas secas', 0.1, 0.06, 0.025, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Lançamento em corpos d''água (não especificado)', 0.11, 0.066, 0.0275, 0.005, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Lançamento em corpos d''água (que não reservatórios, lagos e estuários)', 0.035, 0.021, 0.00875, 0.005, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Lançamento em reservatórios, lagos e estuários', 0.19, 0.11399999999999999, 0.0475, 0.005, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('domestic', 'Efluente parado a céu aberto', 0.5, 0.3, 0.125, 0.005, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('industrial', 'Tratamento aeróbio (lodo ativado, lagoa aerada, etc)', 0.0, 0.0, 0.0, 0.016, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('industrial', 'Reator anaeróbio', 0.8, 0.48, 0.2, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('industrial', 'Lagoa anaeróbia profunda (profundidade > 2 metros)', 0.8, 0.48, 0.2, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('industrial', 'Lagoa anaeróbia rasa (profundidade < 2 metros)', 0.2, 0.12, 0.05, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('industrial', 'Lagoa facultativa (profundidade < 2 metros)', 0.2, 0.12, 0.05, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('industrial', 'Lagoa de maturação (profundidade < 2 metros)', 0.2, 0.12, 0.05, 0.0, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('industrial', 'Lançamento em corpos d''água (não especificado)', 0.11, 0.066, 0.0275, 0.005, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('industrial', 'Lançamento em corpos d''água (que não reservatórios, lagos e estuários)', 0.035, 0.021, 0.00875, 0.005, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');
insert into ghg_effluent_factors (domain, treatment_type, mcf, ef_ch4_kg_dbo, ef_ch4_kg_dqo, ef_n2o_n_kg_n, source) values ('industrial', 'Lançamento em reservatórios, lagos e estuários', 0.19, 0.11399999999999999, 0.0475, 0.005, 'IPCC 2006 via GHG Protocol FGV v2026.0.1');

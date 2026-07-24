-- ============================================================================
-- Calculadora de Pegada de Carbono — Fase 2 (parte 1): Processos industriais
-- e Atividades de agricultura. Mesmo modelo genérico da Fase 1 (activity_data/
-- computed em JSONB) — sem tabela de fator nova, usam só ghg_gwp (o usuário
-- relata a massa do gás direto; a única conversão é por GWP).
--
-- Bug real encontrado testando no browser: a migration 20260723000028 criou
-- ghg_activity_entries com um `check` que travava source_category só nos 6
-- valores da Fase 1 — a promessa da arquitetura ("fonte nova = só um valor
-- novo, sem migração") só vale pro registry/UI, o check do banco precisa
-- acompanhar. Alarga aqui já contemplando as 4 fontes restantes do Escopo 1
-- (fugitivas, mudança do uso do solo, resíduos sólidos, efluentes) — cada uma
-- ainda vai precisar de tabela de fator própria (metodologias multi-etapa),
-- mas o check não vai mais bloquear quando chegar a vez delas.
-- ============================================================================

alter table ghg_activity_entries drop constraint ghg_activity_entries_source_category_check;

alter table ghg_activity_entries add constraint ghg_activity_entries_source_category_check
  check (source_category in (
    'stationary_combustion', 'mobile_combustion', 'electricity_location',
    'electricity_market', 'business_travel', 'commuting',
    'industrial_processes', 'agriculture',
    'fugitive', 'land_use', 'solid_waste', 'effluents'
  ));

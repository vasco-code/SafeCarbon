-- ============================================================================
-- Correções do vintage 2025 do Premix - Fator P — parte 2/3: dados.
-- Origem: carta da E2Carbon de 16/11/2026 (itens 1, 2, 5, 7 e 8) e Relatório
-- de Verificação RK-VER-2026-001 v02 (Rekompense, 30/09/2026). Rodar DEPOIS
-- da 20261116000057 (usa 'cancelled' e 'safe_trace_proprio', criados lá).
-- O recálculo do ciclo (motor PMX-EM v2.0) é feito depois, pela tela, e a
-- aprovação do lote pela 20261116000059.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Item 1 — cancelar os dois tokens da asserção v1.0 e bloquear nova emissão
-- ----------------------------------------------------------------------------
update blockchain_tokens
set status = 'cancelled',
    cancelled_at = now(),
    cancelled_reason = 'Vintage 2025 retificado: a quantidade registrada (83.231,05 tCO2e) corresponde à asserção da v1.0, retirada. Quantidade verificada: 11.835,9 tCO2e (Relatório RK-VER-2026-001 v02, Seções 16 e 18).'
where id in ('b939ffed-0afe-4167-a0d1-1531b8d8becd', 'c98a3704-20c8-489c-8cc3-b6d97269f68c')
  and status::text = 'active';

update credit_calculation_cycles
set issuance_hold = true,
    issuance_hold_reason = 'Emissão do vintage 2025 retida até a publicação das regras da registradora (Relatório RK-VER-2026-001 v02, Seção 16.2) e demais condições de emissão. Limite: 11.835 unidades inteiras.'
where id = '33c7c6e9-120c-43be-82bc-00f55b3c02b7';

-- Divisão contratual (DCP §1.2, Quadro 2): 95% Premix / 5% E2Carbon.
update carbon_projects
set credit_split = jsonb_build_object(
      '00000000-0000-0000-0000-000000000003', 95,
      '00000000-0000-0000-0000-000000000002', 5)
where id = '00000000-0000-0000-0000-0000000000a1';

-- ----------------------------------------------------------------------------
-- Item 2 — parecer do ciclo de verificação 2025
-- ----------------------------------------------------------------------------
update verification_cycles
set findings = jsonb_build_object(
      'texto', 'Verificação independente concluída com conclusão favorável (Rekompense Ambiental Ltda., Relatório RK-VER-2026-001, versão 02, de 30/09/2026, ABNT NBR ISO 14064-3). Quantidade verificada do vintage 2025: 11.835,9 tCO2e, com incerteza de dose de 30%. Critério: Metodologia E2Carbon PMX-EM v2.0 rev. 1 e DCP v2.0 rev. 1. Limitações de escopo: Seção 15 do relatório. Apontamento (Seção 16.2, único ponto apontado): ausência de regras publicadas da registradora. Nenhuma unidade acima de 11.835,9 tCO2e pode ser emitida, serializada, transferida, vendida ou usada em alegação. A asserção de 83.230,36 tCO2e da v1.0 foi retirada. Parecer anterior (metodologia v1.0, 05/07/2026) substituído em 16/11/2026.',
      'relatorio', 'RK-VER-2026-001 v02',
      'quantidade_verificada_tco2e', 11835.9,
      'substitui', 'parecer v1.0 de 05/07/2026'),
    verified_at = '2026-09-30T12:00:00Z'
where id = '00000000-0000-0000-0000-000000000101';

-- ----------------------------------------------------------------------------
-- Item 7 — metodologia v2.0, padrão de registro e localização
-- ----------------------------------------------------------------------------
insert into methodologies (id, name, sector, ipcc_category, owner_org_id) values (
  '00000000-0000-0000-0000-0000000000b4',
  'Metodologia E2Carbon PMX-EM',
  'AFOLU',
  '3.A - Fermentação Entérica',
  '00000000-0000-0000-0000-000000000002'
) on conflict (id) do nothing;

insert into methodology_versions (id, methodology_id, version_label, status, supersedes_version_id, sections, published_at) values (
  '00000000-0000-0000-0000-0000000000b3',
  '00000000-0000-0000-0000-0000000000b4',
  '2.0 rev. 1',
  'published',
  '00000000-0000-0000-0000-0000000000b2',
  jsonb_build_object(
    'enquadramento', jsonb_build_object(
      'titulo', 'Enquadramento Metodológico',
      'corpo', 'Metodologia própria da E2Carbon, a ser registrada na registradora Safe Trace. Referências técnicas: VM0041 v2.0, GS 438 v1.0, ISO 14064-2:2019 e IPCC 2019 Refinement. Substitui a metodologia v1.0 (Redução de Metano Entérico via Aditivo Nutricional) para o vintage 2025.')
  ),
  now()
) on conflict (id) do nothing;

insert into methodology_parameters (methodology_version_id, param_key, value, unit, source_citation, valid_from) values
  ('00000000-0000-0000-0000-0000000000b3', 'ym', 0.063, 'fração da energia bruta', 'IPCC 2019, Vol. 4, Tab. 10.12 (outros bovinos, dieta mista): 6,3% ± 1,0 p.p.', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'eb_mj_per_kg_ms', 18.45, 'MJ/kg MS', 'IPCC 2019, Vol. 4, Cap. 10 (default)', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'e_ch4_mj_per_kg', 55.65, 'MJ/kg CH4', 'IPCC 2006/2019, Eq. 10.21', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'd_ms_kg_per_kg_ms', 0.0006, 'kg Fator P/kg MS', 'GARCIA (2013): 600 mg/kg MS — única dose com redução significativa de CH4', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'f_ion', 0.3458, 'fração do volume', 'DCP v2.0 / Memória de Cálculo: 41,4% × 70% (confinamento) + 56% × 10% (a pasto)', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'r_fraction', 0.129808950536509, 'fração', 'Relatório FUNEP/Unesp Inobio-Manera (30/03/2023): 1,984 / 15,284 g CH4/d/kg MS, sobre o controle', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'gwp_ch4', 28, 'tCO2e/tCH4 (GWP100, AR5)', 'IPCC AR5, WG I, Cap. 8, Tab. 8.7', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'le_est', 0.012, 'fração da redução bruta', 'Metodologia PMX-EM v2.0, Eq. 8 (defaults IPCC 2019)', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'res', 0, 'fração', 'Reserva de integridade não aplicada na v2.0 (projeto de emissões evitadas, sem estoque sujeito a reversão)', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'limiar_u', 0.15, 'fração', 'Dedução = max(0; U90 − 15%) — prática de metodologias AFOLU', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'p_r', 0.0349, 'adimensional', 'Valor-p do teste da respirometria (dossiê)', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'gl_r', 10, 'graus de liberdade', '6 + 6 animais − 2 (relatório FUNEP, PROC MIXED)', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'u_ym', 0.158730158730159, 'fração (IC 95%)', 'IPCC 2019, Tab. 10.12: ±1,0 p.p. sobre 6,3%', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'u_ad', 0.03, 'fração (IC 95%)', 'Registros fiscais eletrônicos reconciliados', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'u_dose', 0.30, 'fração (IC 90%)', 'Incerteza da dose efetiva em campo: 30% sem as fichas técnicas (cenário Y da Memória de Cálculo; adotado no DCP v2.0 rev. 2, que resulta em U90 de 82,6461%)', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000b3', 'u_persist', 0.15, 'fração (IC 90%)', 'Metodologia PMX-EM §8.6: persistência e intensidade→absoluto', '2025-01-01');

update carbon_projects
set methodology_version_id = '00000000-0000-0000-0000-0000000000b3',
    registry_standard = 'safe_trace_proprio',
    location_text = 'Patrocínio Paulista/SP (unidade produtora, filial 01); vendas em 25 UFs'
where id = '00000000-0000-0000-0000-0000000000a1';

-- ----------------------------------------------------------------------------
-- Item 5 — produção do vintage 2025 e insumos do motor v2.0
-- ----------------------------------------------------------------------------
-- Entradas por produção no Kardex AFP13697 (usadas no cálculo); o SIGA
-- (534.100 kg) fica como referência.
update production_records
set quantity_kg = 531240
where project_id = '00000000-0000-0000-0000-0000000000a1'
  and period_year = 2025;

insert into project_period_inputs (project_id, period_year, input_key, value, unit, source_ref) values
  ('00000000-0000-0000-0000-0000000000a1', 2025, 'base_comercial_kg', 552014.568, 'kg', 'Planilhas 37E/39E, 16.558 lançamentos (Memória de Cálculo v2.0, aba Volume 2025)'),
  ('00000000-0000-0000-0000-0000000000a1', 2025, 'bovinos_corte_kg', 526426.786, 'kg', 'Asbram corte, sem produtos de leite (Memória de Cálculo v2.0, aba Volume 2025)'),
  ('00000000-0000-0000-0000-0000000000a1', 2025, 'exportacao_corte_kg', 15016.35, 'kg', 'Lançamentos com UF = EX, categoria Asbram de corte'),
  ('00000000-0000-0000-0000-0000000000a1', 2025, 'estoque_inicial_kg', 35682.58, 'kg', 'Inventário físico de 24/12/2024'),
  ('00000000-0000-0000-0000-0000000000a1', 2025, 'estoque_final_kg', 9683.25, 'kg', 'Inventário físico de 20/12/2025 = Kardex'),
  ('00000000-0000-0000-0000-0000000000a1', 2025, 'saidas_nao_declaradas_kg', 21872.97, 'kg', 'Kardex, transação 599 (natureza a esclarecer, DCP §5.7)'),
  ('00000000-0000-0000-0000-0000000000a1', 2025, 'producao_siga_kg', 534100, 'kg', 'Relatório SIGA/RPCPR06, filial 01 — referência, não usada no cálculo'),
  ('00000000-0000-0000-0000-0000000000a1', 2025, 'potencial_validacao_tco2e', 14413, 'tCO2e', 'Informativo, não emitível (carta E2Carbon de 16/11/2026; DCP v2.0 rev. 2, Quadro 1)')
on conflict (project_id, period_year, input_key) do nothing;

-- ----------------------------------------------------------------------------
-- Item 8 — Registro de Serialização não é aprovação da verificadora
-- ----------------------------------------------------------------------------
-- Não existe policy de UPDATE em project_documents, por isso é feito aqui.
-- O storage_path mantém a pasta antiga (.../auditoria_aprovacao/...): mover o
-- objeto exigiria o Storage; só o tipo (e portanto a visibilidade da
-- Rekompense) muda.
update project_documents
set doc_type = 'monitoramento'
where id = 'ceed5931-67f4-4da0-a729-d629f4b101a7';

-- ----------------------------------------------------------------------------
-- Registro das correções (a carta pede confirmação com data)
-- ----------------------------------------------------------------------------
insert into audit_logs (action, entity_type, entity_id, performed_by, changes)
select 'UPDATE', 'project', '00000000-0000-0000-0000-0000000000a1', om.user_id,
       jsonb_build_object(
         'data', '2026-11-16',
         'origem', 'Carta E2Carbon de 16/11/2026 (Solicitação de correções — vintage 2025)',
         'executado_por', 'operador da plataforma, via migration 20261116000058',
         'itens', jsonb_build_array(
           '1: tokens SIM-TOKEN-ba1a7d64 e SIM-TOKEN-ca8b6dd7 cancelados; emissão do vintage 2025 bloqueada',
           '2: parecer do ciclo de verificação 2025 substituído pelo do RK-VER-2026-001 v02',
           '5: produção 2025 = 531.240 kg; insumos do motor v2.0 cadastrados',
           '7: metodologia PMX-EM v2.0 rev. 1, padrão de registro e localização atualizados',
           '8: Registro de Serialização reclassificado para Monitoramento de Resultados'))
from org_members om
where om.org_id = '00000000-0000-0000-0000-000000000001'
limit 1;

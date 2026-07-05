# SafeCarbon — Modelo de Dados

Este documento descreve o schema lógico do SafeCarbon. A implementação SQL (migration inicial)
está em `supabase/migrations/`. O desenho segue um princípio central: **cada número que aparece em
qualquer documento gerado (DCP, resumo de cálculo, certificado de crédito) precisa ser rastreável
até uma linha de tabela e, dali, até um dado de origem (NF-e, planilha de produção, fatura de
diesel)**. Isso não é purismo — é literalmente o que um VVB audita (ISO 14064-3) e o que a própria
Metodologia da Premix exige em "Transparência e auditabilidade" (§7.6).

O schema é desenhado para **múltiplos projetos e múltiplas metodologias**, não só a Premix.
Nenhuma tabela tem nome ou coluna específica de "Fator P" ou "Premix" — esses são apenas dados.

## 1. Identidade e Tenancy

### `organizations`
Qualquer entidade que participa de um projeto: operador da plataforma (Safe Trace), desenvolvedor
técnico/consultoria (E2Carbon), proponente (Premix), verificador (VVB), comprador de crédito.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | |
| `org_type` | enum | `platform_operator`, `project_developer`, `proponent`, `verifier`, `buyer` |
| `tax_id` | text | CNPJ/CPF, nullable |
| `created_at` | timestamptz | |

### `org_members`
Usuário ↔ organização, com papel dentro dela (`owner`, `manager`, `contributor`, `viewer`).

### `project_roles`
Uma organização pode ter papéis diferentes em projetos diferentes (a E2Carbon é `developer` no
projeto Premix, mas poderia ser `verifier` em outro). Tabela: `project_id, organization_id, role
(proponent|developer|verifier|admin)`.

> **Por que não usar o padrão `sourceUserId` do Conecta Pecuária?** Porque lá é um atalho de
> "visualização delegada" read-only entre dois papéis fixos (varejista/frigorífico). Aqui
> precisamos de permissões de escrita diferenciadas por papel e por projeto (proponente lança
> produção, developer calcula, verificador aprova) — é um RBAC por projeto, não uma delegação de
> visualização.

## 2. Metodologia (Requisito 1)

### `methodologies`
Uma "família" de metodologia (ex.: "Redução de Metano Entérico via Aditivo Nutricional").

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `name` | text |
| `sector` | text (ex.: `AFOLU`) |
| `ipcc_category` | text (ex.: `3.A - Fermentação Entérica`) |
| `owner_org_id` | uuid → organizations (quem mantém a metodologia, tipicamente o developer) |

### `methodology_versions`
Cada revisão formal da metodologia. **Imutável após publicação** — uma correção vira uma nova
versão, nunca um UPDATE em uma versão publicada (isso é o que garante "aplicação prospectiva, sem
efeitos retroativos", exigido em vários pontos da Metodologia — §4.4, §5.6, §7.7, §9.6).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `methodology_id` | uuid | |
| `version_label` | text | ex.: `1.0`, `1.1` |
| `status` | enum | `draft`, `published`, `deprecated` |
| `supersedes_version_id` | uuid nullable | encadeia histórico |
| `published_at` | timestamptz nullable | |
| `sections` | jsonb | conteúdo estruturado por chave de seção (enquadramento, princípio central, linha_de_base, fator_mitigacao, estrutura_calculo, fatores_integridade, mrv, governanca) — cada chave guarda texto rico versionado |

### `methodology_parameters`
Os números vigentes numa versão, cada um com fonte — é o Quadro 4 do DCP generalizado.

| Coluna | Tipo | Exemplo |
|---|---|---|
| `id` | uuid | |
| `methodology_version_id` | uuid | |
| `param_key` | text | `mitigation_factor_pct`, `baseline_ef_ch4_kg_per_animal_year`, `gwp_ch4`, `avg_consumption_kg_per_animal_year`, `uncertainty_discount_pct`, `integrity_buffer_pct` |
| `value` | numeric | `17`, `70`, `28`, `1.46`, `10`, `5` |
| `unit` | text | |
| `source_citation` | text | `Estudos Premix + Unesp (2023)`, `IPCC 2019 / Embrapa`, `IPCC AR5` |
| `valid_from` / `valid_to` | date | suporta revisão sem apagar histórico |

> Este é o mecanismo que resolve, por desenho, o requisito de "atualização metodológica
> controlada" (Metodologia §5.6, §6, §9.6): revisar um parâmetro = inserir uma nova linha com novo
> `valid_from`, nunca alterar a antiga.

## 3. Projetos e DCP (Requisito 2)

### `carbon_projects`

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `name` | text (ex.: `Premix - Fator P`) |
| `proponent_org_id` | uuid → organizations |
| `developer_org_id` | uuid → organizations |
| `methodology_version_id` | uuid → methodology_versions (metodologia vigente no momento) |
| `registry_standard` | enum | `verra`, `gold_standard`, `mbre`, `none_yet` |
| `location_text` | text |
| `status` | enum | `design`, `validation`, `active`, `suspended`, `closed` |

### `dcp_documents`
Uma linha por versão publicada do DCP de um projeto.

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `version_number` | int |
| `status` | enum `draft`/`published` |
| `exported_docx_url` / `exported_pdf_url` | text |
| `generated_at` | timestamptz |

### `dcp_sections`
Granularidade de seção dentro de uma versão do DCP — permite que a seção 7 (cálculo) seja
**gerada automaticamente** a partir de `credit_calculation_cycles` enquanto as seções narrativas
(introdução, adicionalidade, benefícios) são editadas manualmente pelo developer.

| Coluna | Tipo |
|---|---|
| `dcp_document_id` | uuid |
| `section_key` | text (`introducao`, `mecanismo_biologico`, `estrutura_metodologica`, `linha_de_base`, `cenario_projeto`, `adicionalidade`, `calculo_creditos` ⚠️gerada, `vazamentos` ⚠️gerada, `beneficios`, `governanca`, `permanencia`, `referencias`, `anexo_inventario` ⚠️gerada, `anexo_comercializacao` ⚠️gerada) |
| `content` | jsonb / richtext |
| `is_generated` | boolean |
| `source_reference` | jsonb nullable (ex.: `{cycle_id: ...}` quando `is_generated=true`) |

## 4. Produção e Comercialização (base para Requisitos 3 e 5)

### `production_records`
Lançamento de produção industrial por período — a "unidade primária de quantificação" do DCP §3.

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `period_year` | int |
| `period_month` | int nullable (granularidade mensal opcional, agregada anualmente) |
| `quantity_kg` | numeric |
| `source` | enum `erp_integration`, `manual_entry` |
| `evidence_doc_url` | text nullable |
| `created_by` | uuid, `created_at` | |

### `commercialization_documents`
Uma linha por NF-e — evidência primária auditável (DCP §7.5: "as Notas Fiscais eletrônicas
constituem evidência primária auditável de comercialização").

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `nfe_key` | text unique (chave de acesso de 44 dígitos) |
| `nfe_number` | text |
| `issue_date` | date |
| `buyer_tax_id` | text |
| `quantity_kg` | numeric |
| `raw_file_url` | text (XML/PDF original) |
| `linked_production_period_year` | int nullable (permite tratar comercialização de safra anterior — DCP §7.5 item 6) |
| `already_credited` | boolean default false |

### `production_period_summary` (view materializada)
Agrega, por `project_id + period_year`: `total_produced_kg` (Pfp), `total_commercialized_kg` (Tc),
`commercialization_factor` (Fc = Tc/Pfp). Recalculada sempre que `production_records` ou
`commercialization_documents` mudam. É o dado de entrada direto da Etapa 1–2 do motor de cálculo.

## 5. Inventário de Emissões e Vazamentos (Requisito 4)

### `emission_factors`
Biblioteca versionada de fatores de emissão.

| Coluna | Tipo | Exemplo |
|---|---|---|
| `id` | uuid | |
| `category` | text | `biomass_ch4`, `biomass_n2o`, `biomass_ncv`, `diesel_co2e`, `electricity_grid` |
| `value` | numeric | `30`, `4`, `15`, `2.68` |
| `unit` | text | `kg/TJ`, `TJ/Gg`, `kg CO2e/L` |
| `gwp_version` | text nullable | `AR5`, `AR6` — **campo obrigatório sempre que o fator envolve conversão de GWP**, para nunca repetir a inconsistência do DCP original (corpo usa GWP CH₄=28/AR5, Anexo I usa GWP CH₄=28/N₂O=273/AR6 sem explicar a mistura) |
| `source_citation` | text | `IPCC 2006`, `GHG Protocol` |
| `valid_from` / `valid_to` | date | |

### `emission_inventory_entries`
Lançamento de dados de atividade por fonte, por projeto/ano — implementa o Anexo I.

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `period_year` | int |
| `source_type` | text (`biomass_combustion`, `diesel_transport`, `electricity`, extensível) |
| `activity_quantity` | numeric (ex.: kg de lenha, L de diesel) |
| `activity_unit` | text |
| `emission_factor_id` | uuid[] (pode usar mais de um fator — ex.: biomassa usa CH₄+N₂O+PCI) |
| `calculated_tco2e` | numeric | resultado, nunca digitado à mão |
| `justification` | text nullable | obrigatório quando uma fonte é **excluída** do inventário (ex.: eletricidade renovável da Premix) |

### `leakage_assessments`
Implementa a seção 8 do DCP.

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `period_year` | int |
| `category` | enum `rebound_effect`, `technology_substitution`, `supply_chain`, `geographic_displacement`, `other` |
| `conclusion` | text |
| `justification` | text |
| `leakage_factor_pct` | numeric default 0 |

## 6. Cálculo e Créditos (Requisito 5)

Ver detalhamento completo das fórmulas em
[05-motor-de-calculo.md](05-motor-de-calculo.md). Aqui vai o esqueleto de dados.

### `credit_calculation_cycles`
Uma linha por projeto/ano — o "ciclo de crédito".

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `period_year` | int |
| `methodology_version_id` | uuid (trava qual versão/parâmetros valem para este ciclo) |
| `status` | enum `draft`, `calculated`, `in_verification`, `verified`, `approved`, `issued`, `rejected` |
| `calculated_at` | timestamptz, `calculated_by` uuid |

### `credit_calculation_steps`
Registro de **cada uma das etapas** do cálculo (1 a 9 no DCP), para auditoria completa —
elimina o padrão observado no DCP original de números finais sem trilha (`833.23030`,
`977.346346` — claramente colados de planilha, com dígitos duplicados por erro de transcrição).

| Coluna | Tipo |
|---|---|
| `cycle_id` | uuid |
| `step_number` | int (1–9) |
| `step_key` | text (`producao_anual`, `comercializacao`, `animais_estimados`, `emissoes_linha_base`, `emissoes_projeto`, `reducao_bruta_ch4`, `conversao_co2e`, `subtracao_operacional`, `fatores_integridade`) |
| `input_values` | jsonb (todas as variáveis usadas nessa etapa, com origem) |
| `output_value` | numeric |
| `unit` | text |

### `credit_batches`
Resultado final de um ciclo aprovado — o volume elegível para emissão.

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `cycle_id` | uuid |
| `tco2e_amount` | numeric |
| `commercialization_factor` | numeric (Fc aplicado) |
| `eligibility_factor` | numeric (Fe aplicado) |
| `status` | enum `pending_verification`, `verified`, `approved`, `issued`, `retired` |

### `verification_cycles`
Registro do ciclo de verificação independente (VVB), tipicamente bienal.

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `period_start_year` / `period_end_year` | int |
| `vvb_org_id` | uuid → organizations |
| `status` | enum `scheduled`, `in_progress`, `approved`, `rejected` |
| `verification_statement_url` | text |
| `findings` | jsonb |

### `credit_issuances`
Emissão formal de créditos a partir de um `credit_batch` aprovado + `verification_cycle`.

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `credit_batch_id` | uuid |
| `verification_cycle_id` | uuid |
| `issued_amount_tco2e` | numeric |
| `serial_number_start` / `serial_number_end` | text |
| `issued_at` | timestamptz |

## 7. Blockchain (integração obrigatória — ver `04-arquitetura-tecnica-integracoes.md`)

### `blockchain_tokens`

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `credit_issuance_id` | uuid |
| `token_id` | text (identificador retornado pela camada Safe Trace) |
| `tx_hash` | text |
| `ledger_ref` | text (referência de chain/ledger, caso a Safe Trace opere mais de um) |
| `status` | enum `active`, `transferred`, `retired` |
| `owner_reference` | text (carteira/organização atual detentora) |
| `retired_at` / `retired_reason` | timestamptz / text nullable |

## 8. Referências geoespaciais (SafeGisTrace)

### `project_sites`
Não duplica a SafeGisTrace — só guarda referência leve para permitir mapas de distribuição (ex.:
Figura 5 do DCP, "Mapa de distribuição do Fator P por localização").

| Coluna | Tipo |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `label` | text (ex.: nome do município/região, ou nome da fazenda-cliente se disponível) |
| `latitude` / `longitude` | numeric |
| `safegistrace_analysis_id` | text nullable (referência ao cache de análise da API externa, quando aplicável — ex.: se um dia o projeto precisar validar que a produção não está ligada a fornecedores com desmatamento) |

## 9. Relatórios

### `monitoring_reports`
Relatório Anual de Monitoramento (Metodologia §8.3).

### `resumo_calculo_documents`
Implementa o Requisito 3 — um documento gerado por ciclo, texto narrativo + PDF/DOCX.

| Coluna | Tipo |
|---|---|
| `cycle_id` | uuid |
| `narrative_text` | text (gerado a partir de template + `credit_calculation_steps`) |
| `exported_docx_url` / `exported_pdf_url` | text |

## 10. Auditoria

### `audit_log`
Append-only, trigger-based em todas as tabelas de dado primário (`production_records`,
`commercialization_documents`, `emission_inventory_entries`, `methodology_parameters`,
`credit_calculation_cycles`).

| Coluna | Tipo |
|---|---|
| `table_name` | text |
| `record_id` | uuid |
| `action` | enum `insert`, `update`, `delete` |
| `old_value` / `new_value` | jsonb |
| `changed_by` | uuid |
| `changed_at` | timestamptz |

## Princípios de RLS (lição aplicada do Conecta Pecuária)

- **Isolamento por projeto**: toda tabela com `project_id` tem RLS restrita a
  `project_roles` do usuário — nunca uma policy `USING (true)` de "leitura geral" coexistindo com
  a policy restritiva (essa combinação já causou vazamento de dados em produção no Conecta —
  ver `feedback_security_rls.md`, migration `20260611000003`). Antes de subir qualquer migration
  de RLS no SafeCarbon, rodar uma checagem explícita: "existe mais de uma policy de SELECT na
  mesma tabela? se sim, qual delas é `USING (true)`?".
- **Metodologia é a exceção**: `methodology_versions` publicadas são de leitura pública
  (autenticada), porque o Requisito 1 pede consulta aberta — não isolamento por projeto.

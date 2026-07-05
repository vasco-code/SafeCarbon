# SafeCarbon — Roadmap de Sprints

Sequenciamento priorizado para colocar o piloto Premix (ciclo 2025) rodando de ponta a ponta o
mais rápido possível, mas sem hardcode — cada sprint entrega uma capacidade genérica, testada com
os dados reais da Premix como caso de aceite.

## Sprint 0 — Fundação
- Migration inicial: `organizations`, `org_members`, `project_roles`, `carbon_projects`.
- Auth Supabase + RLS baseline (`has_project_role()`).
- Scaffold do app (Vite/React/TS), shell de navegação por módulo.
- Seed: organizações Safe Trace (platform_operator), E2Carbon (developer), Premix (proponent).
- **Aceite**: um usuário Premix loga e vê o projeto "Premix - Fator P" vazio; um usuário de outra
  organização não vê nada.

## Sprint 1 — Central de Metodologias (Requisito 1)
- Migration: `methodologies`, `methodology_versions`, `methodology_parameters`.
- Tela de consulta pública (autenticada) da metodologia, navegável por seção.
- Tabela de parâmetros vigentes com fonte.
- Import inicial: metodologia "Redução de Metano Entérico via Aditivo Nutricional" v1.0, com as 7
  seções da `Metodologia-fatorP.docx` e os parâmetros do Quadro 4 (R=17%, EF=70, GWP=28, C_uso=1,46,
  desconto=10%, buffer=5%).
- **Aceite**: qualquer usuário autenticado consegue abrir a metodologia v1.0 e ver de onde vem cada
  parâmetro, sem precisar baixar o `.docx` original.

## Sprint 2 — Produção & Comercialização
- Migration: `production_records`, `commercialization_documents`, view
  `production_period_summary`.
- Tela de lançamento de produção mensal/anual.
- Importador de NF-e (XML) → `commercialization_documents`, com parsing de chave, quantidade,
  comprador, data.
- Cálculo automático de `Fc` exposto na tela do período.
- **Aceite**: lançar produção 2025 (441,57 t) + importar NF-e somando 431,02 t comercializados →
  sistema mostra `Fc = 0,9761` sem digitação manual.

## Sprint 3 — Inventário de Emissões & Vazamentos (Requisito 4)
- Migration: `emission_factors`, `emission_inventory_entries`, `leakage_assessments`.
- Seed de fatores: biomassa (CH₄ 30 kg/TJ, N₂O 4 kg/TJ, PCI 15 TJ/Gg, ambos IPCC 2006), diesel
  (2,68 kg CO₂e/L, GHG Protocol), com `gwp_version` explícito por fator.
- Tela de lançamento de inventário por fonte + cálculo automático de tCO₂e.
- Formulário de avaliação de vazamento (4 categorias) por ciclo.
- **Aceite**: lançar 4.524.860 kg de lenha + 331.956 L de diesel para 2025 → sistema calcula
  ~1.021 tCO₂e total (131,1 biomassa + 889,6 diesel), sem os erros de dígito duplicado do DCP
  original.

## Sprint 4 — Motor de Cálculo (núcleo do Requisito 5)
- Migration: `credit_calculation_cycles`, `credit_calculation_steps`, `credit_batches`.
- Implementação das 9 etapas descritas em `05-motor-de-calculo.md`, como Edge Function
  `calculate-credit-cycle`.
- Tela "Ciclo de Créditos 2025" mostrando as 9 etapas com valores e origem de cada input.
- Validações obrigatórias (Tc≤Pfp, inventário presente, vazamento avaliado, metodologia
  publicada).
- **Aceite**: rodar o cálculo do ciclo 2025 da Premix e chegar em **83.230 tCO₂e** de redução
  final elegível — validando o motor genérico contra o número que o `resumo-cálculo.docx` e o
  DCP §7.4 concordam (não o número divergente de §7.9).

## Sprint 5 — DCP e Resumo de Cálculo (Requisitos 2 e 3)
- Migration: `dcp_documents`, `dcp_sections`, `resumo_calculo_documents`.
- Editor de seções narrativas do DCP (introdução, mecanismo, adicionalidade, benefícios,
  governança, permanência, referências).
- Geração automática das seções `calculo_creditos`, `anexo_inventario`, `anexo_comercializacao` a
  partir dos dados do ciclo (não digitadas).
- Geração do resumo de cálculo (template + `credit_calculation_steps`).
- Exportação DOCX/PDF no layout da E2Carbon (sumário, lista de figuras/quadros, acrônimos).
- **Aceite**: exportar um DCP da Premix v1.0 cuja seção 7 bate 100% com o motor de cálculo — sem
  divergência entre seções, ao contrário do documento original.

## Sprint 6 — MRV e Verificação
- Migration: `verification_cycles`.
- Fluxo de status do ciclo: `calculated` → `in_verification` → `verified`/`rejected`.
- Papel `verifier` (VVB) com acesso de leitura completo + campo de parecer/`findings`.
- Relatório de Monitoramento anual (`monitoring_reports`) exportável.
- **Aceite**: um usuário com papel `verifier` revisa o ciclo 2025, registra `findings` e aprova,
  mudando o status do `credit_batch` para `approved`.

## Sprint 7 — Emissão e Tokenização (blockchain)
- Migration: `credit_issuances`, `blockchain_tokens`.
- Implementação do `blockchain-adapter` (ver `04-arquitetura-tecnica-integracoes.md`) — **depende
  de confirmação do contrato real da camada blockchain da Safe Trace antes de começar**.
- Edge Functions `issue-credit-batch`, `retire-credit`, `reconcile-blockchain-state`.
- **Aceite**: um `credit_batch` com status `approved` gera um token rastreável, com `tx_hash`
  consultável na tela do projeto.

## Sprint 8 — Distribuição Geográfica (SafeGisTrace)
- Migration: `project_sites`.
- Cliente `safegistrace-client.ts` + Edge Function de token.
- Mapa de distribuição (MapLibre GL, reaproveitando o padrão do Mapa de Fornecedores do Conecta).
- **Aceite**: mapa mostrando os pontos de distribuição do Fator P equivalente à Figura 5 do DCP.

## Sprint 9 — Hardening multi-projeto
- Criar um **segundo projeto fictício de metodologia diferente** (ex.: manejo de pastagem,
  farm-based) só para provar que o schema não precisa de alteração para acomodar um domínio
  diferente do da Premix.
- Auditoria completa de RLS (checar policies duplas/`USING(true)` em todas as tabelas).
- Trilha de auditoria (`audit_log`) ativa em todas as tabelas de dado primário.
- **Aceite**: o segundo projeto roda seu próprio ciclo de cálculo, com sua própria metodologia e
  parâmetros, sem nenhuma migration nova além de dados/seeds.

## Fora de escopo deste roadmap (decisões de negócio, não técnicas)
- Integração de submissão automática a Verra/Gold Standard/MBRE (hoje é processo manual via
  documentos exportados).
- Marketplace de compra/venda de créditos entre organizações (mencionado como possibilidade futura
  em `01-contexto-e-decisao-arquitetura.md`, não um requisito atual).

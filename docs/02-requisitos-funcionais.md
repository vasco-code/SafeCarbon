# SafeCarbon — Requisitos Funcionais

Este documento traduz os 5 pontos indispensáveis definidos pelo negócio em módulos e
funcionalidades concretas do sistema. Cada seção referencia a parte do DCP/Metodologia da Premix
que originou o requisito, mas o desenho é feito para ser **genérico** — o segundo projeto de
carbono a entrar na plataforma deve caber nos mesmos módulos sem alteração de estrutura.

## Visão geral dos módulos

```
1. Central de Metodologias        → Requisito 1
2. Projetos de Carbono / DCP      → Requisito 2
3. Produção & Comercialização     → base de dados para Requisitos 3 e 5
4. Inventário de Emissões & Vazamentos → Requisito 4
5. Motor de Cálculo & Créditos Elegíveis → Requisito 3 e 5
6. MRV & Verificação               → transversal (Metodologia §8, DCP §5 e §10)
7. Emissão & Tokenização de Créditos → integração blockchain, transversal ao Requisito 5
```

---

## Requisito 1 — Metodologia disponível para consulta

**Origem:** `Metodologia-fatorP.docx` completo; DCP §3 (Estrutura Metodológica).

A metodologia não é um PDF estático anexado — ela é o contrato técnico que qualquer usuário
(proponente, verificador, comprador de crédito, auditor) precisa poder consultar a qualquer
momento, e que **muda de versão ao longo do tempo** de forma controlada (a própria Metodologia
prevê revisão do fator de mitigação, da linha de base e dos fatores de integridade — sempre
prospectiva, nunca retroativa).

### Funcionalidades

- **Biblioteca de metodologias**: lista de metodologias cadastradas na plataforma (uma por
  "família" de projeto — ex.: "Redução de Metano Entérico via Aditivo Nutricional"), cada uma com
  histórico de versões.
- **Página de consulta por versão**: renderiza a metodologia de forma estruturada (não como
  anexo baixável apenas) — seções: enquadramento, princípio central, linha de base, fator de
  mitigação, estrutura de cálculo, fatores de integridade, MRV, governança — navegável, com
  âncoras, buscável.
- **Tabela de parâmetros ativos**: para cada versão, uma tabela mostrando os parâmetros
  numéricos vigentes (fator de mitigação, EF de linha de base, GWP, desconto de incerteza, buffer)
  com a fonte de cada um (IPCC 2019, Embrapa, estudo Unesp, etc.) — é o Quadro 4 do DCP,
  generalizado.
- **Linha do tempo de revisões**: quando um parâmetro muda de versão, mostrar data de vigência,
  motivo da mudança e confirmação de que a mudança é prospectiva (não afeta créditos já emitidos).
- **Exportação**: gerar PDF/DOCX da metodologia vigente para submissão a padrões externos (Verra,
  Gold Standard, MBRE).
- **Controle de acesso**: leitura pública (ou pública para usuários autenticados da plataforma);
  edição restrita a `platform_admin` e `methodology_author` (tipicamente E2Carbon).

---

## Requisito 2 — DCP (Documento de Concepção de Projeto)

**Origem:** `DCP.docx` completo (13 seções + 2 anexos).

O DCP é o documento formal por **projeto** (não por metodologia). Cada novo cliente/projeto que
entra na plataforma (Premix é o primeiro) gera o seu próprio DCP, referenciando uma versão
específica da metodologia.

### Funcionalidades

- **Cadastro de projeto**: nome, proponente, desenvolvedor técnico, setor (AFOLU), categoria
  IPCC, localização, metodologia + versão vinculada, padrão de certificação alvo (Verra/Gold
  Standard/MBRE/nenhum ainda).
- **Editor estruturado do DCP**, com as seções do documento fonte como campos versionados:
  1. Introdução (contexto do proponente e do produto/intervenção)
  2. Mecanismo de ação (evidências científicas, quadro de evidências)
  3. Estrutura metodológica do projeto (enquadramento, critérios de elegibilidade, escopo/limites,
     responsabilidades, premissas de integridade)
  4. Linha de base
  5. Cenário do projeto (implementação, MRV, comercialização, exclusividade de atributo climático)
  6. Adicionalidade (regulatória, prática comum, financeira, tecnológica)
  7. Cálculo e emissão de créditos → **puxado do motor de cálculo, não digitado à mão** (ver
     `05-motor-de-calculo.md`)
  8. Vazamentos (leakage) → ver módulo de Inventário/Vazamentos
  9. Benefícios ambientais e socioeconômicos, alinhamento ODS
  10. Gestão do projeto e governança
  11. Permanência, riscos e salvaguardas
  12. Referências bibliográficas
  13. Anexos (inventário de emissões detalhado, relatório de comercialização)
- **Versionamento do DCP**: cada atualização anual (nova safra de produção, nova verificação) gera
  uma nova versão do DCP, mantendo histórico completo — importante porque VVBs e registries pedem
  o histórico de mudança do documento, não só a versão atual.
- **Exportação para DOCX/PDF** no layout profissional já usado pela E2Carbon (mesma diagramação:
  sumário, lista de figuras, lista de quadros, acrônimos, definições).
- **Anexo I automático**: a seção de inventário de emissões do DCP é gerada a partir dos dados
  reais lançados no módulo de Inventário de Emissões (não digitada à mão) — elimina divergência
  entre o texto do DCP e a planilha de cálculo, que é exatamente o tipo de erro que um VVB pega
  (o DCP de origem já tem inconsistências de arredondamento nesse ponto, ex.: "977.346346" e
  "833.23030" na seção 7.4 — um sinal de que esses números vêm de copiar/colar planilha em vez de
  gerados por um sistema único de verdade).
- **Anexo II automático**: relatório de comercialização, derivado do módulo de Produção &
  Comercialização (NF-e).

---

## Requisito 3 — Resumo do cálculo

**Origem:** `resumo-cálculo.docx`.

É a versão executiva/narrativa do resultado do motor de cálculo para um projeto e período —
pensada para leitura rápida por quem não vai entrar na planilha completa (diretoria da Premix,
compradores de crédito, imprensa/ESG).

### Funcionalidades

- **Geração automática de resumo narrativo** a partir do resultado do motor de cálculo de um
  ciclo (ano): produção total, volume comercializado, animais estimados atendidos, emissões de
  linha de base, emissões do projeto, redução bruta, conversão em tCO₂e, emissões operacionais
  deduzidas, descontos de incerteza e buffer aplicados, redução final elegível.
- **Template de texto parametrizado** (o mesmo texto-modelo do `resumo-cálculo.docx`, com os
  números substituídos automaticamente pelos valores do ciclo) — reduz para zero o risco de
  divergência entre o resumo e o cálculo formal.
- **Exportação**: PDF de uma página / DOCX, e card resumido na tela do projeto.
- **Histórico de resumos**: um por ciclo anual, permitindo comparação ano a ano (ligado ao roadmap
  de projeções, DCP §7.10).

---

## Requisito 4 — Inventário de emissões (+ vazamentos)

**Origem:** DCP Anexo I (Inventário de emissões associadas à produção) e DCP §8 (Vazamentos).

Estes são dois módulos tecnicamente distintos que compartilham a mesma motivação — garantir que o
crédito emitido representa redução **líquida** real — e por isso ficam lado a lado na mesma área
do produto.

### 4.1 Inventário de Emissões Operacionais (Anexo I)

- **Lançamento de dados de atividade por fonte de emissão**, por ciclo anual:
  - Combustão de biomassa (ex.: lenha) — massa consumida (kg), poder calorífico (TJ/Gg), fatores
    de emissão de CH₄ e N₂O (kg/TJ)
  - Combustíveis fósseis (ex.: diesel) — consumo (L), fator de emissão (kg CO₂e/L)
  - Energia elétrica — consumo (kWh) + fator de emissão da matriz (ou exclusão justificada, como
    no caso Premix, que usa energia renovável e por isso zera essa fonte — a justificativa precisa
    ficar registrada, não só omitida)
  - Extensível: novas fontes de emissão (ex.: refrigeração, resíduos) sem alteração de schema —
    ver `emission_inventory_entries` em `03-modelo-de-dados.md`.
- **Biblioteca de fatores de emissão** (`emission_factors`): versionada, com fonte (IPCC 2006,
  IPCC 2019, GHG Protocol, AR5/AR6 para GWP), para permitir auditoria de onde cada número vem —
  hoje o DCP mistura GWP AR5 (corpo do documento) e GWP AR6 (Anexo I) para os mesmos gases sem
  explicar a escolha; o sistema deve forçar essa explicitação por versão de cálculo.
- **Cálculo automático**: dado massa/consumo + fator de emissão + GWP, o sistema calcula
  tCO₂e por fonte e o total do inventário do ciclo — elimina erros de conta manual (o Anexo I do
  DCP tem inconsistência entre "1.020,7" e "1.021" tCO₂e usados em pontos diferentes do mesmo
  documento).
- **Exportação** para a seção Anexo I do DCP e para o motor de cálculo (Etapa 8 — subtração de
  emissões operacionais).

### 4.2 Avaliação de Vazamentos (Leakage)

- **Formulário estruturado de avaliação de vazamento por ciclo**, cobrindo as categorias que o
  DCP já usa como framework (efeito rebote, substituição tecnológica, deslocamento geográfico,
  cadeia de suprimentos) — cada categoria com: hipótese avaliada, conclusão, justificativa
  técnica.
- **Fator de vazamento (LF)** explícito e versionado por ciclo (default 0, com justificativa
  obrigatória sempre que for 0 — não pode ficar implícito).
- **Alerta automático** se LF > 0: nesse caso o motor de cálculo (Etapa 8/9) precisa aplicar o
  desconto de vazamento antes dos fatores de integridade — hoje a metodologia da Premix não tem
  essa fórmula explícita porque assume LF=0; o sistema deve ter o campo pronto para quando um
  próximo projeto (ex.: um projeto de manejo de pastagem, onde vazamento é mais provável) precisar
  dele.

---

## Requisito 5 — Créditos elegíveis (cálculo e emissão)

**Origem:** DCP §7 completo (Cálculo e Emissão dos Créditos de Carbono).

Este é o módulo mais crítico do sistema — é onde produção, comercialização, linha de base,
inventário de emissões e fatores de integridade convergem num número final auditável. Está detalhado
à parte em [05-motor-de-calculo.md](05-motor-de-calculo.md); aqui ficam os requisitos de produto
em volta do motor:

- **Tela de "Ciclo de Créditos"** por projeto/ano: mostra as 9 etapas do cálculo passo a passo,
  com o valor de cada etapa visível e rastreável até o dado de origem (produção lançada,
  comercialização lançada, inventário lançado) — nunca um número "solto".
- **Fator de comercialização (Fc) e fator de elegibilidade (Fe)** calculados a partir dos dados de
  NF-e reais, nunca digitados manualmente — a Premix usou Fc = 0,9761 (431,02 / 441,57) a partir
  de notas fiscais; o sistema deve derivar isso de registros de NF-e importados, não de um campo
  livre.
- **Reconciliação anual produção × estoque × comercialização × já creditado**, exigida
  explicitamente na Metodologia §"Monitoramento da Comercialização" — precisa de uma tela própria
  de conciliação, com alerta se a soma não fechar.
- **Tratamento de volumes de anos anteriores comercializados no ciclo atual**: o modelo de dados
  precisa suportar isso sem duplicar crédito (idempotência por NF-e/lote).
- **Cláusula de exclusividade de atributo climático**: campo de projeto que registra que os
  contratos comerciais da Premix têm essa cláusula — é um controle de compliance, não um cálculo,
  mas é parte da prevenção de dupla contagem (DCP §5.4 e §7.6) e deve ser auditável.
- **Status do ciclo de crédito**: `calculado` → `em verificação` → `verificado (VVB)` →
  `aprovado para emissão` → `emitido/tokenizado` → `aposentado (retired)`.
- **Emissão e tokenização**: ao aprovar um ciclo, o sistema chama a camada de blockchain da Safe
  Trace para gerar o token/registro imutável do lote de créditos (ver
  `04-arquitetura-tecnica-integracoes.md`), armazenando o hash/ID de transação retornado.
- **Projeções futuras** (DCP §7.10): tela de cenário que aplica premissas de crescimento sobre o
  último ciclo verificado — deixando explícito que são indicativas, não créditos elegíveis.

---

## Requisitos transversais (não numerados, mas exigidos pelos 3 documentos)

- **MRV estruturado** (Metodologia §8, DCP §5 e §10): monitoramento contínuo → relato anual →
  verificação por VVB independente em ciclos bienais. Precisa de fluxo de aprovação com papéis
  (proponente lança dados → consultoria técnica calcula → VVB revisa e aprova/rejeita → registro
  emite).
- **Trilha de auditoria completa**: toda alteração em produção, comercialização, inventário ou
  parâmetro de metodologia precisa ficar registrada (quem, quando, valor anterior/novo) — é
  pré-requisito de qualquer verificação ISO 14064-3.
- **Multi-tenant multi-papel**: `platform_admin` (Safe Trace), `methodology_author`/`mrv_manager`
  (E2Carbon), `project_owner`/`data_provider` (Premix), `verifier` (VVB externo), e futuramente
  `credit_buyer` (comprador de crédito, acesso só-leitura ao certificado).
- **Prevenção de dupla contagem entre projetos**: mesmo antes de qualquer registro externo
  (Verra/Gold Standard), a plataforma é a fonte de verdade que impede dois ciclos reivindicarem o
  mesmo lote de produto comercializado.

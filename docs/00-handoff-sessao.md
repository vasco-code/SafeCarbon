# SafeCarbon — Handoff da sessão de planejamento

Este documento existe por um motivo específico: todo o planejamento inicial do SafeCarbon (este
documento incluído) foi feito numa sessão do Claude Code **rodando com raiz no repositório do
Conecta Pecuária** (`/Users/vasco/dyad-apps/ConectaPecuaria-mainBayer`), porque a decisão de
arquitetura dependia de auditar aquele código lado a lado. O SafeCarbon era, até então, apenas um
"additional working directory".

A partir daqui, o trabalho passa a rodar numa sessão nova, com raiz em `/Users/vasco/SafeCarbon`.
Esse documento — e os arquivos de memória semeados junto com ele (ver seção final) — existem para
que essa transição não perca contexto. Leia isto primeiro se você (humano ou Claude) está
retomando o projeto numa sessão nova.

## O que é o projeto, em uma frase

Plataforma da Safe Trace (parceria com a E2Carbon) para registro de dados de pegada de carbono,
cálculo de reduções e tokenização de créditos de carbono. Primeiro projeto/cliente: **Premix Fator
P — Pecuária Baixo Carbono** (aditivo nutricional que reduz metano entérico em bovinos).

## Documentos-fonte

Os três documentos técnicos produzidos pela E2Carbon que originaram todo o levantamento de
requisitos estão preservados em [`fontes-e2carbon/`](fontes-e2carbon/) (copiados de `~/Downloads`,
que é um local instável — não confiar neles lá, só aqui):

- `DCP-Premix-FatorP-v1.0.docx` — Documento de Concepção de Projeto completo
- `Metodologia-FatorP-v1.0.docx` — Metodologia formal
- `resumo-calculo-2025.docx` — Resumo executivo do cálculo 2025

## Os 5 pontos indispensáveis definidos pelo negócio (não mudam)

1. Metodologia disponível para consulta dos usuários
2. DCP (Documento de Concepção de Projeto)
3. Resumo do cálculo
4. Inventário de emissões (+ avaliação de vazamentos, seção 8 do DCP)
5. Créditos elegíveis (cálculo e emissão — seção 7 do DCP)

Mais dois requisitos de integração, dados como constraints pelo negócio (não estão em discussão):
usar a API geoespacial **SafeGisTrace** (não existe "ConectaGIS" — esse é o nome real da API já
operada pela Safe Trace) e a **camada de blockchain própria da Safe Trace** para tokenização.

## Decisão de arquitetura — o essencial

**SafeCarbon é projeto novo e independente do Conecta Pecuária.** Codebase, schema Postgres e app
próprios. Reaproveita apenas **infraestrutura e serviços**: SafeGisTrace via API, org Supabase
self-hosted da Safe Trace (`supabase.safetrace.com.br`, como projeto separado), e lições de
engenharia já pagas em produção no Conecta (ver seção abaixo).

Por quê: o Conecta Pecuária é 100% farm/livestock-centric — `places` = fazenda por CAR,
`individual_animals`, `manejos`, protocolo Bayer CBC calculando pegada de carbono **por animal**
via IPCC Tier 2. A Premix é uma indústria que produz/vende um insumo — a unidade de quantificação é
tonelada produzida/comercializada via NF-e, não fazenda/animal. Não existe no Conecta nenhum
conceito de produção industrial, lote de fabricação, NF-e ou inventário de emissões operacionais.
Forçar os dois domínios no mesmo schema geraria dívida técnica sem ganho real de reuso de dados.

Argumento completo, com a tabela comparativa e as alternativas descartadas:
[01-contexto-e-decisao-arquitetura.md](01-contexto-e-decisao-arquitetura.md).

## Lições de engenharia herdadas do Conecta Pecuária (aplicar desde já no SafeCarbon)

Essas três já foram encontradas e resolvidas em produção no Conecta — não redescobrir:

1. **RLS**: nunca deixar uma policy `USING (true)` de SELECT coexistindo com uma policy
   restritiva na mesma tabela — no Postgres/Supabase, múltiplas policies de SELECT são combinadas
   com OR, então a permissiva sempre vence. Isso já causou vazamento de isolamento de dados em
   produção no Conecta (migration `20260611000003_fix_places_rls_security.sql`). A migration
   inicial do SafeCarbon (`supabase/migrations/20260705000001_init_schema.sql`) já foi desenhada
   evitando esse padrão — mas qualquer policy nova precisa ser checada contra essa regra.
2. **Imports**: sempre usar o alias `@/` para importar de `src/`, nunca misturar com caminho
   relativo (`./contexts/...`) para o mesmo módulo — misturar os dois cria duas instâncias
   diferentes de um Context no bundler (bug sutil, difícil de debugar). O scaffold já está
   configurado com `@/` tanto no `tsconfig.json` quanto no `vite.config.ts` (os dois precisam do
   alias, o tsconfig sozinho não basta para o Vite resolver em build).
3. **Payloads grandes em query string**: filtros tipo `?id=in.(uuid1,uuid2,...)` com centenas de
   UUIDs geram erro 414 (URI too long), que o browser costuma reportar como erro de CORS
   (mascarando a causa real). Se o SafeCarbon precisar filtrar por muitos IDs de uma vez (ex.:
   reconciliação de NF-e em lote), usar uma function RPC com POST no lugar de um filtro gigante na
   URL.

## Achado importante sobre os dados-fonte

O DCP original tem uma **inconsistência interna de cálculo**: a seção §7.4 calcula os créditos de
2025 a partir de `Pfp = 441,57 t` produzidas, chegando em 83.230 tCO₂e finais — número que bate com
o `resumo-cálculo.docx`. Mas a seção §7.9, do mesmo documento, usa `Pfp = 1.476,31 t` (mais de 3×
diferente) para o mesmo ano, chegando em 288.068 tCO₂e — um número completamente diferente. Isso é
sinal de colagem de planilhas/rascunhos diferentes sem fonte única de verdade, e é exatamente o
tipo de coisa que um VVB rejeitaria numa verificação real.

**Consequência de design, já aplicada**: no SafeCarbon, a seção de cálculo do DCP nunca é digitada
manualmente — é sempre gerada a partir da última execução do motor de cálculo. Ver
[05-motor-de-calculo.md](05-motor-de-calculo.md), especialmente a seção "Por que isto importa mais
do que parece".

Há também uma ambiguidade resolvida no motor de cálculo sobre o "fator de elegibilidade" (`Fe`) do
DCP §7.5, que na leitura literal duplicaria o desconto de comercialização já aplicado via `Fc` — a
decisão de design (aplicar `Fc` uma vez só, e usar `Fe`/reconciliação apenas para excluir volume já
creditado em ciclos anteriores) está documentada na mesma seção.

## Nota sobre ferramentas/ambiente (para quem retomar via Claude Code)

A ferramenta de preview/browser (`mcp__Claude_Preview__*`) resolve `.claude/launch.json` a partir
do diretório **raiz da sessão**, não de um "additional working directory". Isso significa que,
enquanto o SafeCarbon era só um diretório adicional numa sessão rodando no Conecta, tentar dar
preview no dev server do SafeCarbon acabava subindo o dev server do Conecta por engano. Já existe
um `.claude/launch.json` correto em `/Users/vasco/SafeCarbon/.claude/launch.json` — ele só
funciona de verdade agora que este diretório é a raiz da sessão.

## Status atual do projeto

- **Documentação de planejamento**: completa — ver [README.md](../README.md) para o índice dos 6
  documentos (01 a 06) mais este handoff (00).
- **Scaffold de código**: Vite + React + TypeScript, com `npm install` e `npm run build` validados
  (build limpo, sem artefatos soltos na raiz). Nenhuma lógica de negócio implementada ainda — as
  páginas em `src/modules/` são esqueletos de navegação.
- **Banco de dados**: migration inicial completa em
  `supabase/migrations/20260705000001_init_schema.sql`, implementando o schema de
  [03-modelo-de-dados.md](03-modelo-de-dados.md). **Ainda não aplicada em nenhum projeto Supabase
  real** — não existe projeto Supabase do SafeCarbon provisionado ainda.
- **Git**: inicializado (`git init`), **sem nenhum commit ainda**.
- **Decisões de formato já tomadas com o usuário**: documentação em Markdown dentro do repo (não
  `.docx` formal) e scaffolding de código já incluído nesta primeira entrega (não só documentação).

## Próximo passo

Sprint 0 do roadmap — fundação de auth/RBAC num projeto Supabase real. Ver
[06-roadmap-sprints.md](06-roadmap-sprints.md). Pré-requisito prático: provisionar (ou obter
credenciais de) um projeto Supabase dedicado ao SafeCarbon antes de aplicar a migration inicial.

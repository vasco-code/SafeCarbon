# SafeCarbon

Plataforma da Safe Trace (em parceria com a E2Carbon) para registro de dados de pegada de
carbono, cálculo de reduções de emissões e tokenização de créditos de carbono. Primeiro projeto
suportado: **Premix Fator P — Pecuária Baixo Carbono**.

Este é um projeto novo e independente do Conecta Pecuária — ver a justificativa técnica completa
em [docs/01-contexto-e-decisao-arquitetura.md](docs/01-contexto-e-decisao-arquitetura.md). Reusa,
como serviços externos, a API geoespacial **SafeGisTrace** e a **camada de blockchain própria da
Safe Trace**.

## Documentação de planejamento

**Começando agora numa sessão nova (Claude Code ou não)? Leia primeiro
[docs/00-handoff-sessao.md](docs/00-handoff-sessao.md).** É o documento de transição que resume
tudo que uma sessão anterior (rodada a partir do repo do Conecta Pecuária, antes deste projeto ter
sua própria raiz de sessão) descobriu e decidiu — inclui achados sobre os documentos-fonte, lições
de engenharia herdadas e o estado exato em que o scaffold foi deixado.

| Documento | Conteúdo |
|---|---|
| [00-handoff-sessao.md](docs/00-handoff-sessao.md) | Transição de sessão — leia primeiro se está retomando o projeto |
| [01-contexto-e-decisao-arquitetura.md](docs/01-contexto-e-decisao-arquitetura.md) | Contexto do projeto e argumento técnico da decisão de arquitetura |
| [02-requisitos-funcionais.md](docs/02-requisitos-funcionais.md) | Os 5 pontos indispensáveis, traduzidos em módulos e funcionalidades |
| [03-modelo-de-dados.md](docs/03-modelo-de-dados.md) | Schema Postgres completo, com racional de cada tabela |
| [04-arquitetura-tecnica-integracoes.md](docs/04-arquitetura-tecnica-integracoes.md) | Stack, integração SafeGisTrace e contrato com a camada blockchain |
| [05-motor-de-calculo.md](docs/05-motor-de-calculo.md) | As 9 etapas de cálculo de créditos, generalizadas e parametrizadas |
| [06-roadmap-sprints.md](docs/06-roadmap-sprints.md) | Sequenciamento de entrega, com critérios de aceite ligados aos dados reais da Premix |

## Estrutura do repositório

```
src/
  modules/
    metodologia/               → Requisito 1 (Central de Metodologias)
    projetos/                  → Requisito 2 (DCP)
    producao-comercializacao/  → base para Requisitos 3 e 5
    inventario-emissoes/       → Requisito 4 (inventário + vazamentos)
    creditos/                  → Requisito 5 (motor de cálculo + verificação)
  lib/supabase.ts              → cliente Supabase
  types/database.ts            → tipos do schema (placeholder até gerar do projeto real)
supabase/
  migrations/                  → schema inicial (docs/03-modelo-de-dados.md)
  functions/                   → Edge Functions (ver docs/04)
docs/
  fontes-e2carbon/             → DCP, Metodologia e Resumo de Cálculo originais (preservados)
```

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencher com credenciais do projeto Supabase do SafeCarbon
npm run dev
```

O app ainda não tem um projeto Supabase real provisionado — as páginas em `src/modules/` são
esqueletos de navegação até a migration inicial ser aplicada num projeto Supabase e as telas
receberem a lógica de cada sprint (ver roadmap).

## Status

Scaffolding inicial + planejamento completo. Próximo passo: Sprint 0 do roadmap (fundação de
auth/RBAC) — ver [docs/06-roadmap-sprints.md](docs/06-roadmap-sprints.md).

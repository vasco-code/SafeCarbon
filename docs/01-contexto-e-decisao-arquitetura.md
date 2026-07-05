# SafeCarbon — Contexto e Decisão de Arquitetura

## 1. Contexto

A **Safe Trace** (safetrace.com.br) fechou parceria com a **E2Carbon** (e2carbon.com.br) para
construir uma plataforma de registro de dados de pegada de carbono, cálculo de reduções de
emissões e tokenização de ativos de carbono, com ambição de ser referência do setor — ou seja,
não uma ferramenta de uso único, mas um produto capaz de suportar múltiplos projetos de crédito
de carbono, de múltiplos proponentes, ao longo do tempo.

O primeiro projeto a rodar na plataforma é o **Projeto Premix Fator P — Pecuária Baixo Carbono**,
desenvolvido pela E2Carbon para a **Premix Nutrição Animal Ltda.** (Ribeirão Preto/SP). A E2Carbon
já produziu três documentos técnicos que servem de especificação funcional de facto para o
sistema:

| Documento | Papel |
|---|---|
| `DCP (1).docx` | Documento de Concepção de Projeto (DCP/PDD) completo — 13 seções + 2 anexos |
| `resumo-cálculo (1).docx` | Resumo executivo do cálculo de créditos elegíveis 2025 |
| `Metodologia-fatorP (1).docx` | Metodologia formal, desenhada para ser **reutilizável e renovável anualmente**, com seções específicas sobre atualização controlada de parâmetros |

Cinco pontos foram declarados indispensáveis pelo negócio:

1. **Metodologia** disponível para consulta dos usuários
2. **DCP** (Documento de Concepção de Projeto)
3. **Resumo do cálculo**
4. **Inventário de emissões** (o tópico de vazamentos dentro do DCP cobre a análise de leakage;
   o cálculo em si do inventário operacional está no Anexo I do DCP — o sistema precisa cobrir os
   dois: inventário de emissões operacionais **e** avaliação de vazamentos)
5. **Créditos elegíveis** (Seção 7 do DCP — cálculo e emissão dos créditos de carbono)

Também há dois requisitos de integração explícitos, dados pelo próprio negócio, que não estão em
discussão nesta decisão — são constraints, não opções:

- **A** — usar as APIs geoespaciais do que foi chamado de "ConectaGIS" (ver nota abaixo)
- **B** — usar a camada de blockchain própria da Safe Trace para tokenização dos créditos

> **Nota sobre "ConectaGIS":** investigação no código do Conecta Pecuária mostrou que não existe
> um módulo interno com esse nome. O que existe é a **SafeGisTrace**, uma API externa de
> geoprocessamento/compliance (PRODES, embargos IBAMA, terras indígenas, MapBiomas, elegibilidade
> EUDR/Boi na Linha) já operada pela Safe Trace e consumida pelo Conecta Pecuária via Edge
> Functions (`get-external-token`, `gisService.ts`) e tabelas de cache (`gis_solicitations`,
> `gis_analyses`, `gis_geojsons`). É essa API que será reutilizada — não um módulo de mapas
> genérico. Ver [04-arquitetura-tecnica-integracoes.md](04-arquitetura-tecnica-integracoes.md).

## 2. As três opções em avaliação

O pedido original colocou três caminhos possíveis:

- **(A) Novo projeto do zero** — codebase, banco de dados e produto totalmente independentes do
  Conecta Pecuária.
- **(B) Extensão do Conecta** — o carbono da Premix vira mais um módulo dentro do app e do schema
  já existentes do Conecta Pecuária (ao lado de Varejo, Indústria, Protocolos, Compra de Gado).
- **(C) Híbrido** — um módulo nascido dedicado exclusivamente a carbono, mas ainda vivendo dentro
  do mesmo produto/app/organização Supabase do Conecta.

Para decidir isso com base em fatos e não em intuição, o Conecta Pecuária foi auditado
diretamente (código-fonte, migrations, contexts de auth). O resultado está resumido na tabela
abaixo.

## 3. O que o Conecta Pecuária realmente é

O Conecta Pecuária é, na sua totalidade, uma **plataforma de rastreabilidade de cadeia de gado**
para frigoríficos/Bayer/Frigol. Isso não é um detalhe cosmético — está entranhado em cada camada:

| Dimensão | Como o Conecta Pecuária modela isso hoje | Por que isso não serve para a Premix |
|---|---|---|
| **Unidade de tenant** | `places` (fazenda, identificada por CAR — Cadastro de Imóvel Rural) | A Premix não é uma fazenda. É uma planta industrial que produz um insumo (toneladas de aditivo) e o vende para milhares de fazendas-clientes. Não existe conceito de "planta industrial" no schema. |
| **Rastreabilidade** | `individual_animals`, `manejos`, `movements` — cada linha é um animal ou evento de um animal | A Premix não rastreia animais. Rastreia **lotes de produção** (toneladas) e **notas fiscais de venda**. Não existe tabela de produção industrial, SKU, lote de fabricação ou NF-e no schema atual. |
| **Cálculo de carbono já existente** | `carbonCalculator.ts` + `PainelESG.tsx` + tabela `resultado_carbono`: pegada de carbono **por animal** (kg CO₂eq/kg de peso vivo), a partir de CH₄ entérico por animal, N₂O de dejeto/solo e estoque de carbono do solo — é o **Protocolo Bayer CBC**, que já usa IPCC Tier 2, mas na ponta do produtor rural | A metodologia Fator P é o oposto: **não mede fazenda por fazenda**. É uma metodologia corporativa "production-based accounting" — a unidade de quantificação é a tonelada de aditivo produzida e comercializada pela indústria, com estimativa agregada de cobertura animal (variável intermediária, não creditável). Motor de cálculo, inputs e granularidade são inteiramente diferentes. |
| **Documentos oficiais** | e-GTA (Guia de Trânsito Animal) | NF-e (nota fiscal eletrônica) de venda do aditivo — tipo de documento diferente, com regras de parsing/validação diferentes |
| **Delegação multi-tenant** | `sourceUserId` (varejista "vê como" frigorífico) — é um padrão de **visualização delegada read-only**, pensado para revenda de carne | A Premix precisa de tenancy operacional real entre **proponente (Premix)**, **desenvolvedor técnico/MRV (E2Carbon)**, **verificador independente (VVB)** e **operador de plataforma/registro (Safe Trace)** — papéis com permissões de escrita e fluxos de aprovação distintos, não apenas "ver os dados de outro". |
| **Protocolos existentes** | CBC, EUDR, Boi na Linha, ILPF — todos protocolos de **uso da terra/manejo de fazenda** | Fator P é um protocolo de **produto industrial + comercialização**, categoria IPCC diferente na prática de implementação (mesmo estando os dois em AFOLU/3.A no papel) |
| **Blockchain** | Inexistente no Conecta Pecuária | Requisito novo, do zero, para qualquer um dos três caminhos |

Conclusão objetiva: **não é o mesmo domínio de dados**. Forçar a Premix dentro do schema do
Conecta significaria ou (a) sobrecarregar `places`/`individual_animals`/`manejos` com campos que
não fazem sentido para uma fábrica (dívida técnica imediata), ou (b) criar um segundo conjunto de
tabelas paralelo dentro do mesmo schema — que é, na prática, "opção C" com o custo de acoplamento
de "opção B" sem nenhum benefício real de reuso de dados (porque não há dados para reusar entre
os dois domínios).

## 4. O que de fato vale a pena reaproveitar

A pergunta certa não é "reusar o Conecta?" — é "quais **capacidades** de infraestrutura já
validadas pela Safe Trace valem a pena reaproveitar, independente de onde o carbono da Premix
morar?". Três coisas, especificamente:

1. **SafeGisTrace como API** — não como código, como *serviço*. O Conecta já prova que dá para
   consumir essa API via Edge Function + token OAuth de outro projeto Supabase. O SafeCarbon faz
   o mesmo: chama a API, não importa o módulo.
2. **Lições de engenharia já pagas em produção** (memória do Conecta):
   - RLS: nunca deixar uma policy `USING (true)` coexistindo com policies restritivas na mesma
     tabela/operação (causou vazamento de isolamento de fazendas em produção — ver
     `feedback_security_rls.md`).
   - Imports: usar sempre `@/` e nunca misturar com `./contexts/` relativo, para não duplicar
     instâncias de Context no bundler.
   - Filtros com centenas de UUIDs na URL geram erro 414 → tratado como CORS; resolver com RPC de
     POST em vez de `?id=in.(...)` gigante.
3. **Infraestrutura Supabase self-hosted da Safe Trace** (`supabase.safetrace.com.br`) — a Safe
   Trace já opera essa infra para o Conecta. Não é necessário provisionar um novo host: o
   SafeCarbon pode nascer como **um projeto Supabase separado dentro da mesma organização/infra**,
   o que é uma decisão puramente operacional (custo, backup, observabilidade compartilhados) e não
   compromete o isolamento de schema.

Nenhuma dessas três coisas exige que o SafeCarbon seja um módulo *dentro* do app React do Conecta
Pecuária, nem que compartilhe tabelas com ele.

## 5. Decisão

**SafeCarbon nasce como projeto novo e independente**: codebase própria (`/Users/vasco/SafeCarbon`),
schema Postgres próprio, app React/Vite próprio — mas **não isolado de infraestrutura**: consome a
SafeGisTrace como API externa e a camada de blockchain da Safe Trace como serviço de tokenização,
e pode viver no mesmo provedor/organização Supabase self-hosted já operado pela Safe Trace.

Isso é, na prática, um meio-termo entre a opção (A) e a opção (C) tal como formuladas
originalmente — mas resolvido no eixo certo: **independência de produto e de modelo de dados**,
com **reuso de infraestrutura e de serviços**, não de módulo de UI nem de tabelas.

### Por que não (B) extensão do Conecta

- O modelo de dados é incompatível na raiz (fazenda/animal vs. planta/produção/NF-e).
- Misturar dois motores de cálculo de carbono completamente diferentes (Tier 2 por animal vs.
  production-based por tonelada) no mesmo `carbonCalculator.ts` ou schema é uma fonte garantida de
  bugs e de confusão para quem for auditar/verificar (VVB) — auditabilidade é requisito central
  dos dois documentos (DCP §5, Metodologia §8).
- O Conecta Pecuária é (e deve continuar sendo) um produto vendido para frigoríficos/Bayer/Frigol.
  Safe Trace vende SafeCarbon para proponentes de projeto de carbono em geral (Premix é o
  primeiro, não o único). Misturar os dois roadmaps de produto cria dependências cruzadas de
  release desnecessárias.

### Por que não (A) "do zero" sem nenhum reuso

- Reimplementar do zero a integração com SafeGisTrace, ignorando que ela já existe, funciona e
  está documentada (protocolo de token, formato de resposta, cache de análises) seria desperdício
  puro.
- Ignorar as lições de RLS/imports/CORS já pagas em produção no Conecta é repetir bugs já
  resolvidos.

### Por que isso conta como "híbrido" de forma honesta

O híbrido não está em "compartilhar módulo de UI com o Conecta". Está em:

- **Infraestrutura compartilhada** (organização Supabase self-hosted da Safe Trace).
- **Serviços compartilhados** (SafeGisTrace API, e futuramente um único ledger de blockchain que
  pode, se o negócio quiser, também emitir créditos a partir de dados do Conecta Pecuária no
  médio prazo — protocolo CBC já calcula pegada por fazenda, então **o Conecta poderia um dia ser
  um dos "produtores de dados de origem" que alimentam créditos no SafeCarbon**, mas isso é uma
  integração *entre dois produtos*, não uma fusão de codebase).
- **Práticas de engenharia compartilhadas** (RLS, convenções de import, tratamento de payloads
  grandes).

## 6. Consequência prática para este documento de planejamento

A partir daqui, todo o resto do planejamento (requisitos, modelo de dados, arquitetura técnica,
motor de cálculo, roadmap) assume:

- Um novo projeto Supabase (`safecarbon`), com seu próprio schema, RLS e Edge Functions.
- Um novo app Vite/React/TypeScript, independente do repositório do Conecta Pecuária.
- Dois pontos de integração externos e obrigatórios: **SafeGisTrace** (leitura, via API) e
  **camada de blockchain Safe Trace** (escrita, para emissão/tokenização de créditos).
- Um modelo de dados desenhado para ser **genérico o suficiente para múltiplos projetos e
  múltiplas metodologias**, não hardcoded para a Premix/Fator P — porque a ambição declarada é
  "referência do setor", e o segundo projeto de carbono que entrar na plataforma não pode exigir
  reescrever o schema.

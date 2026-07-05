# SafeCarbon — Arquitetura Técnica e Integrações

## 1. Stack

Mesma stack já validada em produção pela Safe Trace no Conecta Pecuária — não por preguiça, mas
porque isso significa zero curva de aprendizado para o time e reuso direto de padrões de
deploy/observabilidade já resolvidos:

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions em Deno)
- **Hospedagem**: instância self-hosted da Safe Trace (mesma organização/infra de
  `supabase.safetrace.com.br`), como **projeto Supabase separado** do Conecta Pecuária — schema e
  credenciais isolados, infra compartilhada.
- **Geração de documento** (DCP, resumo de cálculo, relatórios): geração de DOCX via template
  (biblioteca `docx` em Node, mesma usada pela skill de documentos) + conversão/city para PDF via
  headless Chromium (Puppeteer), rodando como Edge Function ou job assíncrono — consistente com o
  que já estava planejado no Conecta ("PDF generation with Puppeteer", ver memória
  `implementation_notes`).

## 2. Integração com SafeGisTrace (Requisito de negócio "A")

### O que já existe e será reaproveitado

O Conecta Pecuária já resolveu o protocolo de integração com a SafeGisTrace. O SafeCarbon reusa o
mesmo padrão, como **cliente novo** da mesma API (não como código compartilhado):

1. **Autenticação**: token obtido via Edge Function dedicada (equivalente ao
   `get-external-token` do Conecta) — troca de credenciais de serviço por um JWT de curta duração
   para chamar a API SafeGisTrace.
2. **Cliente de API**: módulo `src/services/safegistrace-client.ts` no SafeCarbon, espelhando o
   client já existente (`gisService.ts` no Conecta), com os mesmos endpoints relevantes:
   - `GET /farm/:place_id` — dados de compliance de uma localização
   - `GET /safegistrace/protocols` — protocolos disponíveis
3. **Cache local**: tabela `project_sites` (ver modelo de dados) guarda `safegistrace_analysis_id`
   e os campos relevantes já resolvidos, com TTL de 30 dias — mesmo padrão de cache de
   `gis_analyses` no Conecta, para não rechamar a API a cada carregamento de tela.

### Para que serve no SafeCarbon, especificamente

Diferente do Conecta (onde a SafeGisTrace decide elegibilidade de protocolo por fazenda), no
SafeCarbon o uso é mais limitado e específico:

- **Mapa de distribuição do produto** (DCP Figura 5: "Mapa de distribuição do Fator P por
  localização") — plotar `project_sites` num mapa (MapLibre GL, mesmo padrão do Mapa de
  Fornecedores do Conecta) sem que isso implique nenhuma responsabilidade de compliance sobre
  essas fazendas.
- **Suporte a futuros projetos de carbono que sejam farm-based** (ex.: se o segundo projeto da
  plataforma for de manejo de pastagem em vez de produto industrial) — nesse caso o mesmo
  `project_sites.safegistrace_analysis_id` passa a ser usado para elegibilidade real, não só
  visualização. O schema já suporta isso sem alteração.
- **Não é usado** para o cálculo de créditos da Premix em si — a metodologia Fator P é
  deliberadamente "production-based", não farm-based (DCP §3), então a SafeGisTrace não entra no
  motor de cálculo desse projeto específico.

## 3. Integração com a camada de blockchain da Safe Trace (Requisito de negócio "B")

### Contrato assumido (a confirmar com o time responsável pela camada blockchain)

Como o SafeCarbon é o primeiro consumidor de créditos tokenizados dessa camada (até onde este
levantamento identificou, não há uso de blockchain em nenhum outro produto Safe Trace hoje), a
integração é desenhada como um **adaptador isolado** (`src/services/blockchain-adapter.ts`) com uma
interface mínima e estável, para que o SafeCarbon não acople sua lógica de negócio aos detalhes de
implementação da chain escolhida:

```ts
interface CarbonBlockchainAdapter {
  issueBatch(input: {
    creditIssuanceId: string;
    projectId: string;
    tco2eAmount: number;
    vintageYear: number;
    metadata: Record<string, unknown>; // referência ao DCP, metodologia, verificação
  }): Promise<{ tokenId: string; txHash: string; ledgerRef: string }>;

  retire(input: {
    tokenId: string;
    reason: string;
  }): Promise<{ txHash: string; retiredAt: string }>;

  getStatus(tokenId: string): Promise<{
    status: "active" | "transferred" | "retired";
    owner: string;
  }>;

  verifyTx(txHash: string): Promise<boolean>;
}
```

- Toda chamada de emissão (`issueBatch`) só acontece a partir de um `credit_batch` com status
  `approved` (ou seja, já passou por verificação — nunca tokeniza um cálculo não verificado).
- O resultado (`token_id`, `tx_hash`, `ledger_ref`) é persistido em `blockchain_tokens`,
  imediatamente e de forma idempotente (chave única em `credit_issuance_id`) — se a chamada à
  chain tiver sucesso mas a escrita no Postgres falhar, um job de reconciliação deve conseguir
  buscar o estado real via `getStatus`/`verifyTx` e corrigir, em vez de tokenizar duas vezes.
- **Aposentadoria (retire)** é modelada como ação distinta de emissão, porque créditos vendidos e
  usados (ex.: por um comprador fazendo claim de neutralidade) precisam ficar irreversivelmente
  marcados — isso é o que substitui, em blockchain, o papel que um registro tipo Verra/Gold
  Standard cumpre ao "aposentar" um VCU.

### Ponto de decisão em aberto

Este documento assume que a camada de blockchain expõe (ou vai expor) esses 4 métodos via API/SDK
próprio da Safe Trace. **Isso precisa ser confirmado com quem já opera essa camada** antes da
sprint de implementação da tokenização (ver `06-roadmap-sprints.md`) — o adaptador acima é o
contrato que o SafeCarbon precisa consumir, não uma proposta de como a blockchain deve ser
construída.

## 4. Autenticação e autorização

- Supabase Auth padrão (email/senha + magic link), com tabela `org_members` definindo a que
  organização(ões) cada usuário pertence e `project_roles` definindo o papel por projeto.
- RLS em todas as tabelas de dado sensível usa uma função `has_project_role(project_id, roles[])`
  que verifica `project_roles` do usuário autenticado — nunca `USING (true)` (ver lição registrada
  em `03-modelo-de-dados.md`, seção "Princípios de RLS").
- Papel `platform_admin` (Safe Trace) tem bypass explícito e auditado, não implícito.

## 5. Edge Functions previstas

| Função | Responsabilidade |
|---|---|
| `get-safegistrace-token` | troca credenciais de serviço por token da SafeGisTrace |
| `calculate-credit-cycle` | roda o motor de cálculo (9 etapas) para um `project_id` + `period_year`, grava `credit_calculation_steps` |
| `generate-dcp-export` | monta DOCX/PDF do DCP a partir de `dcp_sections` |
| `generate-resumo-calculo` | monta o resumo narrativo a partir do ciclo calculado |
| `issue-credit-batch` | chama `blockchain-adapter.issueBatch` e persiste `blockchain_tokens` |
| `retire-credit` | chama `blockchain-adapter.retire` |
| `nfe-import` | recebe XML de NF-e, faz parsing e grava `commercialization_documents` |
| `reconcile-blockchain-state` | job periódico que confere `blockchain_tokens` pendentes contra `getStatus`/`verifyTx` |

## 6. O que este documento explicitamente não resolve ainda

- Escolha final de qual chain/ledger a Safe Trace vai operar por baixo do adaptador (não é decisão
  de arquitetura do SafeCarbon, é decisão da camada blockchain).
- Formato exato de resposta da SafeGisTrace para os endpoints usados aqui (o Conecta já tem TODOs
  abertos sobre isso — `parseReportToCache()` em `safegistrace-client.ts` — vale alinhar com a
  mesma equipe em vez de redescobrir).
- Se e quando o SafeCarbon vai efetivamente se integrar ao Verra/Gold Standard/MBRE via API deles
  (hoje esses padrões não têm API pública padronizada de submissão; isso tende a continuar sendo
  processo manual + documentos exportados por bastante tempo).

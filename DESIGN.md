# Design

Sistema visual do SafeCarbon — aplica-se ao dashboard autenticado (registro `product`) e, com o
mesmo vocabulário mas peso visual elevado, às páginas públicas de verificação por QR code (registro
`brand`-leve — ver PRODUCT.md).

## Por que este sistema

Tema anterior era 100% dark (`#0b1120`) — sinalizado pelo usuário como contra-intuitivo para um
produto de sustentabilidade/emissões usado em escritório, horário comercial. Trocado por um tema
**claro** (branco puro, não um cinza morno). A cor de marca **não é verde** — verde-sobre-creme é
justamente o reflexo de primeira ordem que qualquer IA cairia para "app de carbono"; em vez disso,
um violeta/índigo profundo carrega a identidade (lê como instrumento de precisão, não como folheto
de sustentabilidade), com um teal claro de acento. Verde e vermelho continuam existindo — só como
**cores semânticas de estado** (sucesso/erro), nunca como identidade de marca. Todos os pares
texto/fundo abaixo foram verificados via contraste WCAG real (conversão OKLCH → sRGB → luminância
relativa), não estimados visualmente.

## Cores (OKLCH)

```css
:root {
  /* Superfície */
  --sc-bg: oklch(1.000 0.000 0);           /* branco puro */
  --sc-surface: oklch(0.970 0.008 269);     /* painéis, cards — violeta quase imperceptível */
  --sc-surface-2: oklch(0.945 0.010 269);   /* cabeçalho de tabela, nav — um nível mais escuro */
  --sc-border: oklch(0.870 0.012 269);

  /* Texto */
  --sc-ink: oklch(0.190 0.012 269);         /* corpo — 18.5:1 contra --sc-bg */
  --sc-muted: oklch(0.500 0.014 269);       /* secundário — 6:1 contra --sc-bg */

  /* Marca */
  --sc-primary: oklch(0.440 0.150 269);     /* violeta/índigo — texto branco, 8:1 */
  --sc-primary-hover: oklch(0.360 0.140 269);
  --sc-primary-dark: oklch(0.300 0.130 269); /* estado pressed / texto branco 14:1 */
  --sc-accent: oklch(0.700 0.130 195);      /* teal claro — texto --sc-ink, 7.4:1 */
  --sc-accent-dark: oklch(0.500 0.130 195); /* teal para texto/ícone sobre branco */

  /* Estado semântico — nunca decoração, só status real */
  --sc-success: oklch(0.500 0.140 145);     /* texto branco, 5.65:1 */
  --sc-success-bg: oklch(0.950 0.045 145);
  --sc-danger: oklch(0.520 0.180 25);       /* texto branco, 6:1 */
  --sc-danger-bg: oklch(0.955 0.045 25);
  --sc-warning: oklch(0.680 0.150 70);      /* texto --sc-ink, 6.2:1 */
  --sc-warning-bg: oklch(0.960 0.050 70);
}
```

**Regra de texto sobre preenchimento**: `--sc-primary`/`--sc-primary-dark`/`--sc-success`/
`--sc-danger` sempre levam texto branco (`#fff`/`oklch(1 0 0)`). `--sc-accent`/`--sc-warning` sempre
levam `--sc-ink` (texto claro sobre eles fica com contraste insuficiente — já verificado). Nunca
decidir "no olho" — os números acima já passaram pela conta.

**Contraste primary-vs-accent = 3.24** (mínimo pedido: 1.7) — as duas cores de marca são
claramente distintas em matiz E luminosidade, nunca confundíveis lado a lado (ex.: badge de status
usando accent ao lado de um botão primary).

## Tipografia

Uma família só: **Inter** (fallback `system-ui, -apple-system, "Segoe UI", sans-serif`) — permitido
e recomendado pelo registro `product` (não é o mesmo caso do registro `brand`, onde Inter é reflexo
de treinamento a evitar). Boa legibilidade em tamanhos pequenos e ótimo suporte a algarismos
tabulares, essencial num produto com tabelas densas de números.

Segunda pilha, só para strings técnicas (hash de transação, `token_id`, chave de NF-e, CAR, UUID) —
nunca para UI geral: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`.

Escala fixa em `rem`, razão ~1.2 (produto, não brand — nada de `clamp()` fluido em heading):

```css
--sc-text-xs: 0.75rem;    /* 12px — legendas, badges */
--sc-text-sm: 0.8125rem;  /* 13px — labels, texto secundário */
--sc-text-base: 0.9375rem;/* 15px — corpo, inputs, tabela */
--sc-text-lg: 1.125rem;   /* 18px — h2 */
--sc-text-xl: 1.375rem;   /* 22px — h1 de página */
--sc-text-2xl: 1.75rem;   /* 28px — número grande de destaque (ex.: tCO2e final) */
```

`font-feature-settings: "tnum" 1` em qualquer elemento que mostra números tabulares (tabelas,
valores de etapas de cálculo) — algarismos de largura igual, essencial para comparar números
alinhados numa coluna.

## Espaçamento e forma

Escala em `rem`, base 4px: `0.25 0.5 0.75 1 1.5 2 3 4`. Raio de borda `8px` em cards/inputs/botões,
`4px` em badges/pills — nem "brutalista" (0), nem "fofo" (16px+). Sombra única e sutil para
elevação (`0 1px 2px oklch(0.19 0.012 269 / 0.06), 0 1px 1px oklch(0.19 0.012 269 / 0.04)`), nunca
glassmorphism/blur decorativo.

## Componentes

- **Botão primário**: fundo `--sc-primary`, texto branco, hover `--sc-primary-hover`, radius 8px.
  Um único estilo de botão primário em todo o app — nunca dois botões "salvar" com aparência
  diferente em telas distintas.
- **Botão secundário**: fundo transparente, borda `--sc-border`, texto `--sc-ink`, hover
  `--sc-surface-2`.
- **Botão destrutivo** (novo — CRUD completo pede exclusão): fundo transparente, texto
  `--sc-danger`, borda `--sc-danger` a 30% opacidade, hover fundo `--sc-danger-bg`. Sempre com
  confirmação (nunca exclusão de um clique só).
- **Badge de status**: pílula (`radius 4px`, `padding 0.125rem 0.5rem`), fundo `-bg` da cor
  semântica + texto/ícone da cor semântica escura — nunca só a cor sólida com texto branco pequeno
  (perde legibilidade em badges pequenos), e nunca só cor sem texto (regra de acessibilidade).
- **Tabela**: cabeçalho `--sc-surface-2`, `tnum` nos valores numéricos, hover de linha sutil.
  Toda linha de dado primário com ação de editar/excluir mostra os dois ícones só no hover da linha
  (não ocupa espaço permanente em telas com muitas linhas).
- **Formulário**: label acima do campo (nunca placeholder-como-label), campo com borda
  `--sc-border`, foco com anel `--sc-primary` a 2px. Erro de validação: borda `--sc-danger` + texto
  de erro abaixo do campo (nunca só a borda vermelha sem texto).
- **Estado vazio**: sempre com uma frase explicando o que vai aparecer ali e, quando fizer sentido,
  o botão de ação primária daquela tela — nunca só "Nada aqui".
- **Selo de verificação pública** (páginas de QR code): cartão central, `--sc-success`/
  `--sc-danger` grande com ícone + palavra (verificado/inválido), nunca cor sozinha; abaixo, os
  dados do crédito em pares label/valor com `tnum`, `tx_hash`/`token_id` em mono com botão de copiar.

## Motion

150–250ms, `ease-out` (curva expo/quart, sem bounce). Só para feedback de estado (loading, salvo,
erro) — nunca coreografia decorativa de carregamento de página. Sempre com alternativa para
`prefers-reduced-motion: reduce` (crossfade instantâneo).

## Layout

Nav superior fixa (já existente) mantém-se — é o padrão esperado em produto B2B. Conteúdo em
container `max-width: 1100px` (aumentado de 960px — várias telas têm tabelas largas, ex.: etapas do
motor de cálculo com 4 colunas de texto). Sidebar não é necessária neste estágio (poucos módulos por
projeto); revisitar se o menu crescer.

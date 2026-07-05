# Product

## Register

product

Nota: a maior parte da superfície (dashboard autenticado) é `product`. Existe uma superfície
secundária deliberadamente `brand` — as páginas públicas de verificação de crédito via QR code
(sem login, vistas por auditores, compradores de crédito, imprensa) — tratada com
`reference/brand.md` além deste PRODUCT.md, porque ali design carrega peso de confiança/legitimidade
para um público que nunca viu o produto antes.

## Users

- **Safe Trace (platform admin)** — opera a plataforma, bypassa isolamento por projeto, agenda
  verificações, administra usuários. Uso frequente, alta familiaridade com o domínio.
- **E2Carbon (developer/consultoria técnica)** — lança dados de produção/comercialização/inventário,
  roda o motor de cálculo, edita o DCP, gera relatórios, emite/aposenta créditos. É quem passa mais
  tempo dentro do produto, em sessões de trabalho concentradas (lançamento de dados, cálculo,
  documentação) — precisão e eficiência de formulário importam mais que qualquer efeito visual.
- **Proponente (ex.: Premix)** — dono do projeto, principalmente lê (status, resumos, DCP), lança
  produção/comercialização. Menor familiaridade técnica com MRV que a developer.
- **Verificador independente (VVB)** — acesso de leitura amplo + registra parecer/aprovação. Precisa
  de confiança de que os números não foram editados depois do cálculo (rastreabilidade visível).
- **Público externo (sem login)** — qualquer pessoa que escaneia o QR code de um crédito emitido:
  compradores de crédito fazendo diligência, auditores, imprensa, ONGs. Zero familiaridade com o
  produto, decide em segundos se confia no que está vendo.

## Product Purpose

Plataforma de MRV (monitoramento, relato e verificação) de créditos de carbono para a Safe Trace e
parceiros — registra dados de produção/comercialização, calcula reduções de emissão através de um
motor de cálculo auditável, conduz o fluxo de verificação independente e tokeniza créditos aprovados
em blockchain. Sucesso = um VVB ou auditor externo consegue confiar no número final porque toda a
cadeia de cálculo é rastreável até o dado de origem, nunca digitada à mão — e um comprador de
crédito que escaneia o QR code de um token confirma a legitimidade em segundos, sem precisar
entender o sistema por trás.

## Brand Personality

**Confiável e técnico, claro e acessível.** Não é "sustentabilidade fofa" (verde-claro,
folhinhas, arredondado demais) nem "relatório ESG austero" (cinza corporativo, sisudo, denso). É um
instrumento de precisão que qualquer pessoa consegue ler — mais bancada de laboratório/painel de
controle do que folheto institucional. A confiança vem de clareza numérica, rastreabilidade visível
e hierarquia limpa, não de ornamento.

Para o público externo (páginas de QR code): o mesmo sistema visual, mas com mais peso de
"selo"/certificado — precisa comunicar legitimidade instantânea para quem nunca viu o produto.

## Anti-references

- Fundo preto/dark-mode-por-padrão sem justificativa de contexto de uso — sinalizado explicitamente
  pelo usuário como contra-intuitivo para um produto de sustentabilidade/emissões (não é "app de
  desenvolvedor" nem "ferramenta usada de noite"; é usado em escritório, em horário comercial).
- "Sustentabilidade fofa": tons pastel, ícones de folha, arredondamento excessivo — infantiliza um
  produto que lida com números que decidem se um crédito de carbono é legítimo.
- Relatório corporativo cinza e denso — o oposto do "claro e acessível" pedido.
- Depender de cor isoladamente para comunicar status (ver Acessibilidade).

## Design Principles

1. **Rastreabilidade é a feature visual central.** Todo número calculado precisa parecer
   auditável — de onde vem, quando foi calculado, por quem — nunca um número solto na tela. Isso já
   é um princípio de produto do SafeCarbon (motor de cálculo nunca digitado à mão); o design precisa
   reforçar isso visualmente, não escondê-lo.
2. **Clareza antes de personalidade.** Usuários fazem lançamento de dados técnicos repetidamente;
   fricção de formulário custa mais caro que qualquer floreio visual. Densidade de informação alta,
   ornamento baixo.
3. **A mesma interface serve especialista e não-especialista.** A developer técnica (E2Carbon) e o
   proponente de fazenda (Premix) usam as mesmas telas — hierarquia visual e copy precisam
   funcionar para os dois extremos de familiaridade com o domínio.
4. **O status nunca é só cor.** Todo indicador de status (aprovado/rejeitado, compliance,
   ativo/aposentado) leva texto ou ícone junto da cor — WCAG AA, e também porque "vermelho = ruim"
   simplifica demais um dominio onde nuance (ex.: LF=0 com justificativa é bom, não neutro) importa.
5. **A superfície pública é um certificado, não um dashboard.** A página de verificação por QR code
   troca densidade por clareza absoluta — uma pessoa de fora precisa entender em 5 segundos se o
   crédito é real, sem nenhum contexto prévio do produto.

## Accessibility & Inclusion

WCAG AA como piso: contraste mínimo 4.5:1 para texto de corpo, 3:1 para texto grande. Nunca
comunicar status (compliance, aprovação, LF>0, ativo/aposentado) só por cor — sempre texto, ícone ou
padrão junto. Motion respeita `prefers-reduced-motion`. Foco em usuários com daltonismo dado o uso
frequente de verde/vermelho no domínio de sustentabilidade/compliance.

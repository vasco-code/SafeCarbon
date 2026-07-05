# SafeCarbon — Motor de Cálculo de Créditos

Este documento generaliza as 9 etapas de cálculo descritas no DCP (§4.2 e §7) e na Metodologia
(§6.2) como um motor parametrizável — não uma fórmula hardcoded para a Premix. O motor lê seus
parâmetros de `methodology_parameters` (versionados) e seus dados de entrada de
`production_period_summary`, `emission_inventory_entries` e `leakage_assessments`. A saída de cada
etapa é gravada em `credit_calculation_steps`, uma linha por etapa, nunca só o resultado final.

## Por que isto importa mais do que parece

Uma auditoria dos números do próprio DCP da Premix encontrou **duas seções do mesmo documento
divergindo entre si**:

- **DCP §7.4** ("Redução Estimada para o Ano de 2025"), calculado a partir de `Pfp = 441,57 t`,
  chega em: redução bruta 98.367 tCO₂e → preliminar 97.346 tCO₂e → ajustada 87.611 tCO₂e → **final
  83.230 tCO₂e**. Esse é o número que também aparece no `resumo-cálculo.docx` — os dois batem.
- **DCP §7.9** ("Conclusão Técnica da Quantificação"), no mesmo documento, para o mesmo ano de
  2025, usa `Pfp = 1.476,31 t` — mais de 3× o valor de §7.4 — e chega em números completamente
  diferentes (336.921 → 303.229 → **288.068 tCO₂e**).

Isso não é um erro de arredondamento: é sinal de que a seção §7 do DCP foi escrita colando
resultados de planilhas/rascunhos diferentes em momentos diferentes, sem um sistema único de
verdade reconciliando os dois. É exatamente o tipo de inconsistência que um VVB rejeita numa
verificação — e é exatamente o motivo pelo qual, no SafeCarbon, **a seção de cálculo do DCP é
sempre gerada a partir da última execução do motor, nunca digitada** (ver `dcp_sections.is_generated`
em `03-modelo-de-dados.md`). Não existe "copiar e colar o número" no fluxo do produto.

## As 9 etapas, generalizadas

Notação: `[P]` = parâmetro de `methodology_parameters` da versão vigente; `[D]` = dado lançado
pelo usuário/importado; `[C]` = calculado pela própria etapa.

### Etapa 1 — Produção anual
```
Pfp [D] = SUM(production_records.quantity_kg) do period_year, em toneladas
```
Fonte: `production_period_summary.total_produced_kg`.

### Etapa 2 — Comercialização
```
Fc [C] = Tc_nfe / Pfp                      (a partir de commercialization_documents)
Tc [C] = Pfp × Fc
```
`Fc` **não é digitado** — é derivado da soma real de `commercialization_documents.quantity_kg` do
período dividida pela produção do período. Isso já resolve, por construção, o Requisito 5
("Fc e Fe calculados a partir de NF-e reais, nunca campo livre").

### Etapa 3 — Estimativa de cobertura animal (variável intermediária, não creditável)
```
N_animais [C] = (Tc × 1000) / C_uso[P]
```
`C_uso` = consumo médio anual por animal (`avg_consumption_kg_per_animal_year`, ex.: 1,46 kg/ano
para o Fator P, derivado de dosagem diária × 365). **Este número nunca é a unidade de creditação**
— é só um passo de conversão técnica, como o próprio DCP faz questão de frisar (§3, §4.2 Etapa 3).
O sistema deve rotular esse valor na UI como "estimativa intermediária", nunca como "créditos" ou
"redução".

### Etapa 4 — Emissões na linha de base
```
E_base [C] = N_animais × EF_ch4[P]
```
`EF_ch4` = fator de emissão entérica da linha de base (`baseline_ef_ch4_kg_per_animal_year`, ex.:
70 kg CH₄/cabeça/ano).

### Etapa 5 — Emissões no cenário do projeto
```
E_projeto [C] = E_base × (1 − R[P])
```
`R` = fator médio de mitigação (`mitigation_factor_pct`, ex.: 17%).

### Etapa 6 — Redução bruta de metano
```
Red_CH4 [C] = E_base − E_projeto   (equivalente a E_base × R)
```

### Etapa 7 — Conversão para CO₂e
```
Red_CH4_t [C] = Red_CH4 / 1000
Red_CO2e_bruta [C] = Red_CH4_t × GWP_ch4[P]
```
`GWP_ch4` = potencial de aquecimento global do metano (`gwp_ch4`, ex.: 28, AR5). **O motor grava
explicitamente qual `gwp_version` foi usado** (AR5 vs AR6) junto do resultado — resolve, por
desenho, a mistura de GWP AR5/AR6 encontrada entre o corpo do DCP e o Anexo I.

### Etapa 8 — Subtração das emissões operacionais
```
E_operacionais [D] = SUM(emission_inventory_entries.calculated_tco2e) do period_year
Red_CO2e_preliminar [C] = Red_CO2e_bruta − E_operacionais
```
Se houver vazamento (`leakage_assessments.leakage_factor_pct > 0` para o período), aplicar antes
dos fatores de integridade:
```
Red_CO2e_preliminar_ajustada_LF [C] = Red_CO2e_preliminar × (1 − LF)
```
(No caso Premix, `LF = 0`, então esta subetapa é identidade — mas o motor sempre a executa
explicitamente, nunca pula silenciosamente.)

### Etapa 9 — Fatores de integridade
```
Red_ajustada [C]  = Red_CO2e_preliminar × (1 − uncertainty_discount_pct[P])
Red_final    [C]  = Red_ajustada × (1 − integrity_buffer_pct[P])
```

## Determinação do volume elegível — ponto de ambiguidade resolvido

O DCP define, em §7.5, um "fator de elegibilidade" `Fe = Volume comercializado / Volume produzido`
e diz que "as reduções líquidas calculadas na seção 7 são então ajustadas pelo fator de
elegibilidade: `Reduções elegíveis = Reduções líquidas × Fe`". **Mas isso é matematicamente
redundante com a Etapa 2**, porque `Tc` (e, por consequência, toda a cadeia de cálculo até
`Red_final`) já foi calculada em cima do volume comercializado, não do volume produzido — aplicar
`Fe` de novo multiplicaria pelo mesmo fator duas vezes. No exemplo numérico do próprio DCP (§7.4),
isso passa despercebido porque o `Fe` considerado para 2025 foi `1,0` (por construção do exemplo),
mascarando a duplicação.

**Decisão de design do motor**: `Fc` (Etapa 2) é aplicado uma única vez, e já define o escopo de
todo o cálculo subsequente. `Fe` não é reaplicado como segundo desconto multiplicativo por padrão.
Em vez disso, `Fe`/reconciliação servem para um propósito diferente e mais correto: **excluir do
lote elegível qualquer volume que já tenha sido creditado em ciclo anterior** (`already_credited`
em `commercialization_documents`) e **incluir volume de anos anteriores comercializado agora**
(via `linked_production_period_year`) — isto é, `Fe` é uma correção de *reconciliação temporal*,
não um segundo desconto de comercialização. Isso está alinhado com o que o DCP realmente pede na
prática (§7.5, itens 3 e 6 — reconciliação produção/estoque/comercialização/já creditado) mesmo
que a notação matemática da seção 7.5 sugira, ao pé da letra, uma dupla aplicação.

```
Volume_ja_creditado_neste_ciclo [C] = SUM(quantity_kg WHERE already_credited = true
                                           AND linked to este cycle)
Reducoes_elegiveis_finais [C] = Red_final × (Tc_liquido_de_ja_creditado / Tc)
```

Onde `Tc_liquido_de_ja_creditado` exclui volumes de NF-e já usados em ciclos anteriores. Na
prática, para um projeto operando de forma limpa ciclo a ciclo (sem reprocessamento), esse fator
é `1,0` — mas ele existe no motor para o caso real que a própria metodologia prevê (comercialização
de estoque de safra anterior).

## Saída do motor

Cada execução grava:
- 9 (ou 10, se houver vazamento não-zero) linhas em `credit_calculation_steps`, uma por etapa, com
  `input_values` e `output_value`.
- Uma linha em `credit_batches` com o resultado final (`tco2e_amount`), pronta para entrar no fluxo
  de verificação (`credit_calculation_cycles.status = 'calculated'` → `'in_verification'`).
- Os dados para gerar automaticamente: a seção 7 do DCP (`dcp_sections` com `section_key =
  'calculo_creditos'`, `is_generated = true`), e o `resumo_calculo_documents` (Requisito 3).

## Validações obrigatórias antes de aceitar um ciclo como `calculated`

1. `Tc ≤ Pfp` (não é possível comercializar mais do que foi produzido no período, salvo volume
   explicitamente vinculado a `linked_production_period_year` de um ano anterior).
2. Existe pelo menos uma linha de `emission_inventory_entries` para o `period_year`, ou uma
   justificativa explícita de "sem emissões operacionais aplicáveis" — nunca `E_operacionais`
   implicitamente zero por ausência de dado.
3. Existe uma linha de `leakage_assessments` para o `period_year` — mesmo que conclusão seja
   "vazamento não material, LF=0", a avaliação precisa existir e estar justificada (não pode ser
   omitida).
4. `methodology_version_id` do ciclo é uma versão `published` (nunca calcular sobre uma versão
   `draft` de metodologia).

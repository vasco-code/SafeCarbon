-- ============================================================================
-- Seed do Sprint 0 — organizações, projeto Premix e usuários de teste.
--
-- Pré-requisito: os 4 usuários abaixo já existem em auth.users (criados via
-- Auth Admin API, não por este script — sql puro não cria usuário de auth
-- corretamente, precisa passar pelo GoTrue para hash de senha/e-mail).
--   safetrace.admin@safecarbon.test   -> 7744c5d2-db44-4fe4-bfc5-8ee57e72d6c6
--   e2carbon.tecnico@safecarbon.test  -> eb28003a-1ebb-4a6c-89d3-f9f69b032bde
--   premix.gestor@safecarbon.test     -> 57ad3f0a-3f09-44ef-898b-229a4851dcaa
--   outsider.teste@safecarbon.test    -> f85ec8b3-973f-41ca-aeab-ab7219333692
--     (outsider deliberadamente SEM org_members — é o usuário do critério de
--     aceite "usuário de outra organização não vê nada")
--
-- IDs de organizações/projeto são fixos (prefixo 00000000-...) para o script
-- ser seguro de rodar mais de uma vez (ON CONFLICT DO NOTHING).
-- ============================================================================

insert into organizations (id, name, org_type, tax_id) values
  ('00000000-0000-0000-0000-000000000001', 'Safe Trace', 'platform_operator', null),
  ('00000000-0000-0000-0000-000000000002', 'E2Carbon', 'project_developer', null),
  ('00000000-0000-0000-0000-000000000003', 'Premix', 'proponent', null)
on conflict (id) do nothing;

insert into org_members (org_id, user_id, member_role) values
  ('00000000-0000-0000-0000-000000000001', '7744c5d2-db44-4fe4-bfc5-8ee57e72d6c6', 'owner'),
  ('00000000-0000-0000-0000-000000000002', 'eb28003a-1ebb-4a6c-89d3-f9f69b032bde', 'manager'),
  ('00000000-0000-0000-0000-000000000003', '57ad3f0a-3f09-44ef-898b-229a4851dcaa', 'manager')
on conflict (org_id, user_id) do nothing;

insert into carbon_projects (id, name, proponent_org_id, developer_org_id, status) values
  (
    '00000000-0000-0000-0000-0000000000a1',
    'Premix - Fator P',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'design'
  )
on conflict (id) do nothing;

insert into project_roles (project_id, org_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000003', 'proponent'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000002', 'developer')
on conflict (project_id, org_id, role) do nothing;

-- ============================================================================
-- Seed do Sprint 1 — Central de Metodologias (Requisito 1).
--
-- Conteúdo extraído fielmente de docs/fontes-e2carbon/Metodologia-FatorP-v1.0.docx
-- (metodologia "Redução de Metano Entérico via Aditivo Nutricional" v1.0),
-- condensado por seção mas preservando todos os números e definições da fonte.
-- Parâmetros abaixo replicam o Quadro 4 do DCP: R=17%, EF=70, GWP=28,
-- C_uso=1,46, desconto=10%, buffer=5% (ver docs/06-roadmap-sprints.md).
--
-- IDs fixos (prefixo 00000000-...) para o script ser seguro de rodar mais de
-- uma vez (ON CONFLICT DO NOTHING).
-- ============================================================================

insert into methodologies (id, name, sector, ipcc_category, owner_org_id) values (
  '00000000-0000-0000-0000-0000000000b1',
  'Redução de Metano Entérico via Aditivo Nutricional',
  'AFOLU',
  '3.A - Fermentação Entérica',
  '00000000-0000-0000-0000-000000000002'
) on conflict (id) do nothing;

insert into methodology_versions (id, methodology_id, version_label, status, sections, published_at) values (
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000000b1',
  '1.0',
  'published',
  jsonb_build_object(
    'enquadramento', jsonb_build_object(
      'titulo', 'Enquadramento Metodológico e Limites do Projeto',
      'corpo', $txt$Tipo de projeto: projeto corporativo de redução indireta de emissões de metano entérico (CH₄), baseado na produção e comercialização de aditivo nutricional mitigador.

Setor: AFOLU – Agricultura, Florestas e Outros Usos da Terra. Escopo IPCC: 3.A – Fermentação entérica.

Padrões e referências técnicas: IPCC 2019 Refinement (Tier 2/Tier 3), Verra VM0041/VM0042, Gold Standard – Enteric Methane Reduction (2023), ISO 14064-2 e 14064-3, Diretrizes ICVCM de integridade ambiental.

Tipo de ativo gerado: créditos de carbono verificados (VCUs / GSVERs equivalentes – tCO₂e).

Limites e escopo do projeto (renováveis anualmente): a unidade de quantificação são as toneladas de Fator P produzidas e comercializadas; o limite organizacional são as operações industriais e logísticas da Premix; o limite geográfico é o Brasil; os gases considerados são CH₄ (principal), CO₂ e N₂O (fugitivas); o período de monitoramento é anual; o ciclo de verificação é bienal, com dados anuais consolidados.$txt$
    ),
    'principio_central', jsonb_build_object(
      'titulo', 'Princípio Central da Metodologia',
      'corpo', $txt$O projeto fundamenta-se em uma abordagem corporativa de mitigação indireta de emissões, na qual as reduções são atribuídas à produção e disponibilização em escala de uma tecnologia comprovadamente mitigadora — o aditivo Fator P® — e não à gestão direta de propriedades rurais específicas.

Cada quilo do aditivo produzido gera, de forma mensurável e verificável, uma redução líquida de emissões de metano entérico quando utilizado na alimentação de bovinos de corte ou leite, respeitados os parâmetros técnicos definidos pelo projeto.

O projeto enquadra-se como um projeto de emissões evitadas (avoided emissions): a mitigação ocorre pela substituição de um cenário convencional (dieta sem aditivos mitigadores) por um cenário aprimorado (uso do Fator P®). Apenas reduções líquidas — após dedução integral das emissões da própria cadeia produtiva do aditivo (energia, transporte, resíduos e efluentes) — são elegíveis para geração de créditos.

A metodologia usa parâmetros deliberadamente conservadores (fator de mitigação abaixo do máximo observado experimentalmente, fatores de emissão oficiais do IPCC/Embrapa, descontos de incerteza e buffer de não-permanência) e é renovável ano a ano, já que a unidade de quantificação é a produção anual efetiva.

Síntese da fonte: "A produção anual do aditivo Fator P® representa uma capacidade mensurável, adicional e verificável de redução de emissões de metano entérico na pecuária, sendo essa capacidade a base exclusiva para a geração de créditos de carbono, após o desconto integral das emissões associadas à sua cadeia produtiva."$txt$
    ),
    'linha_de_base', jsonb_build_object(
      'titulo', 'Linha de Base',
      'corpo', $txt$A linha de base representa o cenário contrafactual — a situação que ocorreria na ausência do projeto: sistemas pecuários brasileiros com dietas convencionais, sem aditivos mitigadores de metano entérico, já que não há obrigatoriedade legal para seu uso no Brasil.

A quantificação usa um fator médio conservador de emissão de 70 kg de CH₄ por animal por ano (derivado do IPCC 2019 Refinement e dados da Embrapa), representando uma média entre sistemas a pasto, semiconfinamento e confinamento.

A linha de base é estrutural e estável — não é recalculada todo ano — enquanto não houver regulação obrigando o uso de aditivos mitigadores, os fatores de emissão nacionais permanecerem em faixas compatíveis, e não houver mudança tecnológica generalizada no setor. Revisões, se necessárias, são sempre prospectivas, sem efeito retroativo sobre créditos já emitidos.

Relação matemática: emissões na linha de base = N animais × EF(CH₄, baseline); emissões no cenário do projeto = emissões da linha de base × (1 − R), onde R é a taxa média de redução atribuída ao Fator P.$txt$
    ),
    'fator_mitigacao', jsonb_build_object(
      'titulo', 'Fator de Mitigação',
      'corpo', $txt$O fator de mitigação representa a redução percentual média das emissões de metano entérico atribuível ao uso do Fator P®, frente ao cenário de linha de base.

A metodologia adota um fator médio conservador de 17% de redução das emissões de CH₄ entérico, com base em ensaios controlados, estudos de respirometria e mais de uma década de aplicação comercial do produto — evitando deliberadamente os valores máximos observados experimentalmente.

Aplicação: emissões de CH₄ no projeto = emissões de CH₄ na linha de base × (1 − FM), com FM = 0,17. A redução bruta de metano é convertida em CO₂ equivalente pelo GWP vigente do metano.

O fator não é ajustado automaticamente todo ano; revisões só ocorrem mediante novos estudos científicos robustos, mudança nos padrões de certificação ou evidência de alteração estrutural na eficiência do aditivo — sempre com aplicação prospectiva, validada por terceira parte independente, sem afetar créditos já emitidos.$txt$
    ),
    'estrutura_calculo', jsonb_build_object(
      'titulo', 'Estrutura de Cálculo Anual das Reduções',
      'corpo', $txt$A cada ciclo anual, a empresa fornece: produção total do Fator P (t/ano), consumo energético da planta, dados logísticos de transporte, inventário de resíduos e efluentes, e evidências de rastreabilidade produtiva.

Etapas do cálculo: (1) parte-se do volume anual de produção do aditivo (t/ano); (2) esse volume é convertido em número estimado de animais suplementados, dividindo a massa produzida pelo consumo médio anual por animal (1,46 kg/animal/ano, equivalente a 4 g/animal/dia × 365 dias); (3) calcula-se a emissão de metano que ocorreria na linha de base, aplicando o fator de emissão entérica de 70 kg CH₄/animal/ano; (4) estima-se a redução bruta de metano aplicando o fator de mitigação de 17%; (5) a redução é convertida em tCO₂e usando o GWP₁₀₀ do metano = 28 (IPCC AR5); (6) deduzem-se as emissões operacionais da cadeia produtiva do Fator P® (energia, transporte, processos industriais, resíduos), chegando à redução líquida preliminar; (7) aplicam-se os fatores de integridade — desconto de incerteza de 10% e buffer de integridade de 5% — para chegar ao volume final de reduções elegíveis para geração de créditos, em tCO₂e verificáveis.$txt$
    ),
    'fatores_integridade', jsonb_build_object(
      'titulo', 'Fatores de Integridade',
      'corpo', $txt$Os fatores de integridade asseguram que os créditos representem reduções reais, mensuráveis, adicionais, verificáveis e ambientalmente íntegras — obrigatórios em todos os ciclos anuais, alinhados a ICVCM, Verra, Gold Standard e ISO 14064.

Desconto de incerteza: 10% sobre as reduções líquidas calculadas, para compensar variações estatísticas e limitações de dados primários.

Buffer de não-permanência e risco sistêmico: 5% das reduções líquidas após o desconto de incerteza — conservador, não resgatável e não comercializável, retido como salvaguarda metodológica.

Prevenção de dupla contagem: as reduções são atribuídas exclusivamente à Premix, sem reivindicação simultânea por produtores rurais, clientes finais ou terceiros, e não usadas para cumprimento de metas regulatórias obrigatórias.

Exclusão de sobreposição com políticas públicas: a metodologia assume que, hoje, não há política pública brasileira que obrigue o uso de aditivos mitigadores de metano; caso isso mude, a elegibilidade é reavaliada e os cálculos ajustados prospectivamente.

Todos os fatores permanecem constantes entre ciclos, documentados no sistema MRV, e só são revisados mediante atualização de requisitos das certificadoras, mudança relevante nas boas práticas internacionais ou recomendação de auditor independente — sempre com aplicação prospectiva.$txt$
    ),
    'mrv', jsonb_build_object(
      'titulo', 'Sistema MRV (Monitoramento, Relato e Verificação)',
      'corpo', $txt$O sistema MRV assegura que as reduções sejam mensuradas de forma consistente, reportadas com dados rastreáveis e verificadas por terceira parte independente.

Monitoramento (contínuo): produção do Fator P® (t/ano, registros de produção, controle de qualidade e lotes); consumo energético (elétrico, combustíveis/biomassa); logística e transporte (insumos e distribuição); gestão de resíduos e efluentes; dados de rastreabilidade (período, local de fabricação, documentação fiscal e ambiental). Prioriza-se sempre dado primário medido sobre dado secundário.

Relato (anual): um Relatório de Monitoramento consolida o período, os dados de produção, o cálculo das reduções brutas e líquidas, a aplicação dos fatores de integridade e a demonstração do cumprimento metodológico. Em ciclos bienais, os relatórios anuais são consolidados num Relatório de Verificação submetido ao VVB.

Verificação (bienal ou conforme padrão adotado): conduzida por terceira parte independente acreditada, que avalia consistência metodológica, checa dados e cálculos, revisa a rastreabilidade e os fatores de integridade aplicados, podendo incluir revisão documental remota, entrevistas e visitas in loco. O verificador emite parecer técnico recomendando ou não a emissão dos créditos.

Não conformidades identificadas geram registro formal, ações corretivas, ajuste prospectivo dos cálculos e, se necessário, exclusão de reduções não comprovadas.$txt$
    ),
    'renovacao_anual', jsonb_build_object(
      'titulo', 'Processo de Renovação Anual do Projeto',
      'corpo', $txt$A renovação anual assegura a continuidade metodológica, técnica e ambiental do projeto, permitindo que as reduções sejam quantificadas e acumuladas de forma consistente ao longo do tempo — sem configurar um novo projeto a cada ciclo, apenas a atualização periódica de dados dentro da mesma estrutura metodológica.

Ocorre automaticamente quando, de forma cumulativa: há comprovação auditável da produção anual (coerente com estoques e comercialização); o inventário de emissões operacionais do período foi atualizado; a metodologia foi aplicada sem alteração (linha de base, fator de mitigação e fatores de integridade); e não há exigência regulatória que descaracterize a adicionalidade do projeto.

Etapas: (1) encerramento e consolidação dos dados do ano-base; (2) atualização dos cálculos (animais atendidos, emissões de linha de base, fator de mitigação, dedução da cadeia produtiva, fatores de integridade); (3) elaboração do Relatório Anual de Monitoramento; (4) aprovação técnica interna; (5) acúmulo das reduções ao saldo elegível do projeto, para o próximo ciclo de verificação.

A verificação independente ocorre em ciclos mais longos (tipicamente bienais) que a renovação (anual): as reduções anuais são acumuladas e documentadas, e a verificação valida múltiplos anos de uma só vez. Créditos já emitidos ou reduções já verificadas nunca são afetados retroativamente por mudanças metodológicas posteriores.$txt$
    ),
    'governanca', jsonb_build_object(
      'titulo', 'Governança e Responsabilidades',
      'corpo', $txt$A governança do projeto envolve quatro instâncias principais, com responsabilidades claramente delimitadas:

Empresa proponente (Premix): realiza a produção do aditivo, mantém registros auditáveis, fornece os dados operacionais e ambientais ao MRV, garante conformidade legal/ambiental/fiscal, autoriza a submissão dos dados às certificadoras e define a estratégia de comercialização dos créditos — sendo responsável final pela veracidade dos dados primários.

Consultoria técnica especializada (E2Carbon): desenvolve, mantém e atualiza a metodologia, aplica os cálculos de emissões e reduções, opera o sistema MRV, elabora os relatórios anuais, prepara a documentação para verificação e propõe ajustes metodológicos quando necessário.

Organismo de Verificação Independente (VVB): avalia a conformidade do projeto com a metodologia, verifica a qualidade e rastreabilidade dos dados, valida os cálculos e a aplicação dos fatores de integridade, e emite parecer técnico recomendando ou não a emissão dos créditos — atuando de forma independente e sem conflito de interesses.

Registro / padrão de certificação: avalia a elegibilidade do projeto, registra-o oficialmente, emite os créditos após verificação positiva e garante rastreabilidade, unicidade e aposentadoria (retirement) dos créditos.

Decisões relevantes (mudanças metodológicas, ajustes operacionais, não conformidades, mudanças regulatórias) são formalizadas por registro interno, avaliadas tecnicamente antes de implementação e aplicadas de forma prospectiva.$txt$
    ),
    'resultado_esperado', jsonb_build_object(
      'titulo', 'Resultado Metodológico Esperado',
      'corpo', $txt$O resultado esperado é a geração contínua, verificável e ambientalmente íntegra de créditos de carbono de alta qualidade, oriundos da redução de emissões de metano entérico associada à produção e disponibilização do Fator P®.

Quantitativamente, a metodologia permite quantificar reduções anuais em tCO₂e, convertê-las em créditos certificados e escalar o volume proporcionalmente ao crescimento da produção do aditivo — com lastro real, mensurável e auditável.

Qualitativamente, contribui para a mitigação de um dos principais GEE da pecuária, promove práticas mais eficientes e reduz a intensidade de emissões da produção de carne e leite sem comprometer produtividade.

Institucionalmente, posiciona a Premix como agente ativo de mitigação climática, fortalece sua credibilidade ambiental e permite integração a estratégias ESG e compromissos de neutralidade de carbono.

Os créditos gerados têm valor de mercado reforçado por serem originados de reduções reais e adicionais de metano (GEE de alto impacto climático), tecnologia comprovada em larga escala, rastreabilidade e verificação independente.$txt$
    ),
    'sintese_executiva', jsonb_build_object(
      'titulo', 'Síntese Executiva',
      'corpo', $txt$Este projeto utiliza uma metodologia corporativa robusta, auditável e renovável anualmente, baseada na produção real do aditivo Fator P, com regras claras de integridade, MRV estruturado e alinhamento total aos principais padrões internacionais de créditos de carbono.$txt$
    ),
    'referencias', jsonb_build_object(
      'titulo', 'Referências Bibliográficas',
      'corpo', $txt$IPCC – 2006 IPCC Guidelines for National Greenhouse Gas Inventories, Volume 4 (AFOLU). Hayama: IGES, 2006.

IPCC – 2019 Refinement to the 2006 IPCC Guidelines for National Greenhouse Gas Inventories. Geneva: IPCC, 2019.

GOLD STANDARD FOUNDATION. Gold Standard for the Global Goals – Land Use & Forests Requirements. Geneva, 2020.

GOLD STANDARD FOUNDATION. Methodology: Enteric Methane Reduction. Geneva, 2023.

VERRA. Verified Carbon Standard (VCS) Program – Standard. Version 4. Washington, DC, 2023.

VERRA. VM0041 – Methodology for the Reduction of Enteric Methane Emissions from Ruminants. Washington, DC, 2021.

VERRA. VM0042 – Improved Agricultural Land Management (IALM). Washington, DC, 2022.

ISO. ISO 14064-2: Greenhouse gases — Part 2. Geneva: ISO, 2019.

ISO. ISO 14064-3: Greenhouse gases — Part 3. Geneva: ISO, 2019.

ICVCM. Core Carbon Principles (CCPs). London, 2023.

EMBRAPA. Emissões de metano entérico na pecuária brasileira: bases técnicas e científicas. Brasília, 2018.

EMBRAPA. Inventário nacional de emissões de gases de efeito estufa: setor agropecuária. Brasília: MCTI, 2020.

FAO. Tackling climate change through livestock. Rome, 2013.

GERBER, P. J. et al. Mitigation of greenhouse gas emissions in livestock production. Animal, v. 7, n. s2, p. 220-234, 2013.

HRISTOV, A. N. et al. Mitigation of methane and nitrous oxide emissions from animal operations. Journal of Animal Science, v. 91, n. 11, p. 5045-5069, 2013.

BEAUCHEMIN, K. A.; KREUZER, M.; O'MARA, F.; MCALLISTER, T. A. Nutritional management for enteric methane abatement. Australian Journal of Experimental Agriculture, v. 48, p. 21-27, 2008.

KNAPP, J. R. et al. Enteric methane in dairy cattle production. Journal of Dairy Science, v. 97, n. 6, p. 3231-3261, 2014.

UNFCCC. Methodological tool for the demonstration and assessment of additionality. Bonn, 2014.

WRI; WBCSD. The Greenhouse Gas Protocol: Project Accounting. Washington, DC, 2005.

PREMIX NUTRIÇÃO ANIMAL. Relatórios técnicos internos e estudos de eficiência do aditivo Fator P®. Uso institucional.

UNESP. Estudos de respirometria e avaliação da fermentação ruminal com aditivos nutricionais.$txt$
    )
  ),
  now()
) on conflict (id) do nothing;

insert into methodology_parameters (id, methodology_version_id, param_key, value, unit, source_citation, valid_from) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'mitigation_factor_pct', 17, '%', 'Estudos Premix + Unesp (2023) — ensaios controlados e respirometria da fermentação ruminal', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b2', 'baseline_ef_ch4_kg_per_animal_year', 70, 'kg CH4/animal/ano', 'IPCC 2019 Refinement / Embrapa', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2', 'gwp_ch4', 28, 'adimensional (GWP100, AR5)', 'IPCC AR5', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000b2', 'avg_consumption_kg_per_animal_year', 1.46, 'kg/animal/ano', 'Premix — dosagem média de 4 g/animal/dia x 365 dias', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000b2', 'uncertainty_discount_pct', 10, '%', 'Boas práticas Verra/Gold Standard para projetos de emissões evitadas', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000b2', 'integrity_buffer_pct', 5, '%', 'Buffer de não-permanência e risco sistêmico (salvaguarda metodológica)', '2025-01-01')
on conflict (id) do nothing;

update carbon_projects
set methodology_version_id = '00000000-0000-0000-0000-0000000000b2'
where id = '00000000-0000-0000-0000-0000000000a1'
  and methodology_version_id is distinct from '00000000-0000-0000-0000-0000000000b2';

-- ============================================================================
-- Seed do Sprint 2 — Produção & Comercialização (ciclo 2025 da Premix).
--
-- Números batem com o critério de aceite do roadmap: Pfp = 441,57 t (441570 kg),
-- Tc = 431,02 t (431020 kg) → Fc = 0,9761. São o input real que o motor de
-- cálculo do Sprint 4 vai consumir para chegar em 83.230 tCO2e — não é dado
-- de teste descartável.
--
-- As 3 notas fiscais abaixo têm chave/CNPJ sintéticos (não são NF-e reais da
-- Premix — esses documentos originais não foram fornecidos nesta sessão), mas
-- a soma das quantidades é a soma real de comercialização de 2025.
-- ============================================================================

insert into production_records (id, project_id, period_year, quantity_kg, source) values
  ('e293c0a2-ec38-4c94-8b4a-ddbd04ce078b', '00000000-0000-0000-0000-0000000000a1', 2025, 441570, 'manual_entry')
on conflict (id) do nothing;

insert into commercialization_documents (id, project_id, nfe_key, nfe_number, issue_date, buyer_tax_id, quantity_kg) values
  ('7ca18fd2-32cc-4409-89f6-565af5102d85', '00000000-0000-0000-0000-0000000000a1', '35250111222333000181550010000012341000000123', '1234', '2025-03-15', '11222333000181', 200000),
  ('64167c12-43d3-42dd-b705-a56d77cb75a3', '00000000-0000-0000-0000-0000000000a1', '35250111222333000181550010000012351000000123', '1235', '2025-06-20', '22333444000192', 150000),
  ('7ea0cc45-54e2-4601-be6e-9648af1fa971', '00000000-0000-0000-0000-0000000000a1', '35250111222333000181550010000012361000000123', '1236', '2025-09-05', '33444555000203', 81020)
on conflict (id) do nothing;

-- ============================================================================
-- Seed do Sprint 3 — Biblioteca de fatores de emissão (Requisito 4).
--
-- Fatores de atividade (biomassa, diesel) do IPCC 2006 / GHG Protocol, mais os
-- multiplicadores de GWP como fatores próprios e versionados (gwp_ch4, gwp_n2o)
-- — cada um com gwp_version explícito, para nunca repetir a mistura AR5/AR6
-- não documentada do DCP original (ver docs/03-modelo-de-dados.md). GWP do
-- metano fica em AR5=28, o mesmo valor já fixado como parâmetro da
-- metodologia (Sprint 1); GWP do N2O usa AR6=273 para o inventário
-- operacional (não é parâmetro da metodologia, pode evoluir por versionamento
-- de emission_factors sem tocar em methodology_parameters).
-- ============================================================================

insert into emission_factors (id, category, value, unit, gwp_version, source_citation, valid_from) values
  ('00000000-0000-0000-0000-0000000000d1', 'biomass_ch4', 30, 'kg/TJ', null, 'IPCC 2006 Guidelines, Vol. 2 (Energy)', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000d2', 'biomass_n2o', 4, 'kg/TJ', null, 'IPCC 2006 Guidelines, Vol. 2 (Energy)', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000d3', 'biomass_ncv', 15, 'TJ/Gg', null, 'IPCC 2006 Guidelines, Vol. 2 (Energy) — poder calorífico líquido da lenha', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000d4', 'diesel_co2e', 2.68, 'kg CO2e/L', null, 'GHG Protocol', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000d5', 'gwp_ch4', 28, 'adimensional (GWP100)', 'AR5', 'IPCC AR5 — mesmo valor já fixado em methodology_parameters (Sprint 1)', '2025-01-01'),
  ('00000000-0000-0000-0000-0000000000d6', 'gwp_n2o', 273, 'adimensional (GWP100)', 'AR6', 'IPCC AR6 — factor de inventário operacional, independente da metodologia', '2025-01-01')
on conflict (id) do nothing;

-- ============================================================================
-- Seed do Sprint 3 — Inventário de emissões 2025 da Premix.
--
-- Números batem com o critério de aceite do roadmap: 4.524.860 kg de lenha +
-- 331.956 L de diesel para 2025 → 1.020,77 tCO2e total (131,13 biomassa +
-- 889,64 diesel), consistente com o "~1.021 tCO2e (131,1 + 889,6)" do
-- roadmap. calculated_tco2e replicando exatamente a fórmula que
-- InventarioPage roda no client antes do insert (nunca digitado à mão).
-- ============================================================================

insert into emission_inventory_entries (id, project_id, period_year, source_type, activity_quantity, activity_unit, emission_factor_ids, calculated_tco2e) values
  (
    '00000000-0000-0000-0000-0000000000e1',
    '00000000-0000-0000-0000-0000000000a1',
    2025,
    'biomass_combustion',
    4524860,
    'kg',
    array[
      '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2',
      '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d5',
      '00000000-0000-0000-0000-0000000000d6'
    ]::uuid[],
    131.1304428
  ),
  (
    '00000000-0000-0000-0000-0000000000e2',
    '00000000-0000-0000-0000-0000000000a1',
    2025,
    'diesel_transport',
    331956,
    'L',
    array['00000000-0000-0000-0000-0000000000d4']::uuid[],
    889.64208
  )
on conflict (id) do nothing;

-- ============================================================================
-- Seed do Sprint 3 — Avaliação de vazamentos (leakage) do ciclo 2025.
--
-- As 4 categorias que o DCP §8 já usa como framework, LF=0 em todas com
-- justificativa obrigatória (nunca implícito) — a metodologia da Premix não
-- prevê vazamento relevante hoje, mas o campo já fica pronto para um projeto
-- futuro onde LF>0 (ver docs/02-requisitos-funcionais.md, Requisito 4.2).
-- ============================================================================

insert into leakage_assessments (id, project_id, period_year, category, conclusion, justification, leakage_factor_pct) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 2025, 'rebound_effect', 'Não identificado', 'O uso do Fator P não gera aumento de escala de produção pecuária que compense a mitigação — a redução é por animal suplementado, não por expansão de rebanho.', 0),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 2025, 'technology_substitution', 'Não identificado', 'O aditivo substitui parte da dieta convencional sem deslocar outra tecnologia de mitigação já em uso pelas fazendas-clientes.', 0),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000a1', 2025, 'supply_chain', 'Não identificado', 'Emissões da cadeia produtiva do próprio Fator P (energia, transporte, resíduos) já são deduzidas integralmente no inventário operacional, não no vazamento — sem sobreposição de contabilização.', 0),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000a1', 2025, 'geographic_displacement', 'Não identificado', 'A comercialização é nacional e distribuída (ver SafeGisTrace, Requisito de integração), sem concentração que sugira deslocamento de produção pecuária entre regiões.', 0)
on conflict (id) do nothing;

-- ============================================================================
-- Seed do Sprint 6 — MRV e Verificação: organização VVB, usuário verificador
-- e o ciclo de verificação do período 2025 da Premix.
--
-- Pré-requisito: vvb.auditor@safecarbon.test já existe em auth.users (criado
-- via Auth Admin API) -> 4a76d719-0762-42e2-ac60-9a037f2a460c
-- ============================================================================

insert into organizations (id, name, org_type, tax_id) values
  ('00000000-0000-0000-0000-000000000004', 'EcoVerifica VVB', 'verifier', null)
on conflict (id) do nothing;

insert into org_members (org_id, user_id, member_role) values
  ('00000000-0000-0000-0000-000000000004', '4a76d719-0762-42e2-ac60-9a037f2a460c', 'manager')
on conflict (org_id, user_id) do nothing;

insert into project_roles (project_id, org_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000004', 'verifier')
on conflict (project_id, org_id, role) do nothing;

insert into verification_cycles (id, project_id, period_start_year, period_end_year, vvb_org_id, status) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000a1', 2025, 2025, '00000000-0000-0000-0000-000000000004', 'in_progress')
on conflict (id) do nothing;

-- ============================================================================
-- Seed do Sprint 8 — Distribuição Geográfica (DCP Figura 5).
--
-- Pontos ILUSTRATIVOS de polos pecuários brasileiros onde o Fator P é
-- distribuído — não são geocodificados a partir das NF-e reais (essas NF-e já
-- são sintéticas desde o Sprint 2, sem endereço real do comprador). Servem só
-- para o mapa de distribuição; `safegistrace_analysis_id` fica null porque a
-- metodologia da Premix é production-based, não farm-based (não depende de
-- análise de compliance por local — ver docs/04, seção 2).
-- ============================================================================

insert into project_sites (id, project_id, label, latitude, longitude) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000a1', 'Cuiabá, MT', -15.601400, -56.097900),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-0000000000a1', 'Barretos, SP', -20.557100, -48.567500),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-0000000000a1', 'Uberaba, MG', -19.748600, -47.931800),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-0000000000a1', 'Ribeirão Preto, SP', -21.178500, -47.806900),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-0000000000a1', 'Goiânia, GO', -16.686900, -49.264500)
on conflict (id) do nothing;

-- ============================================================================
-- Seed do Sprint 9 — Hardening multi-projeto: segundo projeto fictício, de
-- domínio genuinamente diferente do Fator P, SEM nenhuma migration nova —
-- só estas linhas de dados. Prova que carbon_projects/methodology_*/
-- production_records/emission_inventory_entries/leakage_assessments/
-- credit_calculation_* acomodam um projeto farm-based (sequestro de carbono
-- via manejo de pastagem) sem qualquer alteração de schema.
--
-- Reaproveita `production_records.quantity_kg` para guardar hectares
-- manejados (não kg) — é exatamente a mesma coluna que a Premix usa para "kg
-- de aditivo produzido": ambas são, na prática, "a unidade primária de
-- quantificação do projeto" (docs/03), só com unidade diferente por domínio.
-- O motor de cálculo deste projeto (calculate-credit-cycle-pasture, Edge
-- Function separada — ver supabase/functions/) lê esse valor sabendo que
-- aqui ele significa hectares, não kg.
-- ============================================================================

insert into organizations (id, name, org_type, tax_id) values
  ('00000000-0000-0000-0000-000000000005', 'Fazenda Santa Fé', 'proponent', null)
on conflict (id) do nothing;

insert into methodologies (id, name, sector, ipcc_category, owner_org_id) values (
  '00000000-0000-0000-0000-000000000301',
  'Sequestro de Carbono via Manejo Rotacionado de Pastagem',
  'AFOLU',
  '3.C - Terras Agrícolas (Manejo do Solo)',
  '00000000-0000-0000-0000-000000000002'
) on conflict (id) do nothing;

insert into methodology_versions (id, methodology_id, version_label, status, sections, published_at) values (
  '00000000-0000-0000-0000-000000000302',
  '00000000-0000-0000-0000-000000000301',
  '1.0',
  'published',
  jsonb_build_object(
    'enquadramento', jsonb_build_object(
      'titulo', 'Enquadramento Metodológico',
      'corpo', $txt$Projeto farm-based de remoção de carbono via manejo rotacionado de pastagem — recuperação de pastagens degradadas com pastejo rotacionado, aumentando o estoque de carbono orgânico do solo (COS).

Setor: AFOLU. Escopo IPCC: 3.C (Terras Agrícolas — Manejo do Solo).

Unidade de quantificação: hectares sob manejo rotacionado, por ano — diferente da Premix (que quantifica por tonelada de aditivo produzido), mas armazenada na mesma coluna do schema (production_records.quantity_kg), provando que o modelo de dados não amarra a semântica da unidade a um domínio específico.$txt$
    ),
    'principio_central', jsonb_build_object(
      'titulo', 'Princípio Central',
      'corpo', $txt$O manejo rotacionado de pastagem (períodos de pastejo intercalados com descanso) aumenta a cobertura vegetal e o aporte de matéria orgânica ao solo, elevando o estoque de carbono orgânico em relação à pastagem degradada convencional (linha de base).

A remoção líquida de CO₂ é calculada aplicando uma taxa de sequestro conservadora por hectare manejado, descontadas as emissões operacionais da própria atividade de manejo (combustível para maquinário, cercas, deslocamento) e os fatores de integridade (incerteza e permanência).$txt$
    ),
    'fatores_integridade', jsonb_build_object(
      'titulo', 'Fatores de Integridade',
      'corpo', $txt$Desconto de incerteza: 15% sobre o sequestro líquido — maior que o das metodologias de emissão evitada (ex.: 10% da Premix), porque a mensuração de carbono no solo tem variabilidade espacial maior que a mensuração direta de produção industrial.

Buffer de permanência: 20% — reflete o risco de reversão (ex.: retorno a manejo convencional, seca, incêndio) inerente a projetos de remoção baseados em solo, sensivelmente maior que o risco de não-permanência de um projeto de emissão evitada (ex.: 5% da Premix). Cada metodologia define seu próprio buffer, sem qualquer alteração de schema — `integrity_buffer_pct` é só mais uma linha em `methodology_parameters`.$txt$
    ),
    'mrv', jsonb_build_object(
      'titulo', 'MRV',
      'corpo', $txt$Monitoramento anual da área efetivamente sob manejo rotacionado (hectares) e das emissões operacionais associadas (combustível, insumos). Verificação independente nos mesmos moldes do projeto Premix — mesmo papel `verifier`, mesmo fluxo de `verification_cycles`, sem nenhuma tabela nova.$txt$
    )
  ),
  now()
) on conflict (id) do nothing;

insert into methodology_parameters (id, methodology_version_id, param_key, value, unit, source_citation, valid_from) values
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000302', 'sequestration_rate_tco2e_per_ha_year', 2.5, 'tCO2e/ha/ano', 'Literatura de manejo rotacionado de pastagem em solos tropicais (valor conservador ilustrativo)', '2025-01-01'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000302', 'uncertainty_discount_pct', 15, '%', 'Maior variabilidade espacial de estoque de carbono no solo vs. medição direta de produção', '2025-01-01'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000302', 'integrity_buffer_pct', 20, '%', 'Risco de reversão de projetos de remoção baseados em solo (maior que emissão evitada)', '2025-01-01')
on conflict (id) do nothing;

insert into carbon_projects (id, name, proponent_org_id, developer_org_id, methodology_version_id, status) values (
  '00000000-0000-0000-0000-000000000310',
  'Fazenda Santa Fé - Pastagem Rotacionada',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000302',
  'design'
) on conflict (id) do nothing;

insert into project_roles (project_id, org_id, role) values
  ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000005', 'proponent'),
  ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000002', 'developer')
on conflict (project_id, org_id, role) do nothing;

-- 850 "kg" = 850 hectares manejados em 2025 (reaproveitando a coluna, ver nota acima).
insert into production_records (id, project_id, period_year, quantity_kg, source) values
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000310', 2025, 850, 'manual_entry')
on conflict (id) do nothing;

-- 5.000 L de diesel para maquinário/cercas do manejo rotacionado em 2025 —
-- reaproveita o mesmo fator diesel_co2e já seedado no Sprint 3, sem nenhum
-- fator novo: 5000 * 2.68 / 1000 = 13,4 tCO2e.
insert into emission_inventory_entries (id, project_id, period_year, source_type, activity_quantity, activity_unit, emission_factor_ids, calculated_tco2e) values (
  '00000000-0000-0000-0000-000000000312',
  '00000000-0000-0000-0000-000000000310',
  2025,
  'diesel_transport',
  5000,
  'L',
  array['00000000-0000-0000-0000-0000000000d4']::uuid[],
  13.4
) on conflict (id) do nothing;

insert into leakage_assessments (id, project_id, period_year, category, conclusion, justification, leakage_factor_pct) values
  ('00000000-0000-0000-0000-000000000313', '00000000-0000-0000-0000-000000000310', 2025, 'geographic_displacement', 'Não identificado', 'O rebanho permanece na mesma área da fazenda durante o manejo rotacionado — não há deslocamento da pecuária para outra propriedade que anule o sequestro local.', 0)
on conflict (id) do nothing;

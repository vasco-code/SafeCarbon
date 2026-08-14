// Tipos do motor de cálculo de pegada (GHG Protocol). O modelo de dados no
// banco é genérico (ghg_activity_entries com activity_data/computed em JSONB);
// aqui está a tipagem forte que o banco não valida — uma discriminated union
// por source_category, para o registry de cálculo trabalhar com segurança.

export type Scope = 1 | 2 | 3;

// Fase 1: 6 fontes. Fase 2 adiciona industrial_processes/agriculture (mesmo
// padrão: gás + massa emitida direto, GWP faz a conversão). As demais
// (fugitivas, mudança do uso do solo, resíduos sólidos, efluentes) são
// metodologias multi-etapa (FOD de aterro, estoque de carbono, DBO/DQO) que
// exigem tabelas de fator próprias — tratadas fonte a fonte, não em lote.
export type SourceCategory =
  | "stationary_combustion"
  | "mobile_combustion"
  | "fugitive"
  | "electricity_location"
  | "electricity_market"
  | "td_losses_location"
  | "td_losses_market"
  | "thermal_energy_purchased"
  | "business_travel"
  | "commuting"
  | "industrial_processes"
  | "agriculture"
  | "effluents"
  | "solid_waste"
  | "land_use"
  // Escopo 3 — as 15 categorias do GHG Protocol. Cat. 3/6/7 têm cálculo
  // próprio (fator de atividade); as demais seguem o modelo da aba
  // "Categorias de Escopo 3": massa do gás relatada direto × GWP.
  | "purchased_goods"
  | "capital_goods"
  | "fuel_energy_upstream"
  | "transport_distribution_upstream"
  | "waste_generated_operations"
  | "leased_assets_upstream"
  | "transport_distribution_downstream"
  | "processing_sold_products"
  | "use_sold_products"
  | "end_of_life_sold_products"
  | "leased_assets_downstream"
  | "franchises"
  | "investments";

// Categorias de Escopo 3 que usam o modelo genérico de entrada por gás
// (DirectGasEmissionData) — as 12 sem cálculo próprio no app.
export const SCOPE3_GAS_ENTRY_CATEGORIES = [
  "purchased_goods",
  "capital_goods",
  "transport_distribution_upstream",
  "waste_generated_operations",
  "leased_assets_upstream",
  "transport_distribution_downstream",
  "processing_sold_products",
  "use_sold_products",
  "end_of_life_sold_products",
  "leased_assets_downstream",
  "franchises",
  "investments",
] as const;

export type Scope3GasEntryCategory = (typeof SCOPE3_GAS_ENTRY_CATEGORIES)[number];

export const SCOPE_OF_SOURCE: Record<SourceCategory, Scope> = {
  stationary_combustion: 1,
  mobile_combustion: 1,
  fugitive: 1,
  electricity_location: 2,
  electricity_market: 2,
  td_losses_location: 2,
  td_losses_market: 2,
  thermal_energy_purchased: 2,
  business_travel: 3,
  commuting: 3,
  industrial_processes: 1,
  agriculture: 1,
  effluents: 1,
  solid_waste: 1,
  land_use: 1,
  purchased_goods: 3,
  capital_goods: 3,
  fuel_energy_upstream: 3,
  transport_distribution_upstream: 3,
  waste_generated_operations: 3,
  leased_assets_upstream: 3,
  transport_distribution_downstream: 3,
  processing_sold_products: 3,
  use_sold_products: 3,
  end_of_life_sold_products: 3,
  leased_assets_downstream: 3,
  franchises: 3,
  investments: 3,
};

// Setor de atividade — os fatores de CH4/N2O da combustão variam por setor
// (CO2 não). Espelha as 4 colunas da planilha (Fatores de Emissão, K-N/O-R).
export type ActivitySector = "energy" | "manufacturing" | "commercial" | "residential";

export const SECTOR_LABELS: Record<ActivitySector, string> = {
  energy: "Energia",
  manufacturing: "Manufatura ou Construção",
  commercial: "Comercial ou Institucional",
  residential: "Residencial, Agricultura, Florestal ou Pesca",
};

// ---- activity_data por fonte (entrada crua do usuário) ----

export interface StationaryCombustionData {
  fuel_ref_no: number; // ref na tabela ghg_fuel_factors
  quantity: number;
  sector: ActivitySector;
}

export interface MobileCombustionData {
  fuel_ref_no: number;
  quantity: number;
  sector: ActivitySector;
  // Refinamento por frota (Tabelas 6-7): quando informado, CH4/N2O vêm de
  // ghg_fleet_factors (kg/litro, por tipo de veículo e ano da frota) em vez do
  // fator por setor — CH4/N2O de veículos dependem da tecnologia, não do setor.
  // O CO2 segue vindo do combustível em qualquer caso. Sem `fleet_type`, o
  // cálculo é o antigo (por setor) — lançamentos existentes seguem válidos.
  fleet_type?: string;
  fleet_year?: number;
}

export interface ElectricityLocationData {
  mwh: number;
  year: number;
}

// Tipo de fonte de geração (aba "En. elétrica (escolha de compra)", Listas
// Q28:Q34) — as 6 primeiras são renováveis com fator zero; Termoelétrica exige
// combustível + eficiência da planta para derivar o fator.
export const GENERATION_TYPES = [
  "Eólica",
  "Fotovoltaica",
  "Heliotérmica",
  "Geotérmica",
  "Hidroelétrica",
  "Termoelétrica",
  "Maremotriz",
] as const;
export type GenerationType = (typeof GENERATION_TYPES)[number];
export const RENEWABLE_GENERATION_TYPES: readonly GenerationType[] = [
  "Eólica",
  "Fotovoltaica",
  "Heliotérmica",
  "Geotérmica",
  "Hidroelétrica",
  "Maremotriz",
];

export interface ElectricityMarketData {
  mwh: number;
  // Fator do instrumento contratual (I-REC, gerador específico, mix residual),
  // informado pelo usuário — a planilha aceita "fator fornecido pelo gerador".
  // Quando ausente, o motor deriva o fator de `generation_type` (renovável →
  // zero; Termoelétrica → combustível/eficiência), como a planilha faz quando
  // o usuário responde "Não" a "Você possui o fator de emissão?".
  co2_t_mwh?: number;
  ch4_t_mwh?: number;
  n2o_t_mwh?: number;
  generation_type?: GenerationType;
  fuel_ref_no?: number; // só Termoelétrica — ref em ghg_fuel_factors
  plant_efficiency?: number; // 0-1, só Termoelétrica; planilha não tem default (obrigatório)
}

// Escopo 2 — Perdas de transmissão/distribuição da eletricidade comprada da
// rede (abas "Perdas T&D (abord. localização/escolha de compra)"). Mesma
// matemática de ElectricityLocation/MarketData — só a origem da eletricidade
// muda (perda, não consumo direto) — por isso reusam o fator do SIN/fator do
// instrumento em vez de uma tabela própria.
export interface TdLossesLocationData {
  mwh: number; // eletricidade perdida em T&D, oriunda do SIN
  year: number;
}

export interface TdLossesMarketData {
  mwh: number; // eletricidade perdida em T&D, oriunda de fonte com instrumento contratual
  // Mesma derivação opcional de ElectricityMarketData — ver ali.
  co2_t_mwh?: number;
  ch4_t_mwh?: number;
  n2o_t_mwh?: number;
  generation_type?: GenerationType;
  fuel_ref_no?: number;
  plant_efficiency?: number;
}

// Escopo 2 — Compra de energia térmica/vapor (aba "Compra de Energia
// Térmica"). Consumo de combustível (GJ) = vapor comprado (GJ) / eficiência
// do fervedor (0,8 = 80% default da planilha se não informado); emissões =
// consumo × fator kg/TJ do combustível (setor Energia, ghg_fuel_factors,
// ÷1e6 → toneladas) — reusa a mesma tabela de Combustão estacionária, mas
// pelo fator BRUTO por TJ, não pelo já convertido por unidade física (a
// entrada aqui é em GJ, não em litros/kg/m³). A planilha não separa CO2
// biogênico nesta aba (diferente de Combustão estacionária).
export interface ThermalEnergyPurchasedData {
  fuel_ref_no: number; // ref na tabela ghg_fuel_factors
  steam_gj: number; // vapor comprado (GJ)
  boiler_efficiency: number; // 0-1; planilha usa 0,8 como default
}

export interface BusinessTravelData {
  factor_key: string; // faixa aérea (curta/média/longa) em ghg_generic_factors
  distance_km: number; // distância total (km) já somada dos trechos
}

// Casa-trabalho (Escopo 3 Cat. 7). "generic" cobre as Tabelas 1-3 da aba
// (metroferroviário, ônibus, balsa) — fator flat kg/passageiro.km em
// ghg_generic_factors, igual a business_travel. "private_vehicle" cobre as
// Tabelas 4-6 (veículo particular do colaborador, por frota/combustível/
// distância) — a planilha deriva o consumo mensal de combustível com um
// detalhamento de blend etanol/biodiesel por mês; aqui o usuário informa o
// litro/m³/kg total do ano direto (mesma simplificação que mobile_combustion
// já usa) e o motor reusa exatamente ghg_fuel_factors + ghg_fleet_factors —
// zero tabela nova.
export interface CommutingData {
  method?: "generic" | "private_vehicle"; // default "generic" (retrocompatível)
  // generic
  factor_key?: string; // modal em ghg_generic_factors
  passengers?: number;
  distance_km?: number; // por trecho/período, distância total percorrida
  // private_vehicle
  fuel_ref_no?: number; // ref em ghg_fuel_factors
  quantity?: number; // litros/m³/kg de combustível no ano
  fleet_type?: string; // tipo de veículo em ghg_fleet_factors
  fleet_year?: number;
}

// Processos industriais e Agricultura: o usuário relata a massa emitida do
// gás diretamente (não há fator de atividade — a planilha só converte por
// GWP). Emissões/remoções de CO2 biogênico também são digitadas direto
// (ex.: absorção de CO2 por fertilização, liberação por queima de resíduo
// agrícola), não derivadas de um fator.
export interface DirectGasEmissionData {
  gas: string; // chave em ghg_gwp (CO2, CH4, N2O, HFC-23, SF6, ...)
  emitted_t: number; // massa do próprio gás, em toneladas — não CO2e
  biogenic_co2_emissions_t?: number;
  biogenic_co2_removals_t?: number;
}

export type LandUseMethod = "direct" | "detailed";

// Mudança no uso do solo (Escopo 1). "direct" (Fase A) é o relato direto por
// gás da Tabela 3 (mesmo modelo de DirectGasEmissionData) — lançamentos
// antigos não têm `method` e caem aqui por padrão. "detailed" é a Tabela 1
// (diferença de estoque de carbono): Csolo = SOCref×FLU×FMG×FI e Cbm = Cveg,
// por estado × categoria de uso do solo (ghg_lulucf_state_factors, extraída
// de Listas!CZ317:DJ559 — fonte BRLUC v1.3). Emissão/remoção = (estoque
// anterior − posterior) × 44/12 × área; biomassa amortiza a REMOÇÃO em 20
// anos quando o uso posterior é vegetação natural/silvicultura (ou cultura
// perene com biomassa lenhosa) — emissões nunca amortizam, só remoções de
// categorias de crescimento lento. Simplificação Fase A: usa a categoria de
// vegetação natural direto da tabela por estado, sem descer ao nível de
// fitofisionomia por bioma (refinamento opcional "possui a fitofisionomia?"
// da planilha) nem aceitar override manual de estoque de carbono.
export interface LandUseData {
  method?: LandUseMethod; // default "direct" (retrocompatível)
  // direct
  gas?: string;
  emitted_t?: number;
  biogenic_co2_emissions_t?: number;
  biogenic_co2_removals_t?: number;
  // detailed
  uf?: string; // sigla do estado em ghg_lulucf_state_factors
  area_ha?: number;
  previous_use?: string; // land_use_category (uso anterior)
  next_use?: string; // land_use_category (uso posterior)
  perennial_woody_biomass?: boolean; // só quando next_use = "Cultura perene" — ativa amortização de 20 anos na biomassa
}

// As 8 categorias de uso do solo da tabela BRLUC (Listas!CZ317:DJ317).
export const LAND_USE_CATEGORIES = [
  "Cultura anual",
  "Cultura de cana",
  "Cultura perene",
  "Pastagem",
  "Silvicultura",
  "Vegetação natural, não especificada",
  "Vegetação natural, Floresta",
  "Vegetação natural, pastagem",
] as const;

// Emissões fugitivas (Escopo 1) — aba "Emissões fugitivas" da planilha. Todos
// os métodos reduzem a uma MASSA LÍQUIDA de gás (kg), convertida a CO2e só pelo
// GWP do gás (ghg_gwp já tem os 34 gases: HFC/PFC/SF6/NF3 etc.). Três métodos,
// espelhando as Opções 1/2 e a Tabela 5 (SF6/NF3) da planilha:
//  - "lifecycle" (Opção 1, Estágio do Ciclo de Vida):
//      líquido = carga_novas − capacidade_novas + recarga_existentes
//                + capacidade_dispensadas − recuperada
//  - "mass_balance" (Opção 2 + Tabela 5 SF6/NF3, Balanço de Massa):
//      líquido = (estoque_inicial − estoque_final) + transferido − mudança_capacidade
//      (VE + T − MC; para SF6/NF3 a mudança de capacidade é 0)
//  - "direct": massa liberada informada direto (Tabela 6, "estimado a partir
//      de outras ferramentas" / resultado da triagem).
// FORA da Fase A (ficam para depois): compostos/blends (R-410A etc., exigem
// tabela de composição gás→componentes com GWP ponderado) e a Opção 3 Triagem
// por fator de tipo de equipamento (Tabelas 3-4, exigem tabela de fator nova).
export type FugitiveMethod = "lifecycle" | "mass_balance" | "direct";

export interface FugitiveEmissionData {
  gas: string; // chave em ghg_gwp
  method: FugitiveMethod;
  // lifecycle (Opção 1) — kg
  charge_new_kg?: number;
  capacity_new_kg?: number;
  recharge_existing_kg?: number;
  capacity_disposed_kg?: number;
  recovered_kg?: number;
  // mass_balance (Opção 2 / Tabela 5 SF6-NF3) — kg
  stock_initial_kg?: number;
  stock_final_kg?: number;
  transferred_kg?: number; // T = comprado − vendido/dispensado
  capacity_change_kg?: number; // MC = mudança de capacidade (0 para SF6/NF3)
  // direct — kg
  released_kg?: number;
}

// Escopo 1 — Efluentes (aba "Efluentes"). Dois métodos:
//  - "detailed": tratamento único (Passos 3-6 da planilha). Metodologia IPCC:
//      CH4 (t) = Q × (carga_org − carga_removida) × EF_CH4[DBO|DQO] / 1000
//                − CH4_recuperado
//      N2O (t) = Q × N × EF_N2O / 1000, com EF_N2O = (44/28) × (kgN2O-N/kgN)
//      CO2e = 0 se CH4 líquido < 0 (over-recuperação), senão CH4·GWP + N2O·GWP.
//      CO2 biogênico = CH4_recuperado × 44/16 quando o biogás é queimado em flare
//      (o metano do efluente é de origem biogênica).
//  - "direct": relato direto de CO2/CH4/N2O (Tabela 2 da aba, "estimado a
//      partir de outras ferramentas") — CO2e por GWP AR5.
// FORA da Fase A: tratamento sequencial (Passos 7-10) e disposição final
// separada (Passos 11-12); estimativa doméstica per capita (kgDBO/pessoa.dia).
export type EffluentMethod = "detailed" | "direct";

// Uma etapa do caminho do efluente (tratamento sequencial ou disposição
// final). O `domain` (doméstico/industrial) é o mesmo do efluente e fica só na
// etapa 1. Em disposição final, `organic_removed_kg_m3`, `ch4_recovered_t` e
// `biogas_flared` não se aplicam — a planilha não os considera nesse termo.
export interface EffluentStage {
  treatment_type?: string; // chave em ghg_effluent_factors
  volume_m3?: number;
  organic_unit?: "dbo" | "dqo";
  organic_load_kg_m3?: number;
  organic_removed_kg_m3?: number;
  nitrogen_kg_m3?: number;
  ch4_recovered_t?: number;
  biogas_flared?: boolean;
}

export interface EffluentData {
  method: EffluentMethod;
  // detailed
  domain?: "domestic" | "industrial";
  // Origem industrial do efluente (chave em ghg_effluent_nitrogen_defaults) —
  // quando informada, o motor usa o N default do IPCC (VLOOKUP da planilha)
  // em qualquer etapa cujo `nitrogen_kg_m3` fique em branco. Doméstico e
  // "Outros efluentes industriais" não têm default — exigem N manual.
  effluent_type?: string;
  treatment_type?: string; // chave em ghg_effluent_factors
  volume_m3?: number; // Q — vazão anual
  organic_unit?: "dbo" | "dqo";
  organic_load_kg_m3?: number; // carga orgânica degradável
  organic_removed_kg_m3?: number; // removida com o lodo (opcional)
  nitrogen_kg_m3?: number; // N no efluente (opcional → N2O)
  ch4_recovered_t?: number; // CH4 recuperado (opcional)
  biogas_flared?: boolean; // biogás recuperado queimado em flare → CO2 biogênico
  // Etapa 2 — tratamento sequencial (Passos 7-10): um segundo tratamento
  // aplicado ao efluente que sai do primeiro. Mesma matemática da etapa 1.
  sequential?: EffluentStage;
  // Etapa 3 — disposição final (Passos 11-12): o efluente lançado ao ambiente.
  // A planilha NÃO subtrai carga removida nem recuperação de CH4 aqui.
  disposal?: EffluentStage;
  // direct
  co2_t?: number;
  ch4_t?: number;
  n2o_t?: number;
  biogenic_co2_t?: number;
}

// Escopo 1 — Resíduos sólidos (aba "Resíduos sólidos"). Fase A: três métodos
// single-year. O aterro (modelo FOD/First Order Decay, série de 30 anos) fica
// para a Fase B.
//  - "composting": CH4 (t) = massa × EF_CH4[g/kg] × 1e-3 − CH4_recuperado;
//      N2O (t) = massa × EF_N2O[g/kg] × 1e-3. Defaults IPCC: 4 gCH4/kg e
//      0,24 gN2O/kg. CO2e zera se CH4 líquido < 0. CO2 biogênico se biogás
//      recuperado é queimado em flare (CH4_recuperado × 44/16).
//  - "incineration": por categoria de composição — CO2 (t) = 44/12 × frac ×
//      massa × (1 − umidade) × teor_C × fração_fóssil (o restante da fração,
//      1 − fóssil, é CO2 biogênico); "Outros" recebe a fração restante.
//      CH4/N2O do processo por FE (g/t): defaults 0 e 100. CO2 fóssil entra no
//      escopo; biogênico à parte.
//  - "direct": relato de CO2/CH4/N2O (Tabela 4 da aba).
export type SolidWasteMethod = "landfill" | "composting" | "incineration" | "direct";

// Uma linha da série histórica de deposição no aterro. `quality` é a chave
// A-H da classificação do local (ver LANDFILL_QUALITIES) — pode variar ano a
// ano, como na planilha. `composition`, quando informada, vale só para o
// resíduo depositado NESSE ano (a planilha permite composição variar ano a
// ano); se ausente, o ano usa `landfill_composition` (o default da fonte).
export interface LandfillYear {
  year: number;
  waste_t: number;
  quality: string;
  ch4_recovered_t?: number;
  composition?: Record<string, number>;
}

export interface SolidWasteData {
  method: SolidWasteMethod;
  // landfill (modelo FOD) — a emissão do ano inventariado depende da série
  // histórica de deposição, não só do ano corrente. `landfill_composition` é o
  // default aplicado aos anos que não têm `composition` própria (ver
  // LandfillYear) — cobre tanto o caso simples (uma composição para toda a
  // série) quanto o caso completo da planilha (composição por ano).
  inventory_year?: number;
  landfill_composition?: Record<string, number>; // categoria aterrada → % (0-100)
  years?: LandfillYear[];
  // composting
  mass_t?: number;
  ef_ch4_g_kg?: number; // override; default 4
  ef_n2o_g_kg?: number; // override; default 0.24
  ch4_recovered_t?: number;
  biogas_flared?: boolean;
  // incineration
  incinerated_t?: number;
  composition?: Record<string, number>; // categoria ("A - ...") → % (0-100)
  ef_ch4_g_t?: number; // FE de processo; default 0
  ef_n2o_g_t?: number; // FE de processo; default 100
  // direct
  co2_t?: number;
  ch4_t?: number;
  n2o_t?: number;
  biogenic_co2_t?: number;
}

// Escopo 3 Categoria 3 (Atividades relacionadas a combustível e energia) —
// Tabela 1 da aba "Emissões energia (upstream)": WTT (well-to-tank/cradle to
// gate) do combustível já queimado direto (Escopo 1) — a mesma quantidade em
// GJ, um fator próprio (ghg_wtt_fuel_factors, não o de combustão). As
// Tabelas 2-5 dessa aba (WTT da eletricidade/energia térmica comprada, perdas
// T&D) ficam para uma fase seguinte.
export interface FuelEnergyUpstreamData {
  fuel_key: string; // nome em ghg_wtt_fuel_factors
  consumption_gj: number;
}

export type ActivityData =
  | ({ source_category: "stationary_combustion" } & StationaryCombustionData)
  | ({ source_category: "mobile_combustion" } & MobileCombustionData)
  | ({ source_category: "fugitive" } & FugitiveEmissionData)
  | ({ source_category: "electricity_location" } & ElectricityLocationData)
  | ({ source_category: "electricity_market" } & ElectricityMarketData)
  | ({ source_category: "td_losses_location" } & TdLossesLocationData)
  | ({ source_category: "td_losses_market" } & TdLossesMarketData)
  | ({ source_category: "thermal_energy_purchased" } & ThermalEnergyPurchasedData)
  | ({ source_category: "business_travel" } & BusinessTravelData)
  | ({ source_category: "commuting" } & CommutingData)
  | ({ source_category: "industrial_processes" } & DirectGasEmissionData)
  | ({ source_category: "agriculture" } & DirectGasEmissionData)
  | ({ source_category: "effluents" } & EffluentData)
  | ({ source_category: "land_use" } & LandUseData)
  | ({ source_category: "solid_waste" } & SolidWasteData)
  | ({ source_category: "fuel_energy_upstream" } & FuelEnergyUpstreamData)
  | ({ source_category: Scope3GasEntryCategory } & DirectGasEmissionData);

// ---- computed (saída do cálculo, gravada junto no banco) ----

export interface Computed {
  co2_t: number;
  ch4_t: number;
  n2o_t: number;
  // Gases da família HFC/PFC + SF6/NF3, quando a fonte os produzir (fugitivas,
  // processos — fases futuras). gas -> toneladas.
  other_gases_t?: Record<string, number>;
  // CO2 biogênico é reportado SEPARADO e NÃO entra no total de escopo/CO2e —
  // emissões e remoções (absorção) são duas linhas distintas no Resumo.
  biogenic_co2_t: number;
  biogenic_co2_removals_t?: number;
  // CO2e fóssil (exclui biogênico), já convertido por GWP.
  co2e_t: number;
  // Proveniência: quais fatores/versão foram usados, p/ detectar staleness.
  factor_refs: string[];
  ar_version: string;
  factor_year?: number;
}

// Resultado do cálculo — ok com os números, ou erro explícito de fator faltante.
export type CalcResult =
  | { ok: true; computed: Computed }
  | { ok: false; missingFactor: string };

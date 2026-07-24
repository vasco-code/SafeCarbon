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
  | "business_travel"
  | "commuting"
  | "industrial_processes"
  | "agriculture"
  | "effluents"
  | "solid_waste"
  | "fuel_energy_upstream";

export const SCOPE_OF_SOURCE: Record<SourceCategory, Scope> = {
  stationary_combustion: 1,
  mobile_combustion: 1,
  fugitive: 1,
  electricity_location: 2,
  electricity_market: 2,
  business_travel: 3,
  commuting: 3,
  industrial_processes: 1,
  agriculture: 1,
  effluents: 1,
  solid_waste: 1,
  fuel_energy_upstream: 3,
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
  // Fase 1: combustão móvel usa os mesmos fatores de combustível da
  // estacionária (CO2 idêntico por combustível; CH4/N2O por setor — uma
  // aproximação razoável). Fatores por frota/veículo (Tabelas 6-7 da planilha)
  // entram numa fase seguinte via ghg_generic_factors, sem migração.
  fuel_ref_no: number;
  quantity: number;
  sector: ActivitySector;
}

export interface ElectricityLocationData {
  mwh: number;
  year: number;
}

export interface ElectricityMarketData {
  mwh: number;
  // Fator do instrumento contratual (I-REC, gerador específico, mix residual),
  // informado pelo usuário — a planilha aceita "fator fornecido pelo gerador".
  co2_t_mwh: number;
  ch4_t_mwh?: number;
  n2o_t_mwh?: number;
}

export interface BusinessTravelData {
  factor_key: string; // faixa aérea (curta/média/longa) em ghg_generic_factors
  distance_km: number; // distância total (km) já somada dos trechos
}

export interface CommutingData {
  factor_key: string; // modal em ghg_generic_factors
  passengers: number;
  distance_km: number; // por trecho/período, distância total percorrida
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

export interface EffluentData {
  method: EffluentMethod;
  // detailed
  domain?: "domestic" | "industrial";
  treatment_type?: string; // chave em ghg_effluent_factors
  volume_m3?: number; // Q — vazão anual
  organic_unit?: "dbo" | "dqo";
  organic_load_kg_m3?: number; // carga orgânica degradável
  organic_removed_kg_m3?: number; // removida com o lodo (opcional)
  nitrogen_kg_m3?: number; // N no efluente (opcional → N2O)
  ch4_recovered_t?: number; // CH4 recuperado (opcional)
  biogas_flared?: boolean; // biogás recuperado queimado em flare → CO2 biogênico
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
export type SolidWasteMethod = "composting" | "incineration" | "direct";

export interface SolidWasteData {
  method: SolidWasteMethod;
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
  | ({ source_category: "business_travel" } & BusinessTravelData)
  | ({ source_category: "commuting" } & CommutingData)
  | ({ source_category: "industrial_processes" } & DirectGasEmissionData)
  | ({ source_category: "agriculture" } & DirectGasEmissionData)
  | ({ source_category: "effluents" } & EffluentData)
  | ({ source_category: "solid_waste" } & SolidWasteData)
  | ({ source_category: "fuel_energy_upstream" } & FuelEnergyUpstreamData);

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

// Tipos do motor de cálculo de pegada (GHG Protocol). O modelo de dados no
// banco é genérico (ghg_activity_entries com activity_data/computed em JSONB);
// aqui está a tipagem forte que o banco não valida — uma discriminated union
// por source_category, para o registry de cálculo trabalhar com segurança.

export type Scope = 1 | 2 | 3;

// Fase 1: 6 fontes. As demais entram em fases seguintes só adicionando novos
// valores aqui + uma função no registry, sem migração.
export type SourceCategory =
  | "stationary_combustion"
  | "mobile_combustion"
  | "electricity_location"
  | "electricity_market"
  | "business_travel"
  | "commuting";

export const SCOPE_OF_SOURCE: Record<SourceCategory, Scope> = {
  stationary_combustion: 1,
  mobile_combustion: 1,
  electricity_location: 2,
  electricity_market: 2,
  business_travel: 3,
  commuting: 3,
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

export type ActivityData =
  | ({ source_category: "stationary_combustion" } & StationaryCombustionData)
  | ({ source_category: "mobile_combustion" } & MobileCombustionData)
  | ({ source_category: "electricity_location" } & ElectricityLocationData)
  | ({ source_category: "electricity_market" } & ElectricityMarketData)
  | ({ source_category: "business_travel" } & BusinessTravelData)
  | ({ source_category: "commuting" } & CommutingData);

// ---- computed (saída do cálculo, gravada junto no banco) ----

export interface Computed {
  co2_t: number;
  ch4_t: number;
  n2o_t: number;
  // Gases da família HFC/PFC + SF6/NF3, quando a fonte os produzir (fugitivas,
  // processos — fases futuras). gas -> toneladas.
  other_gases_t?: Record<string, number>;
  // CO2 biogênico é reportado SEPARADO e NÃO entra no total de escopo/CO2e.
  biogenic_co2_t: number;
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

import { supabase } from "@/lib/supabase";
import type { ActivitySector } from "./types";
import { AR_VERSION, GWP_AR5 } from "./gwp";

// Fatores de combustível — valores JÁ CONVERTIDOS por unidade (colunas T-AB da
// aba "Fatores de Emissão"): CO2 é único; CH4/N2O variam por setor. Guardamos
// também PCI/densidade/kg-TJ na tabela para rastreabilidade, mas o cálculo usa
// direto os kg/unidade (garante paridade: qty × fator/1000).
export interface FuelFactor {
  ref_no: number;
  name_pt: string;
  unit: string;
  is_biofuel: boolean;
  co2_kg_un: number;
  ch4_kg_un: Record<ActivitySector, number>;
  n2o_kg_un: Record<ActivitySector, number>;
}

export interface GridFactor {
  year: number;
  month: number | null;
  region: string;
  co2_t_mwh: number;
  ch4_t_mwh: number;
  n2o_t_mwh: number;
}

export interface GenericFactor {
  source_category: string;
  factor_key: string;
  description: string;
  unit: string;
  co2_kg: number;
  ch4_kg: number;
  n2o_kg: number;
  co2e_kg: number | null;
  biogenic_co2_kg: number;
}

// Escopo 3 Cat. 3 — WTT/cradle-to-gate por combustível (Tabela 22 da aba
// "Fatores de Emissão"), em kg/GJ — numericamente igual a g/MJ, então usa
// direto sem conversão. Tabela e propósito distintos de FuelFactor (aquela é
// combustão em si; esta é a "pegada" de extrair/produzir/transportar o
// combustível antes de ele ser queimado).
export interface WttFuelFactor {
  name_pt: string;
  co2_kg_gj: number;
  ch4_kg_gj: number;
  n2o_kg_gj: number;
}

// Escopo 1 — Efluentes. Fator por tipo de tratamento (aba "Listas",
// eflu_tipo_tratamento_MCF_domestico/_industrial). MCF fica guardado para
// rastreabilidade; o cálculo usa os EF já derivados: kgCH4/kgDBO ou kgCH4/kgDQO
// (conforme a unidade da carga orgânica informada) e kgN2O-N/kgN (o motor
// aplica 44/28 para chegar a kgN2O/kgN).
export interface EffluentFactor {
  domain: "domestic" | "industrial";
  treatment_type: string;
  mcf: number;
  ef_ch4_kg_dbo: number;
  ef_ch4_kg_dqo: number;
  ef_n2o_n_kg_n: number;
}

// Escopo 1 — Resíduos sólidos / incineração. Parâmetros de composição por
// categoria de resíduo (umidade, teor de carbono na massa seca, fração de
// carbono fóssil). O motor itera a lista inteira; "Outros" (última posição)
// recebe a fração restante da composição. `category` inclui o prefixo "A - ",
// "B - " etc.; `position` preserva a ordem da planilha.
export interface IncinerationFactor {
  position: number;
  category: string;
  moisture: number;
  carbon_content: number;
  fossil_fraction: number;
}

// Escopo 1 — Combustão móvel por frota (Tabelas 6-7 da aba "Fatores de
// Emissão"). CH4/N2O em kg por litro do combustível comercial, por tipo de
// veículo e ano da frota — o CO2 continua vindo de FuelFactor (é função do
// combustível, não da tecnologia). `year_key`: "all" (Todos os anos), "2000-"
// (até 2000) ou o ano ("2001".."2025").
// Escopo 1 — Resíduos sólidos / aterro (modelo FOD). Parâmetros por categoria
// de resíduo aterrado: DOC (carbono orgânico degradável, base úmida), DOCf
// (fração que de fato decompõe) e k (constante de decaimento anual).
export interface LandfillFactor {
  position: number;
  category: string;
  doc: number;
  docf: number;
  k: number;
}

// Qualidade do local de disposição → MCF (fator de correção de metano), da aba
// "Resíduos sólidos" (Passo 4) via Listas!BT13:BU20. Lookup pequeno e acoplado
// aos rótulos da UI, por isso constante do motor e não tabela.
export const LANDFILL_QUALITIES: { key: string; mcf: number; label: string }[] = [
  { key: "A", mcf: 1, label: "A — Aterro sanitário" },
  { key: "B", mcf: 0.5, label: "B — Aterro semi-aeróbio" },
  { key: "C", mcf: 0.7, label: "C — Aterro semi-aeróbio (mal manejado)" },
  { key: "D", mcf: 0.4, label: "D — Aterro com aeração ativa" },
  { key: "E", mcf: 0.7, label: "E — Aterro com aeração ativa (mal manejado)" },
  { key: "F", mcf: 0.8, label: "F — Aterro com profundidade ≥ 5 m" },
  { key: "G", mcf: 0.4, label: "G — Aterro com profundidade < 5 m" },
  { key: "H", mcf: 0.6, label: "H — Sem classificação conhecida" },
];

export function mcfOf(qualityKey: string): number {
  return LANDFILL_QUALITIES.find((q) => q.key === qualityKey)?.mcf ?? 0;
}

export interface FleetFactor {
  fuel_label: string | null;
  vehicle_type: string;
  year_key: string;
  ch4_kg_l: number;
  n2o_kg_l: number;
}

export interface FactorContext {
  fuels: Map<number, FuelFactor>;
  grid: Map<string, GridFactor>; // key `${region}:${year}` (mês agregado no anual)
  generic: Map<string, GenericFactor>; // key `${source_category}:${factor_key}`
  gwp: Map<string, number>;
  wttFuels: Map<string, WttFuelFactor>; // key: name_pt normalizado
  effluents: Map<string, EffluentFactor>; // key: `${domain}:${treatment_type}`
  incineration: IncinerationFactor[]; // ordenado por position
  fleet: Map<string, FleetFactor>; // key `${vehicle_type}:${year_key}`
  fleetTypes: string[]; // tipos de veículo distintos, ordenados
  landfill: LandfillFactor[]; // ordenado por position
  arVersion: string;
}

function gridKey(region: string, year: number) {
  return `${region}:${year}`;
}
export function genericKey(sourceCategory: string, factorKey: string) {
  return `${sourceCategory}:${factorKey}`;
}
export function effluentKey(domain: string, treatmentType: string) {
  return `${domain}:${treatmentType}`;
}
export function fleetKey(vehicleType: string, yearKey: string) {
  return `${vehicleType}:${yearKey}`;
}

// Resolve o fator da frota tolerando anos fora da tabela: o ano exato, senão
// "all" (tipos que têm fator único), senão "2000-" para anos antigos e o mais
// recente disponível para anos futuros.
export function getFleet(ctx: FactorContext, vehicleType: string, year?: number): FleetFactor | undefined {
  const exact = year != null ? ctx.fleet.get(fleetKey(vehicleType, String(year))) : undefined;
  if (exact) return exact;
  const all = ctx.fleet.get(fleetKey(vehicleType, "all"));
  if (all) return all;
  if (year != null && year <= 2000) {
    const old = ctx.fleet.get(fleetKey(vehicleType, "2000-"));
    if (old) return old;
  }
  const candidates = [...ctx.fleet.values()]
    .filter((f) => f.vehicle_type === vehicleType && /^\d{4}$/.test(f.year_key))
    .sort((a, b) => Number(a.year_key) - Number(b.year_key));
  if (candidates.length === 0) return ctx.fleet.get(fleetKey(vehicleType, "2000-"));
  if (year != null && year < Number(candidates[0].year_key)) {
    return ctx.fleet.get(fleetKey(vehicleType, "2000-")) ?? candidates[0];
  }
  return candidates[candidates.length - 1];
}

// Carrega todas as tabelas de fator uma vez e indexa em Map (dado de
// referência, pequeno e cacheável — ~800 combustíveis são dezenas de KB).
export async function loadFactorContext(): Promise<FactorContext> {
  const [fuelsRes, gridRes, genericRes, gwpRes, wttRes, effluentRes, incinRes, fleetRes, landfillRes] =
    await Promise.all([
    supabase.from("ghg_fuel_factors").select("*"),
    supabase.from("ghg_grid_factors").select("*"),
    supabase.from("ghg_generic_factors").select("*"),
    supabase.from("ghg_gwp").select("*"),
    supabase.from("ghg_wtt_fuel_factors").select("*"),
    supabase.from("ghg_effluent_factors").select("*"),
    supabase.from("ghg_incineration_factors").select("*"),
    supabase.from("ghg_fleet_factors").select("*"),
    supabase.from("ghg_landfill_factors").select("*"),
  ]);

  const fuels = new Map<number, FuelFactor>();
  for (const r of (fuelsRes.data ?? []) as Record<string, number | string | boolean>[]) {
    const num = (v: unknown) => (v == null ? 0 : Number(v));
    fuels.set(Number(r.ref_no), {
      ref_no: Number(r.ref_no),
      name_pt: String(r.name_pt),
      unit: String(r.unit),
      is_biofuel: Boolean(r.is_biofuel),
      co2_kg_un: num(r.co2_kg_un),
      ch4_kg_un: {
        energy: num(r.ch4_kg_un_energy),
        manufacturing: num(r.ch4_kg_un_manufacturing),
        commercial: num(r.ch4_kg_un_commercial),
        residential: num(r.ch4_kg_un_residential),
      },
      n2o_kg_un: {
        energy: num(r.n2o_kg_un_energy),
        manufacturing: num(r.n2o_kg_un_manufacturing),
        commercial: num(r.n2o_kg_un_commercial),
        residential: num(r.n2o_kg_un_residential),
      },
    });
  }

  const grid = new Map<string, GridFactor>();
  for (const r of (gridRes.data ?? []) as Record<string, number | string | null>[]) {
    const region = String(r.region ?? "SIN");
    const year = Number(r.year);
    // Fase 1 usa o fator anual (month = null). Se vierem mensais, o anual
    // agregado é a linha com month null; ignoramos as mensais aqui.
    if (r.month == null) {
      grid.set(gridKey(region, year), {
        year,
        month: null,
        region,
        co2_t_mwh: Number(r.co2_t_mwh ?? 0),
        ch4_t_mwh: Number(r.ch4_t_mwh ?? 0),
        n2o_t_mwh: Number(r.n2o_t_mwh ?? 0),
      });
    }
  }

  const generic = new Map<string, GenericFactor>();
  for (const r of (genericRes.data ?? []) as Record<string, number | string | null>[]) {
    const g: GenericFactor = {
      source_category: String(r.source_category),
      factor_key: String(r.factor_key),
      description: String(r.description ?? ""),
      unit: String(r.unit ?? ""),
      co2_kg: Number(r.co2_kg ?? 0),
      ch4_kg: Number(r.ch4_kg ?? 0),
      n2o_kg: Number(r.n2o_kg ?? 0),
      co2e_kg: r.co2e_kg == null ? null : Number(r.co2e_kg),
      biogenic_co2_kg: Number(r.biogenic_co2_kg ?? 0),
    };
    generic.set(genericKey(g.source_category, g.factor_key), g);
  }

  const gwp = new Map<string, number>();
  const gwpRows = (gwpRes.data ?? []) as Record<string, number | string>[];
  if (gwpRows.length > 0) {
    for (const r of gwpRows) gwp.set(String(r.gas), Number(r.gwp));
  } else {
    // Fallback para as constantes AR5 se a tabela ainda não estiver populada.
    for (const [gas, v] of Object.entries(GWP_AR5)) gwp.set(gas, v);
  }

  const wttFuels = new Map<string, WttFuelFactor>();
  for (const r of (wttRes.data ?? []) as Record<string, number | string>[]) {
    wttFuels.set(String(r.name_pt), {
      name_pt: String(r.name_pt),
      co2_kg_gj: Number(r.co2_kg_gj ?? 0),
      ch4_kg_gj: Number(r.ch4_kg_gj ?? 0),
      n2o_kg_gj: Number(r.n2o_kg_gj ?? 0),
    });
  }

  const effluents = new Map<string, EffluentFactor>();
  for (const r of (effluentRes.data ?? []) as Record<string, number | string>[]) {
    const domain = String(r.domain) as "domestic" | "industrial";
    const treatment_type = String(r.treatment_type);
    effluents.set(effluentKey(domain, treatment_type), {
      domain,
      treatment_type,
      mcf: Number(r.mcf ?? 0),
      ef_ch4_kg_dbo: Number(r.ef_ch4_kg_dbo ?? 0),
      ef_ch4_kg_dqo: Number(r.ef_ch4_kg_dqo ?? 0),
      ef_n2o_n_kg_n: Number(r.ef_n2o_n_kg_n ?? 0),
    });
  }

  const incineration: IncinerationFactor[] = [];
  for (const r of (incinRes.data ?? []) as Record<string, number | string>[]) {
    incineration.push({
      position: Number(r.position),
      category: String(r.category),
      moisture: Number(r.moisture ?? 0),
      carbon_content: Number(r.carbon_content ?? 0),
      fossil_fraction: Number(r.fossil_fraction ?? 0),
    });
  }
  incineration.sort((a, b) => a.position - b.position);

  const fleet = new Map<string, FleetFactor>();
  for (const r of (fleetRes.data ?? []) as Record<string, number | string | null>[]) {
    const f: FleetFactor = {
      fuel_label: r.fuel_label == null ? null : String(r.fuel_label),
      vehicle_type: String(r.vehicle_type),
      year_key: String(r.year_key),
      ch4_kg_l: Number(r.ch4_kg_l ?? 0),
      n2o_kg_l: Number(r.n2o_kg_l ?? 0),
    };
    fleet.set(fleetKey(f.vehicle_type, f.year_key), f);
  }
  const fleetTypes = [...new Set([...fleet.values()].map((f) => f.vehicle_type))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );

  const landfill: LandfillFactor[] = [];
  for (const r of (landfillRes.data ?? []) as Record<string, number | string>[]) {
    landfill.push({
      position: Number(r.position),
      category: String(r.category),
      doc: Number(r.doc ?? 0),
      docf: Number(r.docf ?? 0),
      k: Number(r.k ?? 0),
    });
  }
  landfill.sort((a, b) => a.position - b.position);

  return {
    fuels, grid, generic, gwp, wttFuels, effluents, incineration, fleet, fleetTypes, landfill,
    arVersion: AR_VERSION,
  };
}

export function getGrid(ctx: FactorContext, year: number, region = "SIN"): GridFactor | undefined {
  return ctx.grid.get(gridKey(region, year));
}

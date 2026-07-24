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

export interface FactorContext {
  fuels: Map<number, FuelFactor>;
  grid: Map<string, GridFactor>; // key `${region}:${year}` (mês agregado no anual)
  generic: Map<string, GenericFactor>; // key `${source_category}:${factor_key}`
  gwp: Map<string, number>;
  arVersion: string;
}

function gridKey(region: string, year: number) {
  return `${region}:${year}`;
}
export function genericKey(sourceCategory: string, factorKey: string) {
  return `${sourceCategory}:${factorKey}`;
}

// Carrega todas as tabelas de fator uma vez e indexa em Map (dado de
// referência, pequeno e cacheável — ~800 combustíveis são dezenas de KB).
export async function loadFactorContext(): Promise<FactorContext> {
  const [fuelsRes, gridRes, genericRes, gwpRes] = await Promise.all([
    supabase.from("ghg_fuel_factors").select("*"),
    supabase.from("ghg_grid_factors").select("*"),
    supabase.from("ghg_generic_factors").select("*"),
    supabase.from("ghg_gwp").select("*"),
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

  return { fuels, grid, generic, gwp, arVersion: AR_VERSION };
}

export function getGrid(ctx: FactorContext, year: number, region = "SIN"): GridFactor | undefined {
  return ctx.grid.get(gridKey(region, year));
}

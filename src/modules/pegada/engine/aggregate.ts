import type { Computed, Scope, SourceCategory } from "./types";
import { SCOPE_OF_SOURCE } from "./types";

// Uma entry já calculada, como vem do banco (ghg_activity_entries).
export interface InventoryEntry {
  id: string;
  source_category: SourceCategory;
  source_ref: string | null;
  description: string | null;
  activity_data: Record<string, unknown>;
  computed: Computed;
}

export interface InventoryTotals {
  byScope: Record<Scope, number>; // tCO2e fóssil por escopo
  total: number; // tCO2e fóssil total (exclui biogênico)
  biogenicCo2: number; // CO2 biogênico EMITIDO, reportado à parte
  biogenicCo2Removals: number; // CO2 biogênico REMOVIDO (absorção), à parte
  byGas: { co2: number; ch4: number; n2o: number };
}

// Soma on-the-fly (nunca materializada). CO2 biogênico (emissão e remoção)
// fica FORA do total de escopo/CO2e, reportado separadamente — regra do GHG
// Protocol (mesma separação da aba Resumo da planilha).
export function aggregate(entries: InventoryEntry[]): InventoryTotals {
  const byScope: Record<Scope, number> = { 1: 0, 2: 0, 3: 0 };
  let biogenicCo2 = 0;
  let biogenicCo2Removals = 0;
  const byGas = { co2: 0, ch4: 0, n2o: 0 };

  for (const e of entries) {
    const scope = SCOPE_OF_SOURCE[e.source_category];
    const c = e.computed;
    if (!c) continue;
    byScope[scope] += c.co2e_t ?? 0;
    biogenicCo2 += c.biogenic_co2_t ?? 0;
    biogenicCo2Removals += c.biogenic_co2_removals_t ?? 0;
    byGas.co2 += c.co2_t ?? 0;
    byGas.ch4 += c.ch4_t ?? 0;
    byGas.n2o += c.n2o_t ?? 0;
  }

  return {
    byScope,
    total: byScope[1] + byScope[2] + byScope[3],
    biogenicCo2,
    biogenicCo2Removals,
    byGas,
  };
}

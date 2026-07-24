import type { ActivityData, CalcResult, Computed, SourceCategory } from "./types";
import { genericKey, getGrid, type FactorContext } from "./factors";

// Motor de cálculo determinístico, por source_category. Cada função recebe o
// activity_data cru + o contexto de fatores indexado e devolve o `computed`
// (já com CO2e fóssil e biogênico separado) ou um erro de fator faltante.
// Espelha exatamente a matemática da planilha FGV: como usamos os fatores JÁ
// convertidos por unidade, o cálculo é quantidade × fator / 1000.

function gwpOf(ctx: FactorContext, gas: string): number {
  return ctx.gwp.get(gas) ?? 0;
}

function co2eFossil(ctx: FactorContext, co2_t: number, ch4_t: number, n2o_t: number): number {
  return co2_t * gwpOf(ctx, "CO2") + ch4_t * gwpOf(ctx, "CH4") + n2o_t * gwpOf(ctx, "N2O");
}

type Calculator = (data: ActivityData, ctx: FactorContext) => CalcResult;

const calculators: Record<SourceCategory, Calculator> = {
  stationary_combustion(data, ctx) {
    if (data.source_category !== "stationary_combustion") return { ok: false, missingFactor: "tipo" };
    const fuel = ctx.fuels.get(data.fuel_ref_no);
    if (!fuel) return { ok: false, missingFactor: `combustível ref ${data.fuel_ref_no}` };
    const q = data.quantity;
    const co2 = (q * fuel.co2_kg_un) / 1000;
    const ch4 = (q * fuel.ch4_kg_un[data.sector]) / 1000;
    const n2o = (q * fuel.n2o_kg_un[data.sector]) / 1000;
    // Biocombustível: o CO2 é biogênico (reportado à parte, fora do escopo);
    // CH4/N2O continuam contando como fóssil no escopo.
    const biogenic = fuel.is_biofuel ? co2 : 0;
    const fossilCo2 = fuel.is_biofuel ? 0 : co2;
    const computed: Computed = {
      co2_t: fossilCo2,
      ch4_t: ch4,
      n2o_t: n2o,
      biogenic_co2_t: biogenic,
      co2e_t: co2eFossil(ctx, fossilCo2, ch4, n2o),
      factor_refs: [`fuel:${fuel.ref_no}`],
      ar_version: ctx.arVersion,
    };
    return { ok: true, computed };
  },

  mobile_combustion(data, ctx) {
    if (data.source_category !== "mobile_combustion") return { ok: false, missingFactor: "tipo" };
    const fuel = ctx.fuels.get(data.fuel_ref_no);
    if (!fuel) return { ok: false, missingFactor: `combustível ref ${data.fuel_ref_no}` };
    const q = data.quantity;
    const co2 = (q * fuel.co2_kg_un) / 1000;
    const ch4 = (q * fuel.ch4_kg_un[data.sector]) / 1000;
    const n2o = (q * fuel.n2o_kg_un[data.sector]) / 1000;
    const biogenic = fuel.is_biofuel ? co2 : 0;
    const fossilCo2 = fuel.is_biofuel ? 0 : co2;
    const computed: Computed = {
      co2_t: fossilCo2,
      ch4_t: ch4,
      n2o_t: n2o,
      biogenic_co2_t: biogenic,
      co2e_t: co2eFossil(ctx, fossilCo2, ch4, n2o),
      factor_refs: [`fuel:${fuel.ref_no}`],
      ar_version: ctx.arVersion,
    };
    return { ok: true, computed };
  },

  electricity_location(data, ctx) {
    if (data.source_category !== "electricity_location") return { ok: false, missingFactor: "tipo" };
    const g = getGrid(ctx, data.year);
    if (!g) return { ok: false, missingFactor: `fator do SIN para ${data.year}` };
    const co2 = data.mwh * g.co2_t_mwh;
    const ch4 = data.mwh * g.ch4_t_mwh;
    const n2o = data.mwh * g.n2o_t_mwh;
    const computed: Computed = {
      co2_t: co2,
      ch4_t: ch4,
      n2o_t: n2o,
      biogenic_co2_t: 0,
      co2e_t: co2eFossil(ctx, co2, ch4, n2o),
      factor_refs: [`grid:SIN:${data.year}`],
      ar_version: ctx.arVersion,
      factor_year: data.year,
    };
    return { ok: true, computed };
  },

  electricity_market(data, ctx) {
    if (data.source_category !== "electricity_market") return { ok: false, missingFactor: "tipo" };
    // Fator informado pelo usuário (instrumento contratual) — em tCO2/MWh etc.
    const co2 = data.mwh * data.co2_t_mwh;
    const ch4 = data.mwh * (data.ch4_t_mwh ?? 0);
    const n2o = data.mwh * (data.n2o_t_mwh ?? 0);
    const computed: Computed = {
      co2_t: co2,
      ch4_t: ch4,
      n2o_t: n2o,
      biogenic_co2_t: 0,
      co2e_t: co2eFossil(ctx, co2, ch4, n2o),
      factor_refs: ["user_supplied_factor"],
      ar_version: ctx.arVersion,
    };
    return { ok: true, computed };
  },

  business_travel(data, ctx) {
    if (data.source_category !== "business_travel") return { ok: false, missingFactor: "tipo" };
    const f = ctx.generic.get(genericKey("business_travel", data.factor_key));
    if (!f) return { ok: false, missingFactor: `fator de viagem ${data.factor_key}` };
    // Fatores aéreos são por passageiro.km (kg/p.km); a distância já é p.km total.
    const co2 = (data.distance_km * f.co2_kg) / 1000;
    const ch4 = (data.distance_km * f.ch4_kg) / 1000;
    const n2o = (data.distance_km * f.n2o_kg) / 1000;
    const computed: Computed = {
      co2_t: co2,
      ch4_t: ch4,
      n2o_t: n2o,
      biogenic_co2_t: 0,
      co2e_t: co2eFossil(ctx, co2, ch4, n2o),
      factor_refs: [`generic:business_travel:${data.factor_key}`],
      ar_version: ctx.arVersion,
    };
    return { ok: true, computed };
  },

  commuting(data, ctx) {
    if (data.source_category !== "commuting") return { ok: false, missingFactor: "tipo" };
    const f = ctx.generic.get(genericKey("commuting", data.factor_key));
    if (!f) return { ok: false, missingFactor: `fator casa-trabalho ${data.factor_key}` };
    // Fator por passageiro.km; total = passageiros × distância.
    const pkm = data.passengers * data.distance_km;
    const co2 = (pkm * f.co2_kg) / 1000;
    const ch4 = (pkm * f.ch4_kg) / 1000;
    const n2o = (pkm * f.n2o_kg) / 1000;
    const computed: Computed = {
      co2_t: co2,
      ch4_t: ch4,
      n2o_t: n2o,
      biogenic_co2_t: 0,
      co2e_t: co2eFossil(ctx, co2, ch4, n2o),
      factor_refs: [`generic:commuting:${data.factor_key}`],
      ar_version: ctx.arVersion,
    };
    return { ok: true, computed };
  },
};

export function calculate(data: ActivityData, ctx: FactorContext): CalcResult {
  return calculators[data.source_category](data, ctx);
}

import type { ActivityData, CalcResult, Computed, SourceCategory } from "./types";
import { effluentKey, genericKey, getGrid, type FactorContext } from "./factors";

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

// Roteia a massa (t) de UM gás para o balde certo do `computed`: CO2/CH4/N2O
// têm campos próprios; os demais (HFC/PFC/SF6/NF3...) vão em other_gases_t.
// Usado onde o usuário relata a massa do gás direto (processos, agricultura,
// fugitivas) — a conversão a CO2e é sempre massa × GWP do próprio gás.
function gasMassBuckets(gas: string, mass_t: number): Pick<Computed, "co2_t" | "ch4_t" | "n2o_t" | "other_gases_t"> {
  return {
    co2_t: gas === "CO2" ? mass_t : 0,
    ch4_t: gas === "CH4" ? mass_t : 0,
    n2o_t: gas === "N2O" ? mass_t : 0,
    other_gases_t: gas !== "CO2" && gas !== "CH4" && gas !== "N2O" ? { [gas]: mass_t } : undefined,
  };
}

// Processos industriais e Agricultura compartilham a mesma matemática: uma
// linha = massa de UM gás relatada direto (não há fator de atividade),
// convertida a CO2e só pelo GWP do próprio gás — mais emissão/remoção de CO2
// biogênico digitadas à parte (não fazem parte do CO2e do escopo).
function calcDirectGasEmission(data: ActivityData, ctx: FactorContext): CalcResult {
  if (data.source_category !== "industrial_processes" && data.source_category !== "agriculture") {
    return { ok: false, missingFactor: "tipo" };
  }
  const gwp = ctx.gwp.get(data.gas);
  if (gwp == null) return { ok: false, missingFactor: `GWP para o gás ${data.gas}` };

  const isCo2 = data.gas === "CO2";
  const isCh4 = data.gas === "CH4";
  const isN2o = data.gas === "N2O";

  const computed: Computed = {
    co2_t: isCo2 ? data.emitted_t : 0,
    ch4_t: isCh4 ? data.emitted_t : 0,
    n2o_t: isN2o ? data.emitted_t : 0,
    other_gases_t: !isCo2 && !isCh4 && !isN2o ? { [data.gas]: data.emitted_t } : undefined,
    biogenic_co2_t: data.biogenic_co2_emissions_t ?? 0,
    biogenic_co2_removals_t: data.biogenic_co2_removals_t ?? 0,
    co2e_t: data.emitted_t * gwp,
    factor_refs: [`gwp:${data.gas}`],
    ar_version: ctx.arVersion,
  };
  return { ok: true, computed };
}

// Escopo 3 Cat. 3 — WTT do combustível já queimado direto (mesma quantidade
// em GJ do Escopo 1), fator próprio cradle-to-gate (kg/GJ = g/MJ, sem
// conversão). Sem biogênico nesta tabela da planilha.
function calcFuelEnergyUpstream(data: ActivityData, ctx: FactorContext): CalcResult {
  if (data.source_category !== "fuel_energy_upstream") return { ok: false, missingFactor: "tipo" };
  const f = ctx.wttFuels.get(data.fuel_key);
  if (!f) return { ok: false, missingFactor: `combustível WTT ${data.fuel_key}` };
  const gj = data.consumption_gj;
  const co2 = (gj * f.co2_kg_gj) / 1000;
  const ch4 = (gj * f.ch4_kg_gj) / 1000;
  const n2o = (gj * f.n2o_kg_gj) / 1000;
  const computed: Computed = {
    co2_t: co2,
    ch4_t: ch4,
    n2o_t: n2o,
    biogenic_co2_t: 0,
    co2e_t: co2eFossil(ctx, co2, ch4, n2o),
    factor_refs: [`wtt_fuel:${f.name_pt}`],
    ar_version: ctx.arVersion,
  };
  return { ok: true, computed };
}

// Emissões fugitivas (Escopo 1). Cada método deriva a MASSA LÍQUIDA de gás
// (kg) — que pode ser negativa (ex.: recuperação/absorção maior que a emissão,
// ou aumento de estoque no período; a planilha admite) — e converte a CO2e só
// pelo GWP do próprio gás. Ver FugitiveEmissionData em types.ts.
function calcFugitive(data: ActivityData, ctx: FactorContext): CalcResult {
  if (data.source_category !== "fugitive") return { ok: false, missingFactor: "tipo" };
  const gwp = ctx.gwp.get(data.gas);
  if (gwp == null) return { ok: false, missingFactor: `GWP para o gás ${data.gas}` };

  let netKg: number;
  switch (data.method) {
    case "lifecycle":
      netKg =
        (data.charge_new_kg ?? 0) -
        (data.capacity_new_kg ?? 0) +
        (data.recharge_existing_kg ?? 0) +
        (data.capacity_disposed_kg ?? 0) -
        (data.recovered_kg ?? 0);
      break;
    case "mass_balance":
      netKg =
        (data.stock_initial_kg ?? 0) -
        (data.stock_final_kg ?? 0) +
        (data.transferred_kg ?? 0) -
        (data.capacity_change_kg ?? 0);
      break;
    case "direct":
      netKg = data.released_kg ?? 0;
      break;
    default:
      return { ok: false, missingFactor: "método fugitivo inválido" };
  }

  const massT = netKg / 1000;
  const buckets = gasMassBuckets(data.gas, massT);
  const computed: Computed = {
    ...buckets,
    biogenic_co2_t: 0,
    co2e_t: massT * gwp,
    factor_refs: [`gwp:${data.gas}`],
    ar_version: ctx.arVersion,
  };
  return { ok: true, computed };
}

// Efluentes (Escopo 1). Ver EffluentData em types.ts para a metodologia.
function calcEffluent(data: ActivityData, ctx: FactorContext): CalcResult {
  if (data.source_category !== "effluents") return { ok: false, missingFactor: "tipo" };

  if (data.method === "direct") {
    const co2 = data.co2_t ?? 0;
    const ch4 = data.ch4_t ?? 0;
    const n2o = data.n2o_t ?? 0;
    const computed: Computed = {
      co2_t: co2,
      ch4_t: ch4,
      n2o_t: n2o,
      biogenic_co2_t: data.biogenic_co2_t ?? 0,
      co2e_t: co2eFossil(ctx, co2, ch4, n2o),
      factor_refs: ["user_supplied"],
      ar_version: ctx.arVersion,
    };
    return { ok: true, computed };
  }

  // detailed — tratamento único
  if (!data.domain || !data.treatment_type) return { ok: false, missingFactor: "tipo de tratamento" };
  const f = ctx.effluents.get(effluentKey(data.domain, data.treatment_type));
  if (!f) return { ok: false, missingFactor: `tratamento de efluente ${data.domain}/${data.treatment_type}` };

  const q = data.volume_m3 ?? 0;
  const load = data.organic_load_kg_m3 ?? 0;
  const removed = data.organic_removed_kg_m3 ?? 0;
  const efCh4 = data.organic_unit === "dqo" ? f.ef_ch4_kg_dqo : f.ef_ch4_kg_dbo;
  const recovered = data.ch4_recovered_t ?? 0;
  const ch4 = (q * (load - removed) * efCh4) / 1000 - recovered;

  const n = data.nitrogen_kg_m3 ?? 0;
  const efN2o = (44 / 28) * f.ef_n2o_n_kg_n; // kgN2O-N/kgN → kgN2O/kgN
  const n2o = (q * n * efN2o) / 1000;

  // A planilha zera o CO2e do lançamento inteiro quando o CH4 líquido é
  // negativo (recuperação maior que a geração) — não apenas a parcela de CH4.
  const co2e = ch4 < 0 ? 0 : ch4 * gwpOf(ctx, "CH4") + n2o * gwpOf(ctx, "N2O");
  const biogenic = data.biogas_flared ? recovered * (44 / 16) : 0;

  const computed: Computed = {
    co2_t: 0,
    ch4_t: ch4,
    n2o_t: n2o,
    biogenic_co2_t: biogenic,
    co2e_t: co2e,
    factor_refs: [`effluent:${data.domain}:${data.treatment_type}`, `unit:${data.organic_unit ?? "dbo"}`],
    ar_version: ctx.arVersion,
  };
  return { ok: true, computed };
}

// Resíduos sólidos (Escopo 1), Fase A. Ver SolidWasteData em types.ts.
// Defaults IPCC quando o usuário não informa fator próprio.
const COMPOST_EF_CH4_G_KG = 4; // gCH4/kg de resíduo
const COMPOST_EF_N2O_G_KG = 0.24; // gN2O/kg de resíduo
const INCIN_EF_CH4_G_T = 0; // gCH4/t (base úmida)
const INCIN_EF_N2O_G_T = 100; // gN2O/t (base úmida)

function calcSolidWaste(data: ActivityData, ctx: FactorContext): CalcResult {
  if (data.source_category !== "solid_waste") return { ok: false, missingFactor: "tipo" };

  if (data.method === "direct") {
    const co2 = data.co2_t ?? 0;
    const ch4 = data.ch4_t ?? 0;
    const n2o = data.n2o_t ?? 0;
    return {
      ok: true,
      computed: {
        co2_t: co2,
        ch4_t: ch4,
        n2o_t: n2o,
        biogenic_co2_t: data.biogenic_co2_t ?? 0,
        co2e_t: co2eFossil(ctx, co2, ch4, n2o),
        factor_refs: ["user_supplied"],
        ar_version: ctx.arVersion,
      },
    };
  }

  if (data.method === "composting") {
    const mass = data.mass_t ?? 0;
    const recovered = data.ch4_recovered_t ?? 0;
    const efCh4 = data.ef_ch4_g_kg ?? COMPOST_EF_CH4_G_KG;
    const efN2o = data.ef_n2o_g_kg ?? COMPOST_EF_N2O_G_KG;
    const ch4 = mass * efCh4 * 1e-3 - recovered;
    const n2o = mass * efN2o * 1e-3;
    const co2e = ch4 < 0 ? 0 : ch4 * gwpOf(ctx, "CH4") + n2o * gwpOf(ctx, "N2O");
    const biogenic = data.biogas_flared ? recovered * (44 / 16) : 0;
    return {
      ok: true,
      computed: {
        co2_t: 0,
        ch4_t: ch4,
        n2o_t: n2o,
        biogenic_co2_t: biogenic,
        co2e_t: co2e,
        factor_refs: ["composting"],
        ar_version: ctx.arVersion,
      },
    };
  }

  // incineration
  if (ctx.incineration.length === 0) return { ok: false, missingFactor: "fatores de incineração" };
  const qty = data.incinerated_t ?? 0;
  const comp = data.composition ?? {};
  // Frações das categorias A-K informadas; "Outros" (última posição) recebe o
  // restante para fechar 100%, como na planilha.
  const named = ctx.incineration.filter((f) => f.position < ctx.incineration.length);
  const namedSum = named.reduce((s, f) => s + (comp[f.category] ?? 0) / 100, 0);
  const outros = ctx.incineration[ctx.incineration.length - 1];
  const outrosFrac = Math.max(0, 1 - namedSum);

  let co2Fossil = 0;
  let co2Biogenic = 0;
  for (const f of ctx.incineration) {
    const frac = f === outros ? outrosFrac : (comp[f.category] ?? 0) / 100;
    if (frac <= 0) continue;
    const base = (44 / 12) * frac * qty * (1 - f.moisture) * f.carbon_content;
    co2Fossil += base * f.fossil_fraction;
    co2Biogenic += base * (1 - f.fossil_fraction);
  }
  const efCh4 = data.ef_ch4_g_t ?? INCIN_EF_CH4_G_T;
  const efN2o = data.ef_n2o_g_t ?? INCIN_EF_N2O_G_T;
  const ch4 = (qty * efCh4) / 1e6; // g/t → t
  const n2o = (qty * efN2o) / 1e6;
  return {
    ok: true,
    computed: {
      co2_t: co2Fossil,
      ch4_t: ch4,
      n2o_t: n2o,
      biogenic_co2_t: co2Biogenic,
      co2e_t: co2eFossil(ctx, co2Fossil, ch4, n2o),
      factor_refs: ["incineration"],
      ar_version: ctx.arVersion,
    },
  };
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

  fugitive: calcFugitive,
  industrial_processes: calcDirectGasEmission,
  agriculture: calcDirectGasEmission,
  effluents: calcEffluent,
  solid_waste: calcSolidWaste,
  fuel_energy_upstream: calcFuelEnergyUpstream,
};

export function calculate(data: ActivityData, ctx: FactorContext): CalcResult {
  return calculators[data.source_category](data, ctx);
}

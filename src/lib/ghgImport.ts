import * as XLSX from "xlsx";
import type { ActivityData, ActivitySector, Scope3GasEntryCategory } from "@/modules/pegada/engine/types";
import type { FactorContext } from "@/modules/pegada/engine/factors";

// Importador da planilha oficial "Ferramenta GHG Protocol" (FGV). Separado do
// geoImport (responsabilidades distintas) e multi-aba: itera SheetNames com
// matching tolerante a acento/caixa, porque os nomes das abas variam entre
// versões da planilha.

export interface ParsedRow {
  sourceRef: string;
  description: string;
  data: ActivityData;
}

export interface SkippedRow {
  sheet: string;
  reason: string;
  detail: string;
}

export interface SummaryTotals {
  scope1: number;
  scope2Location: number;
  scope2Market: number;
  scope3: number;
}

export interface GhgImportResult {
  rows: ParsedRow[];
  skipped: SkippedRow[];
  summary: SummaryTotals | null;
  sheetsFound: string[];
}

type Grid = unknown[][];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findSheet(wb: XLSX.WorkBook, candidates: string[]): string | null {
  const wanted = candidates.map(normalize);
  for (const name of wb.SheetNames) {
    const n = normalize(name);
    if (wanted.some((w) => n === w || n.includes(w) || w.includes(n))) return name;
  }
  return null;
}

// blankrows: true preserva o alinhamento das linhas — não usar false aqui, ou
// os índices deixam de corresponder às linhas da planilha.
function grid(wb: XLSX.WorkBook, sheetName: string): Grid {
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, blankrows: true, defval: null });
}

// Localiza a linha de cabeçalho pelo rótulo (em vez de fixar o número da
// linha), para tolerar variações de layout entre versões da planilha.
function findHeaderRow(g: Grid, label: string, maxScan = 120): number {
  const target = normalize(label);
  for (let i = 0; i < Math.min(g.length, maxScan); i++) {
    const row = g[i] ?? [];
    for (let c = 0; c < Math.min(row.length, 8); c++) {
      if (normalize(str(row[c])).includes(target)) return i;
    }
  }
  return -1;
}

// Algumas abas repetem o rótulo do cabeçalho no texto de orientação ACIMA da
// tabela (as fugitivas fazem isso). Buscar do topo casa com a orientação, e aí
// sectionEnd corta a seção antes mesmo dos dados — bug real pego em teste.
// Ancorar no título "Tabela N." e só então procurar o cabeçalho resolve.
function findTableHeaderRow(g: Grid, tableNo: number, label: string): number {
  const title = new RegExp(`^tabela\\s+${tableNo}\\b`);
  const target = normalize(label);
  for (let i = 0; i < g.length; i++) {
    const row = g[i] ?? [];
    for (let c = 0; c < Math.min(row.length, 5); c++) {
      if (!title.test(normalize(str(row[c])))) continue;
      for (let j = i + 1; j < Math.min(g.length, i + 12); j++) {
        const hr = g[j] ?? [];
        for (let k = 0; k < Math.min(hr.length, 8); k++) {
          if (normalize(str(hr[k])).includes(target)) return j;
        }
      }
      return -1;
    }
  }
  return -1;
}

// Cada aba contém VÁRIAS tabelas ("Tabela 1.", "Tabela 2." ...) para
// sub-modos diferentes (ex.: a aba de energia elétrica tem uma 2ª tabela para
// veículos elétricos). Sem limitar a varredura ao fim da seção atual, o parser
// captura linhas da tabela seguinte — bug real pego em teste.
function sectionEnd(g: Grid, from: number): number {
  for (let i = from; i < g.length; i++) {
    const row = g[i] ?? [];
    for (let c = 0; c < Math.min(row.length, 5); c++) {
      if (/^tabela\s+\d/.test(normalize(str(row[c])))) return i;
    }
  }
  return g.length;
}

function num(v: unknown): number {
  if (v == null || v === "-" || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

// A planilha marca a linha de demonstração com "Exemplo" na coluna A.
function isExample(row: unknown[]): boolean {
  return normalize(str(row?.[0])).startsWith("exemplo");
}

function resolveFuelRef(ctx: FactorContext, fuelName: string): number | null {
  const target = normalize(fuelName);
  if (!target || target === "-") return null;
  for (const f of ctx.fuels.values()) {
    if (normalize(f.name_pt) === target) return f.ref_no;
  }
  for (const f of ctx.fuels.values()) {
    if (normalize(f.name_pt).includes(target) || target.includes(normalize(f.name_pt))) return f.ref_no;
  }
  return null;
}

// A coluna "Gás de Efeito Estufa (GEE)" traz ora o código direto ("HFC-23"),
// ora o nome descritivo com o código entre parênteses ("Óxido nitroso (N2O)").
function resolveGasKey(ctx: FactorContext, label: string): string | null {
  const raw = str(label);
  if (!raw) return null;
  const parenMatch = raw.match(/\(([^)]+)\)\s*$/);
  const candidate = parenMatch ? parenMatch[1].trim() : raw;
  for (const key of ctx.gwp.keys()) {
    if (key.toLowerCase() === candidate.toLowerCase()) return key;
  }
  for (const key of ctx.gwp.keys()) {
    if (normalize(key) === normalize(candidate)) return key;
  }
  return null;
}

// Nas fugitivas a coluna "Gás ou composto" aceita tanto gás puro ("HFC-32",
// "Hexafluoreto de enxofre (SF6)") quanto composto ("R-410A") — este último
// não está em ghg_gwp, e sim em ghg_gas_blends.
function resolveGasOrBlend(ctx: FactorContext, label: string): string | null {
  const gas = resolveGasKey(ctx, label);
  if (gas) return gas;
  const raw = str(label);
  for (const blend of ctx.blends.keys()) {
    if (normalize(blend) === normalize(raw)) return blend;
  }
  return null;
}

function resolveWttFuelKey(ctx: FactorContext, fuelName: string): string | null {
  const target = normalize(fuelName);
  if (!target || target === "-") return null;
  for (const key of ctx.wttFuels.keys()) {
    if (normalize(key) === target) return key;
  }
  for (const key of ctx.wttFuels.keys()) {
    if (normalize(key).includes(target) || target.includes(normalize(key))) return key;
  }
  return null;
}

function resolveGenericKey(ctx: FactorContext, category: string, label: string): string | null {
  const target = normalize(label);
  if (!target) return null;
  for (const g of ctx.generic.values()) {
    if (g.source_category !== category) continue;
    if (normalize(g.description ?? "").includes(target) || target.includes(normalize(g.factor_key))) return g.factor_key;
  }
  return null;
}

// Número da categoria de Escopo 3 (como aparece na aba "Categorias de Escopo
// 3") → source_category. As categorias 3, 6 e 7 ficam de fora de propósito:
// têm abas próprias com cálculo por fator de atividade, já importadas daqui,
// e trazê-las também da matriz duplicaria as emissões.
const SCOPE3_CATEGORY_BY_NUMBER: Record<number, Scope3GasEntryCategory | undefined> = {
  1: "purchased_goods",
  2: "capital_goods",
  4: "transport_distribution_upstream",
  5: "waste_generated_operations",
  8: "leased_assets_upstream",
  9: "transport_distribution_downstream",
  10: "processing_sold_products",
  11: "use_sold_products",
  12: "end_of_life_sold_products",
  13: "leased_assets_downstream",
  14: "franchises",
  15: "investments",
};

// Faixa aérea a partir da distância do trecho (Tabela 13 da planilha).
function airBand(legKm: number): string {
  if (legKm <= 500) return "air_short";
  if (legKm <= 3700) return "air_medium";
  return "air_long";
}

export function parseGhgWorkbook(
  wb: XLSX.WorkBook,
  ctx: FactorContext,
  opts: { inventoryYear: number; sector: ActivitySector },
): GhgImportResult {
  const rows: ParsedRow[] = [];
  const skipped: SkippedRow[] = [];
  const sheetsFound: string[] = [];

  // ---- Combustão estacionária: header r43, exemplo r46, dados r47+ ----
  const stationary = findSheet(wb, ["combustao estacionaria"]);
  if (stationary) {
    sheetsFound.push(stationary);
    const g = grid(wb, stationary);
    const h = findHeaderRow(g, "registro da fonte");
    const end = sectionEnd(g, h + 1);
    for (let i = h + 1; h >= 0 && i < end; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      const qty = num(r[4]);
      const fuelName = str(r[3]);
      if (!qty || !fuelName) continue;
      const ref = resolveFuelRef(ctx, fuelName);
      if (ref == null) {
        skipped.push({ sheet: stationary, reason: "Combustível não reconhecido", detail: fuelName });
        continue;
      }
      rows.push({
        sourceRef: str(r[1]),
        description: str(r[2]),
        data: { source_category: "stationary_combustion", fuel_ref_no: ref, quantity: qty, sector: opts.sector },
      });
    }
  }

  // ---- Combustão móvel: header r44, exemplo r47, dados r48+ ----
  const mobile = findSheet(wb, ["combustao movel"]);
  if (mobile) {
    sheetsFound.push(mobile);
    const g = grid(wb, mobile);
    const h = findHeaderRow(g, "registro da frota");
    const end = sectionEnd(g, h + 1);
    for (let i = h + 1; h >= 0 && i < end; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      // Consumo anual (R) ou soma dos meses (F..Q)
      let qty = num(r[17]);
      if (!qty) for (let c = 5; c <= 16; c++) qty += num(r[c]);
      const fuelName = str(r[19]); // combustível fóssil
      if (!qty || !fuelName || fuelName === "-") continue;
      const ref = resolveFuelRef(ctx, fuelName);
      if (ref == null) {
        skipped.push({ sheet: mobile, reason: "Combustível não reconhecido", detail: fuelName });
        continue;
      }
      rows.push({
        sourceRef: str(r[1]),
        description: str(r[2]) || str(r[3]),
        data: { source_category: "mobile_combustion", fuel_ref_no: ref, quantity: qty, sector: opts.sector },
      });
    }
  }

  // ---- Energia elétrica (localização): header r37, exemplo r40, dados r41+ ----
  const elec = findSheet(wb, ["en. eletrica (localizacao)", "energia eletrica (localizacao)"]);
  if (elec) {
    sheetsFound.push(elec);
    const g = grid(wb, elec);
    const h = findHeaderRow(g, "registro da fonte");
    const end = sectionEnd(g, h + 1);
    for (let i = h + 1; h >= 0 && i < end; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      let mwh = num(r[16]); // total
      if (!mwh) for (let c = 3; c <= 14; c++) mwh += num(r[c]);
      if (!mwh) continue;
      rows.push({
        sourceRef: str(r[1]),
        description: str(r[2]),
        data: { source_category: "electricity_location", mwh, year: opts.inventoryYear },
      });
    }
  }

  // ---- Viagens a negócios: header r45, exemplo r46, dados r47+ ----
  const travel = findSheet(wb, ["viagens a negocios"]);
  if (travel) {
    sheetsFound.push(travel);
    const g = grid(wb, travel);
    const h = findHeaderRow(g, "registro da viagem");
    const end = sectionEnd(g, h + 1);
    for (let i = h + 1; h >= 0 && i < end; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      const legKm = num(r[22]);
      const totalKm = num(r[24]) || legKm * (num(r[23]) || 1);
      if (!totalKm) continue;
      rows.push({
        sourceRef: str(r[1]),
        description: [str(r[2]), str(r[12])].filter(Boolean).join(" → "),
        data: { source_category: "business_travel", factor_key: airBand(legKm), distance_km: totalKm },
      });
    }
  }

  // ---- Casa-trabalho: header r37, exemplo r39, dados r40+ ----
  const commute = findSheet(wb, ["emissoes casa-trabalho", "casa-trabalho"]);
  if (commute) {
    sheetsFound.push(commute);
    const g = grid(wb, commute);
    const h = findHeaderRow(g, "registro do colaborador");
    const end = sectionEnd(g, h + 1);
    for (let i = h + 1; h >= 0 && i < end; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      const modal = str(r[3]);
      const passengers = num(r[4]) || 1;
      const legKm = num(r[5]);
      const days = num(r[6]) || 1;
      const totalKm = legKm * days;
      if (!modal || !totalKm) continue;
      const key = resolveGenericKey(ctx, "commuting", modal);
      if (!key) {
        skipped.push({ sheet: commute, reason: "Modal sem fator cadastrado", detail: modal });
        continue;
      }
      rows.push({
        sourceRef: str(r[1]),
        description: str(r[2]),
        data: { source_category: "commuting", factor_key: key, passengers, distance_km: totalKm },
      });
    }
  }

  // ---- Processos industriais: header r30, exemplo r31, dados r32+ ----
  const industrial = findSheet(wb, ["processos industriais"]);
  if (industrial) {
    sheetsFound.push(industrial);
    const g = grid(wb, industrial);
    const h = findHeaderRow(g, "registro da fonte");
    const end = sectionEnd(g, h + 1);
    for (let i = h + 1; h >= 0 && i < end; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      const gasLabel = str(r[4]);
      const emitted = num(r[5]);
      if (!gasLabel || !emitted) continue;
      const gas = resolveGasKey(ctx, gasLabel);
      if (!gas) {
        skipped.push({ sheet: industrial, reason: "Gás não reconhecido", detail: gasLabel });
        continue;
      }
      rows.push({
        sourceRef: str(r[1]),
        description: [str(r[2]), str(r[3])].filter(Boolean).join(" — "),
        data: {
          source_category: "industrial_processes",
          gas,
          emitted_t: emitted,
          biogenic_co2_emissions_t: num(r[8]) || undefined,
          biogenic_co2_removals_t: num(r[9]) || undefined,
        },
      });
    }
  }

  // ---- Atividades de agricultura: header r33, exemplo r34, dados r35+ ----
  const agriculture = findSheet(wb, ["atividades de agricultura"]);
  if (agriculture) {
    sheetsFound.push(agriculture);
    const g = grid(wb, agriculture);
    const h = findHeaderRow(g, "registro da fonte");
    const end = sectionEnd(g, h + 1);
    for (let i = h + 1; h >= 0 && i < end; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      const gasLabel = str(r[4]);
      const emitted = num(r[5]);
      if (!gasLabel || !emitted) continue;
      const gas = resolveGasKey(ctx, gasLabel);
      if (!gas) {
        skipped.push({ sheet: agriculture, reason: "Gás não reconhecido", detail: gasLabel });
        continue;
      }
      rows.push({
        sourceRef: str(r[1]),
        description: [str(r[2]), str(r[3])].filter(Boolean).join(" — "),
        data: {
          source_category: "agriculture",
          gas,
          emitted_t: emitted,
          biogenic_co2_emissions_t: num(r[8]) || undefined,
          biogenic_co2_removals_t: num(r[9]) || undefined,
        },
      });
    }
  }

  // ---- Emissões fugitivas: duas tabelas na MESMA aba. ----
  const fugitive = findSheet(wb, ["emissoes fugitivas", "emissões fugitivas"]);
  if (fugitive) {
    sheetsFound.push(fugitive);
    const g = grid(wb, fugitive);

    // Tabela 1 (Opção 1, estágio do ciclo de vida): header r57, exemplo r60,
    // dados r61+. E=carga(novas), F=capacidade(novas), G=recarga(existentes),
    // H=capacidade(dispensadas), I=recuperada.
    const h1 = findTableHeaderRow(g, 1, "gas ou composto");
    const end1 = sectionEnd(g, h1 + 1);
    for (let i = h1 + 1; h1 >= 0 && i < end1; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      const gasLabel = str(r[2]);
      const vals = [num(r[4]), num(r[5]), num(r[6]), num(r[7]), num(r[8])];
      if (!gasLabel || vals.every((v) => v === 0)) continue;
      const gas = resolveGasOrBlend(ctx, gasLabel);
      if (!gas) {
        skipped.push({ sheet: fugitive, reason: "Gás ou composto não reconhecido", detail: gasLabel });
        continue;
      }
      rows.push({
        sourceRef: str(r[1]),
        description: "",
        data: {
          source_category: "fugitive",
          gas,
          method: "lifecycle",
          charge_new_kg: vals[0],
          capacity_new_kg: vals[1],
          recharge_existing_kg: vals[2],
          capacity_disposed_kg: vals[3],
          recovered_kg: vals[4],
        },
      });
    }

    // Tabela 5 (SF6/NF3, balanço de massa): header r206, exemplo r209, dados
    // r210+. D=estoque inicial, E=estoque final, F=comprado no ano. Está além
    // do maxScan padrão de findHeaderRow, daí o limite maior.
    const h5 = findTableHeaderRow(g, 5, "estoque de gas no inicio");
    const end5 = sectionEnd(g, h5 + 1);
    for (let i = h5 + 1; h5 >= 0 && i < end5; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      const gasLabel = str(r[2]);
      const vals = [num(r[3]), num(r[4]), num(r[5])];
      if (!gasLabel || vals.every((v) => v === 0)) continue;
      const gas = resolveGasOrBlend(ctx, gasLabel);
      if (!gas) {
        skipped.push({ sheet: fugitive, reason: "Gás não reconhecido", detail: gasLabel });
        continue;
      }
      rows.push({
        sourceRef: str(r[1]),
        description: "",
        data: {
          source_category: "fugitive",
          gas,
          method: "mass_balance",
          stock_initial_kg: vals[0],
          stock_final_kg: vals[1],
          transferred_kg: vals[2],
          // SF6/NF3: a Tabela 5 não tem coluna de mudança de capacidade.
          capacity_change_kg: 0,
        },
      });
    }
  }

  // ---- Perdas T&D (localização): header r39, exemplo r42, dados r43+.
  // Mesma forma da energia elétrica por localização — a coluna Q traz o total
  // anual e as D..O os meses; usamos o anual quando existir. ----
  const tdLosses = findSheet(wb, ["perdas t&d (abord. localizacao)", "perdas t&d (abord. localização)"]);
  if (tdLosses) {
    sheetsFound.push(tdLosses);
    const g = grid(wb, tdLosses);
    const h = findHeaderRow(g, "registro da fonte");
    const end = sectionEnd(g, h + 1);
    for (let i = h + 1; h >= 0 && i < end; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      let mwh = num(r[16]); // Q — total anual
      if (!mwh) for (let c = 3; c <= 14; c++) mwh += num(r[c]); // D..O — meses
      if (!mwh) continue;
      rows.push({
        sourceRef: str(r[1]),
        description: str(r[2]),
        data: { source_category: "td_losses_location", mwh, year: opts.inventoryYear },
      });
    }
  }

  // ---- Compra de energia térmica: header r28, exemplo r32, dados r33+.
  // D=combustível, E=eficiência do fervedor (fração, ex.: 0,8), F=vapor
  // comprado em GJ. A coluna G (consumo derivado) é recalculada pelo motor. ----
  const thermal = findSheet(wb, ["compra de energia termica", "compra de energia térmica"]);
  if (thermal) {
    sheetsFound.push(thermal);
    const g = grid(wb, thermal);
    const h = findHeaderRow(g, "combustivel utilizado");
    const end = sectionEnd(g, h + 1);
    for (let i = h + 1; h >= 0 && i < end; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      const fuelName = str(r[3]);
      const steamGj = num(r[5]);
      if (!fuelName || !steamGj) continue;
      const ref = resolveFuelRef(ctx, fuelName);
      if (!ref) {
        skipped.push({ sheet: thermal, reason: "Combustível não reconhecido", detail: fuelName });
        continue;
      }
      rows.push({
        sourceRef: str(r[1]),
        description: str(r[2]),
        data: {
          source_category: "thermal_energy_purchased",
          fuel_ref_no: ref,
          steam_gj: steamGj,
          // A planilha usa 0,8 quando a eficiência não é informada.
          boiler_efficiency: num(r[4]) || 0.8,
        },
      });
    }
  }

  // ---- Escopo 3 Cat. 3 (WTT combustível): header r43, exemplo/dados vazios
  // no template oficial — Tabela 1 só, colunas B(fuel)/E(GJ). ----
  const fuelUpstream = findSheet(wb, ["emissoes energia (upstream)", "emissões energia (upstream)"]);
  if (fuelUpstream) {
    sheetsFound.push(fuelUpstream);
    const g = grid(wb, fuelUpstream);
    const h = findHeaderRow(g, "combustivel utilizado");
    const end = sectionEnd(g, h + 1);
    for (let i = h + 1; h >= 0 && i < end; i++) {
      const r = g[i] ?? [];
      if (isExample(r)) continue;
      const fuelName = str(r[1]);
      const gj = num(r[4]);
      if (!fuelName || !gj) continue;
      const fuelKey = resolveWttFuelKey(ctx, fuelName);
      if (!fuelKey) {
        skipped.push({ sheet: fuelUpstream, reason: "Combustível WTT não reconhecido", detail: fuelName });
        continue;
      }
      rows.push({
        sourceRef: "",
        description: fuelName,
        data: { source_category: "fuel_energy_upstream", fuel_key: fuelKey, consumption_gj: gj },
      });
    }
  }

  // ---- Categorias de Escopo 3: matriz (gases nas linhas, categorias em
  // blocos de colunas). Cada bloco tem o rótulo "Categoria N" em C/E/G/I, os
  // gases em +3..+38 (massa na própria coluna, CO2e na seguinte) e o CO2
  // biogênico em +40/+41. Cobre as 12 categorias de entrada direta. ----
  const scope3 = findSheet(wb, ["categorias de escopo 3"]);
  if (scope3) {
    sheetsFound.push(scope3);
    const g = grid(wb, scope3);
    for (let i = 0; i < g.length; i++) {
      const row = g[i] ?? [];
      for (const col of [2, 4, 6, 8]) {
        const m = normalize(str(row[col])).match(/^categoria\s+(\d+)$/);
        if (!m) continue;
        const category = SCOPE3_CATEGORY_BY_NUMBER[Number(m[1])];
        // Cat. 3/6/7 têm abas próprias com cálculo por fator de atividade e já
        // são importadas de lá — importar daqui também duplicaria as emissões.
        if (!category) continue;
        // O rótulo vem da planilha com quebras de linha ("Transporte e
        // distribuição \n(upstream)") — colapsa para uma linha só.
        const label = str((g[i + 1] ?? [])[col]).replace(/\s+/g, " ").trim() || `Categoria ${m[1]}`;

        for (let k = 3; k <= 38; k++) {
          const r = g[i + k] ?? [];
          const gasLabel = str(r[1]);
          const mass = num(r[col]);
          if (!gasLabel || !mass) continue;
          const gas = resolveGasKey(ctx, gasLabel);
          if (!gas) {
            skipped.push({ sheet: scope3, reason: "Gás não reconhecido", detail: `${label}: ${gasLabel}` });
            continue;
          }
          rows.push({
            sourceRef: "",
            description: label,
            data: { source_category: category, gas, emitted_t: mass },
          });
        }

        // CO2 biogênico é informado por categoria, não por gás — entra como um
        // lançamento próprio de massa zero, para não inflar o CO2e de nenhum
        // gás e ainda assim preservar o número.
        const bioEmit = num((g[i + 40] ?? [])[col]);
        const bioRemov = num((g[i + 41] ?? [])[col]);
        if (bioEmit || bioRemov) {
          rows.push({
            sourceRef: "",
            description: `${label} — CO₂ biogênico`,
            data: {
              source_category: category,
              gas: "CO2",
              emitted_t: 0,
              biogenic_co2_emissions_t: bioEmit || undefined,
              biogenic_co2_removals_t: bioRemov || undefined,
            },
          });
        }
      }
    }
  }

  // ---- Resumo: totais por escopo em tCO2e (linha "Total", cols G..J) ----
  let summary: SummaryTotals | null = null;
  const resumo = findSheet(wb, ["resumo"]);
  if (resumo) {
    sheetsFound.push(resumo);
    const g = grid(wb, resumo);
    for (const r of g) {
      if (normalize(str(r?.[1])) === "total") {
        summary = { scope1: num(r[6]), scope2Location: num(r[7]), scope2Market: num(r[8]), scope3: num(r[9]) };
        break;
      }
    }
  }

  return { rows, skipped, summary, sheetsFound };
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}

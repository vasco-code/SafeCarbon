import * as XLSX from "xlsx";
import type { ActivityData, ActivitySector } from "@/modules/pegada/engine/types";
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

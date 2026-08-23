import * as XLSX from "xlsx";
import { AR_VERSION } from "./engine/gwp";
import { aggregate, groupByMonth, type InventoryEntry } from "./engine/aggregate";
import type { Scope } from "./engine/types";
import { SCOPE_LABELS, SOURCES } from "./sources";
import { MONTH_LABELS } from "./sources/common";

// Relatório do inventário exportável. Segue o mesmo padrão de export do DCP
// (HTML servido como application/msword) — abre no Word/Docs e imprime em PDF,
// sem dependência nova. O conteúdo espelha a aba "Resumo" da planilha: totais
// por escopo, CO2 biogênico reportado à parte (fora do total), detalhamento por
// fonte e por gás, e a proveniência dos fatores.

export interface ReportInventory {
  inventory_year: number;
  name: string | null;
  status: "draft" | "final";
}

function fmt(n: number, digits = 4): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function labelOf(category: string): string {
  return SOURCES.find((s) => s.category === category)?.label ?? category;
}

export function buildInventoryReportHtml(inventory: ReportInventory, entries: InventoryEntry[]): string {
  const totals = aggregate(entries);
  const generatedAt = new Date().toLocaleString("pt-BR");
  const title = `Inventário de Emissões ${inventory.inventory_year}${inventory.name ? ` — ${inventory.name}` : ""}`;

  // Agrupa por escopo → fonte, preservando a ordem oficial de SOURCES.
  const byScope: Record<Scope, { category: string; entries: InventoryEntry[]; co2e: number }[]> = { 1: [], 2: [], 3: [] };
  for (const source of SOURCES) {
    const rows = entries.filter((e) => e.source_category === source.category);
    if (rows.length === 0) continue;
    byScope[source.scope].push({
      category: String(source.category),
      entries: rows,
      co2e: rows.reduce((s, r) => s + (r.computed?.co2e_t ?? 0), 0),
    });
  }

  const scopeSections = ([1, 2, 3] as Scope[])
    .map((scope) => {
      const groups = byScope[scope];
      if (groups.length === 0) {
        return `<h2>${esc(SCOPE_LABELS[scope])}</h2><p><i>Sem lançamentos.</i></p>`;
      }
      const tables = groups
        .map((g) => {
          const rows = g.entries
            .map((e) => {
              const c = e.computed;
              return `<tr>
                <td>${esc(e.source_ref ?? "—")}</td>
                <td>${esc(e.description ?? "—")}</td>
                <td align="right">${fmt(c?.co2_t ?? 0)}</td>
                <td align="right">${fmt(c?.ch4_t ?? 0)}</td>
                <td align="right">${fmt(c?.n2o_t ?? 0)}</td>
                <td align="right">${fmt(c?.co2e_t ?? 0)}</td>
              </tr>`;
            })
            .join("");
          return `<h3>${esc(labelOf(g.category))} — ${fmt(g.co2e)} tCO₂e</h3>
            <table border="1" cellspacing="0" cellpadding="4" width="100%">
              <tr bgcolor="#eeeeee">
                <th align="left">Registro</th><th align="left">Descrição</th>
                <th align="right">CO₂ (t)</th><th align="right">CH₄ (t)</th>
                <th align="right">N₂O (t)</th><th align="right">CO₂e (t)</th>
              </tr>
              ${rows}
            </table>`;
        })
        .join("\n");
      return `<h2>${esc(SCOPE_LABELS[scope])} — ${fmt(totals.byScope[scope])} tCO₂e</h2>${tables}`;
    })
    .join("\n");

  return `<html><head><meta charset="utf-8"><title>${esc(title)}</title></head>
<body style="font-family: Calibri, Arial, sans-serif;">
<h1>${esc(title)}</h1>
<p>
  Status: <b>${inventory.status === "final" ? "Final" : "Rascunho"}</b><br/>
  Gerado em ${esc(generatedAt)}
</p>

<h2>Resumo</h2>
<table border="1" cellspacing="0" cellpadding="4">
  <tr bgcolor="#eeeeee"><th align="left">Indicador</th><th align="right">tCO₂e</th></tr>
  <tr><td>Escopo 1 — Emissões diretas</td><td align="right">${fmt(totals.byScope[1])}</td></tr>
  <tr><td>Escopo 2 — Energia adquirida</td><td align="right">${fmt(totals.byScope[2])}</td></tr>
  <tr><td>Escopo 3 — Outras emissões indiretas</td><td align="right">${fmt(totals.byScope[3])}</td></tr>
  <tr bgcolor="#f6f6f6"><td><b>Total (Escopos 1+2+3)</b></td><td align="right"><b>${fmt(totals.total)}</b></td></tr>
</table>

<h3>Emissões por gás (soma dos escopos)</h3>
<table border="1" cellspacing="0" cellpadding="4">
  <tr bgcolor="#eeeeee"><th align="left">Gás</th><th align="right">toneladas do gás</th></tr>
  <tr><td>CO₂</td><td align="right">${fmt(totals.byGas.co2)}</td></tr>
  <tr><td>CH₄</td><td align="right">${fmt(totals.byGas.ch4)}</td></tr>
  <tr><td>N₂O</td><td align="right">${fmt(totals.byGas.n2o)}</td></tr>
</table>

${(() => {
    const groups = groupByMonth(entries);
    const rows = Array.from({ length: 12 }, (_, i) => {
      const t = aggregate(groups.get(i + 1) ?? []);
      return { label: MONTH_LABELS[i], ...t };
    });
    const unassigned = groups.get(null);
    if (unassigned) rows.push({ label: "Não informado", ...aggregate(unassigned) });
    const filled = rows.filter((r) => r.total > 0);
    if (filled.length === 0) return "";
    const monthRows = filled
      .map(
        (r) => `<tr>
          <td>${esc(r.label)}</td>
          <td align="right">${fmt(r.byScope[1])}</td>
          <td align="right">${fmt(r.byScope[2])}</td>
          <td align="right">${fmt(r.byScope[3])}</td>
          <td align="right">${fmt(r.total)}</td>
        </tr>`,
      )
      .join("");
    return `<h3>Evolução mensal</h3>
      <table border="1" cellspacing="0" cellpadding="4">
        <tr bgcolor="#eeeeee">
          <th align="left">Mês</th><th align="right">Escopo 1</th><th align="right">Escopo 2</th>
          <th align="right">Escopo 3</th><th align="right">Total (tCO₂e)</th>
        </tr>
        ${monthRows}
      </table>`;
  })()}

<h3>CO₂ biogênico (reportado à parte)</h3>
<p>
  Emissões: <b>${fmt(totals.biogenicCo2)} t</b> &nbsp;|&nbsp;
  Remoções: <b>${fmt(totals.biogenicCo2Removals)} t</b><br/>
  <i>Conforme o GHG Protocol, o CO₂ biogênico é reportado separadamente e não entra
  no total de CO₂e dos escopos.</i>
</p>

${scopeSections}

<hr/>
<p style="font-size: 9pt; color: #555;">
  Metodologia: Ferramenta do Programa Brasileiro GHG Protocol (FGV) v2026.0.1.
  Potenciais de aquecimento global (GWP) do IPCC ${esc(AR_VERSION)}.
  Relatório gerado pelo SafeCarbon.
</p>
</body></html>`;
}

export function downloadInventoryReport(inventory: ReportInventory, entries: InventoryEntry[]) {
  const html = buildInventoryReportHtml(inventory, entries);
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const slug = (inventory.name ?? "inventario").replace(/\s+/g, "-");
  link.download = `Inventario-${slug}-${inventory.inventory_year}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}

// Mesmos números do relatório .doc, em 3 abas: Resumo, Evolução mensal (uma
// linha por mês, mais fácil de tabular/gráfico no Excel do que a versão
// pivotada da tela) e Lançamentos (todas as fontes juntas, já que Registro/
// Descrição/gases/CO2e são os únicos campos uniformes entre as ~28 fontes).
export function buildInventoryReportWorkbook(inventory: ReportInventory, entries: InventoryEntry[]): XLSX.WorkBook {
  const totals = aggregate(entries);
  const wb = XLSX.utils.book_new();

  const title = `Inventário de Emissões ${inventory.inventory_year}${inventory.name ? ` — ${inventory.name}` : ""}`;
  const resumoRows: (string | number)[][] = [
    [title],
    [`Status: ${inventory.status === "final" ? "Final" : "Rascunho"}`],
    [],
    ["Indicador", "tCO2e"],
    ["Escopo 1 — Emissões diretas", totals.byScope[1]],
    ["Escopo 2 — Energia adquirida", totals.byScope[2]],
    ["Escopo 3 — Outras emissões indiretas", totals.byScope[3]],
    ["Total (Escopos 1+2+3)", totals.total],
    [],
    ["Emissões por gás (soma dos escopos)", "toneladas do gás"],
    ["CO2", totals.byGas.co2],
    ["CH4", totals.byGas.ch4],
    ["N2O", totals.byGas.n2o],
    [],
    ["CO2 biogênico (reportado à parte)"],
    ["Emissões (t)", totals.biogenicCo2],
    ["Remoções (t)", totals.biogenicCo2Removals],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumoRows), "Resumo");

  const groups = groupByMonth(entries);
  const monthlyRows: (string | number)[][] = [["Mês", "Escopo 1", "Escopo 2", "Escopo 3", "Total (tCO2e)"]];
  for (let i = 0; i < 12; i++) {
    const t = aggregate(groups.get(i + 1) ?? []);
    if (t.total > 0) monthlyRows.push([MONTH_LABELS[i], t.byScope[1], t.byScope[2], t.byScope[3], t.total]);
  }
  const unassigned = groups.get(null);
  if (unassigned) {
    const t = aggregate(unassigned);
    if (t.total > 0) monthlyRows.push(["Não informado", t.byScope[1], t.byScope[2], t.byScope[3], t.total]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyRows), "Evolução mensal");

  const lancamentos = entries.map((e) => ({
    Escopo: e.source_category,
    Fonte: labelOf(e.source_category),
    Registro: e.source_ref ?? "",
    Descrição: e.description ?? "",
    "CO2 (t)": e.computed?.co2_t ?? 0,
    "CH4 (t)": e.computed?.ch4_t ?? 0,
    "N2O (t)": e.computed?.n2o_t ?? 0,
    "CO2e (t)": e.computed?.co2e_t ?? 0,
    Período: e.period_month ? MONTH_LABELS[e.period_month - 1] : "Ano inteiro",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lancamentos), "Lançamentos");

  return wb;
}

export function downloadInventoryReportXlsx(inventory: ReportInventory, entries: InventoryEntry[]) {
  const wb = buildInventoryReportWorkbook(inventory, entries);
  const slug = (inventory.name ?? "inventario").replace(/\s+/g, "-");
  XLSX.writeFile(wb, `Inventario-${slug}-${inventory.inventory_year}.xlsx`);
}

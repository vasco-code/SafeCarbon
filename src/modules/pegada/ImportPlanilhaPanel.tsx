import { useState } from "react";
import { FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { parseGhgWorkbook, readWorkbook, type GhgImportResult } from "@/lib/ghgImport";
import type { FactorContext } from "./engine/factors";
import { calculate } from "./engine/registry";
import { addEntriesBatch } from "./entryActions";
import { SECTOR_LABELS, type ActivitySector, type Computed } from "./engine/types";
import { SOURCES } from "./sources";
import { fmt } from "./sources/common";

interface Prepared {
  sourceRef: string;
  description: string;
  data: ReturnType<typeof parseGhgWorkbook>["rows"][number]["data"];
  computed: Computed;
}

export function ImportPlanilhaPanel({
  inventoryId,
  inventoryYear,
  ctx,
  reload,
}: {
  inventoryId: string;
  inventoryYear: number;
  ctx: FactorContext;
  reload: () => void;
}) {
  // O fator do SIN só existe até o último ano publicado — um inventário do ano
  // corrente costuma não ter fator ainda. Default: o ano mais recente
  // disponível que não ultrapasse o ano do inventário.
  const gridYears = [...new Set([...ctx.grid.values()].map((g) => g.year))].sort((a, b) => b - a);
  const defaultGridYear = gridYears.find((y) => y <= inventoryYear) ?? gridYears[0] ?? inventoryYear;

  const [sector, setSector] = useState<ActivitySector>("energy");
  const [gridYear, setGridYear] = useState<number>(defaultGridYear);
  const [result, setResult] = useState<GhgImportResult | null>(null);
  const [prepared, setPrepared] = useState<Prepared[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const wb = await readWorkbook(file);
      const parsed = parseGhgWorkbook(wb, ctx, { inventoryYear: gridYear, sector });
      const ok: Prepared[] = [];
      const bad: string[] = [];
      for (const row of parsed.rows) {
        const calc = calculate(row.data, ctx);
        if (calc.ok) ok.push({ ...row, computed: calc.computed });
        else bad.push(`${row.sourceRef || row.description || "linha"} — ${calc.missingFactor}`);
      }
      setResult(parsed);
      setPrepared(ok);
      setFailed(bad);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    }
    setBusy(false);
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    const { error: err, inserted } = await addEntriesBatch(inventoryId, prepared);
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      setDone(`${inserted} lançamento(s) importado(s).`);
      setResult(null);
      setPrepared([]);
      setFailed([]);
      reload();
    }
  }

  // Total que o nosso motor calculou, por escopo, para conferir com o Resumo.
  const byScope = prepared.reduce(
    (acc, p) => {
      const s = SOURCES.find((x) => x.category === p.data.source_category)?.scope ?? 1;
      acc[s] = (acc[s] ?? 0) + p.computed.co2e_t;
      return acc;
    },
    {} as Record<number, number>,
  );

  const countByCategory = prepared.reduce<Record<string, number>>((acc, p) => {
    acc[p.data.source_category] = (acc[p.data.source_category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="dcp-section">
      <h2>
        <FileSpreadsheet size={18} style={{ verticalAlign: "-3px", marginRight: "0.4rem" }} />
        Importar planilha GHG Protocol
      </h2>
      <p>
        Envie a planilha oficial preenchida. Lemos as tabelas de dados de atividade das fontes já cobertas e
        recalculamos com os fatores oficiais — e comparamos com o total da aba Resumo.
      </p>

      <div className="action-bar">
        <div className="action-bar-field">
          <label htmlFor="imp-sector">Setor de atividade (para os fatores de combustão)</label>
          <select id="imp-sector" value={sector} onChange={(e) => setSector(e.target.value as ActivitySector)}>
            {Object.entries(SECTOR_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {gridYears.length > 0 && (
          <div className="action-bar-field">
            <label htmlFor="imp-grid-year">Ano do fator do SIN (energia elétrica)</label>
            <select id="imp-grid-year" value={gridYear} onChange={(e) => setGridYear(Number(e.target.value))}>
              {gridYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {gridYear !== inventoryYear && (
        <p style={{ fontSize: "0.8125rem", color: "var(--sc-muted)", marginTop: 0 }}>
          O fator do SIN de {inventoryYear} ainda não está publicado — usando o de {gridYear}, o mais recente
          disponível.
        </p>
      )}

      <FileDropzone
        accept=".xlsx,.xlsm,.xls"
        onFiles={handleFiles}
        disabled={busy}
        label={busy ? "Lendo planilha..." : "Arraste a planilha GHG Protocol aqui ou clique para escolher"}
        hint="A planilha não é alterada — apenas lida."
      />

      {error && <p className="auth-error">{error}</p>}
      {done && <p className="auth-success">✓ {done}</p>}

      {result && (
        <div className="nfe-preview" style={{ maxWidth: "none", marginTop: "1rem" }}>
          <p>
            <strong>{prepared.length} lançamento(s)</strong> prontos para importar
            {result.sheetsFound.length > 0 ? ` — abas lidas: ${result.sheetsFound.join(", ")}` : ""}
          </p>

          {prepared.length === 0 && result.skipped.length === 0 && (
            <p style={{ fontSize: "0.8125rem", color: "var(--sc-muted)" }}>
              Nenhuma linha de dados encontrada — a planilha parece conter apenas as linhas de exemplo (que são
              ignoradas de propósito). Preencha as tabelas das fontes e envie novamente.
            </p>
          )}

          {Object.keys(countByCategory).length > 0 && (
            <ul style={{ listStyle: "none", paddingLeft: 0, margin: "0.5rem 0" }}>
              {Object.entries(countByCategory).map(([cat, n]) => (
                <li key={cat} className="file-batch-item">
                  <CheckCircle2 size={15} color="var(--sc-success)" />
                  <span className="file-batch-name">
                    {SOURCES.find((s) => s.category === cat)?.label ?? cat}: {n} linha(s)
                  </span>
                </li>
              ))}
            </ul>
          )}

          {result.summary && (
            <table style={{ marginTop: "0.75rem" }}>
              <thead>
                <tr>
                  <th>Conferência</th>
                  <th>Planilha (tCO₂e)</th>
                  <th>Importado por nós (tCO₂e)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Escopo 1</td>
                  <td>{fmt(result.summary.scope1, 2)}</td>
                  <td>{fmt(byScope[1] ?? 0, 2)}</td>
                </tr>
                <tr>
                  <td>Escopo 2 (localização)</td>
                  <td>{fmt(result.summary.scope2Location, 2)}</td>
                  <td>{fmt(byScope[2] ?? 0, 2)}</td>
                </tr>
                <tr>
                  <td>Escopo 3</td>
                  <td>{fmt(result.summary.scope3, 2)}</td>
                  <td>{fmt(byScope[3] ?? 0, 2)}</td>
                </tr>
              </tbody>
            </table>
          )}
          {result.summary && (
            <p style={{ fontSize: "0.8125rem", color: "var(--sc-muted)", marginTop: "0.5rem" }}>
              Diferenças são esperadas nas fontes ainda não cobertas pela calculadora (aparecem no total da planilha,
              mas não são importadas).
            </p>
          )}

          {(result.skipped.length > 0 || failed.length > 0) && (
            <ul style={{ listStyle: "none", paddingLeft: 0, margin: "0.75rem 0" }}>
              {result.skipped.map((s, i) => (
                <li key={`s${i}`} className="file-batch-item">
                  <AlertTriangle size={15} color="var(--sc-warning)" />
                  <span className="file-batch-name">
                    {s.sheet}: {s.reason} — {s.detail}
                  </span>
                </li>
              ))}
              {failed.map((f, i) => (
                <li key={`f${i}`} className="file-batch-item">
                  <AlertTriangle size={15} color="var(--sc-warning)" />
                  <span className="file-batch-name">{f}</span>
                </li>
              ))}
            </ul>
          )}

          <button type="button" className="btn-primary" onClick={handleConfirm} disabled={busy || prepared.length === 0}>
            {busy ? "Importando..." : `Importar ${prepared.length} lançamento(s)`}
          </button>
        </div>
      )}
    </div>
  );
}

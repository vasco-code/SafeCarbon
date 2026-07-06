import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Cloud, Recycle, BadgeCheck, Link2, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ReportHeader } from "@/components/ReportHeader";

interface YearRow {
  year: number;
  emittedTco2e: number;
  leakagePct: number | null;
  batchTco2e: number | null;
  batchStatus: string | null;
}

interface TokenRow {
  token_id: string;
  status: "active" | "transferred" | "retired";
  issued_amount_tco2e: number;
  issued_at: string;
}

const BATCH_STATUS_LABELS: Record<string, string> = {
  pending_verification: "Pendente de verificação",
  verified: "Verificado",
  approved: "Aprovado",
  issued: "Emitido",
  retired: "Aposentado",
};

export function RelatorioEmissoesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [projectName, setProjectName] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [developerLogoUrl, setDeveloperLogoUrl] = useState<string | null>(null);
  const [proponentName, setProponentName] = useState("");
  const [proponentLogoUrl, setProponentLogoUrl] = useState<string | null>(null);
  const [years, setYears] = useState<YearRow[]>([]);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const id = projectId;

    async function load() {
      const [projectResult, inventoryResult, leakageResult, cyclesResult] = await Promise.all([
        supabase
          .from("carbon_projects")
          .select("name, developer_org_id, proponent_org_id")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("emission_inventory_entries")
          .select("period_year, calculated_tco2e")
          .eq("project_id", id),
        supabase
          .from("leakage_assessments")
          .select("period_year, leakage_factor_pct")
          .eq("project_id", id),
        supabase
          .from("credit_calculation_cycles")
          .select("id, period_year, credit_batches(tco2e_amount, status)")
          .eq("project_id", id),
      ]);

      setProjectName(projectResult.data?.name ?? "");

      if (projectResult.data?.developer_org_id) {
        const { data: devOrg } = await supabase
          .from("organizations")
          .select("name, logo_url")
          .eq("id", projectResult.data.developer_org_id)
          .maybeSingle();
        setDeveloperName(devOrg?.name ?? "");
        setDeveloperLogoUrl(devOrg?.logo_url ?? null);
      }

      if (projectResult.data?.proponent_org_id) {
        const { data: propOrg } = await supabase
          .from("organizations")
          .select("name, logo_url")
          .eq("id", projectResult.data.proponent_org_id)
          .maybeSingle();
        setProponentName(propOrg?.name ?? "");
        setProponentLogoUrl(propOrg?.logo_url ?? null);
      }

      const byYear = new Map<number, YearRow>();
      function ensureYear(year: number) {
        if (!byYear.has(year)) {
          byYear.set(year, { year, emittedTco2e: 0, leakagePct: null, batchTco2e: null, batchStatus: null });
        }
        return byYear.get(year)!;
      }

      for (const row of inventoryResult.data ?? []) {
        ensureYear(row.period_year).emittedTco2e += Number(row.calculated_tco2e);
      }
      for (const row of leakageResult.data ?? []) {
        const y = ensureYear(row.period_year);
        y.leakagePct = Math.max(y.leakagePct ?? 0, Number(row.leakage_factor_pct));
      }
      for (const cycle of (cyclesResult.data ?? []) as unknown as {
        period_year: number;
        credit_batches: { tco2e_amount: number; status: string }[];
      }[]) {
        const batch = cycle.credit_batches?.[0];
        if (!batch) continue;
        const y = ensureYear(cycle.period_year);
        y.batchTco2e = Number(batch.tco2e_amount);
        y.batchStatus = batch.status;
      }

      setYears([...byYear.values()].sort((a, b) => b.year - a.year));

      const cycleIds = (cyclesResult.data ?? []).map((c) => c.id);
      if (cycleIds.length > 0) {
        const { data: batches } = await supabase
          .from("credit_batches")
          .select("id, cycle_id")
          .in("cycle_id", cycleIds);
        const batchIds = (batches ?? []).map((b) => b.id);
        if (batchIds.length > 0) {
          const { data: issuances } = await supabase
            .from("credit_issuances")
            .select("id, issued_amount_tco2e, issued_at, credit_batch_id")
            .in("credit_batch_id", batchIds);
          const issuanceIds = (issuances ?? []).map((i) => i.id);
          if (issuanceIds.length > 0) {
            const { data: tokenRows } = await supabase
              .from("blockchain_tokens")
              .select("token_id, status, credit_issuance_id")
              .in("credit_issuance_id", issuanceIds);
            const issuanceById = new Map((issuances ?? []).map((i) => [i.id, i]));
            setTokens(
              (tokenRows ?? []).map((t) => {
                const issuance = issuanceById.get(t.credit_issuance_id);
                return {
                  token_id: t.token_id,
                  status: t.status,
                  issued_amount_tco2e: Number(issuance?.issued_amount_tco2e ?? 0),
                  issued_at: issuance?.issued_at ?? "",
                };
              }),
            );
          }
        }
      }

      setLoading(false);
    }

    load();
  }, [projectId]);

  const totalEmitted = years.reduce((sum, y) => sum + y.emittedTco2e, 0);
  const totalCredited = years.reduce((sum, y) => sum + (y.batchTco2e ?? 0), 0);
  const totalRetiredTco2e = tokens.filter((t) => t.status === "retired").reduce((s, t) => s + t.issued_amount_tco2e, 0);
  const activeTokenCount = tokens.filter((t) => t.status === "active").length;

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <section>
      <h2 className="module-heading">
        <BarChart3 size={20} /> Relatório de Emissões
      </h2>
      <p>{projectName} — consolidado de inventário, vazamento e créditos por ano.</p>

      <ReportHeader
        developerLogoUrl={developerLogoUrl}
        developerName={developerName}
        proponentLogoUrl={proponentLogoUrl}
        proponentName={proponentName}
      />

      <div className="report-kpi-grid">
        <div className="card report-kpi-card">
          <span className="report-kpi-icon"><Cloud size={17} /></span>
          <div>
            <p className="report-kpi-label">Emissões inventariadas</p>
            <p className="metric">
              {totalEmitted.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
              <span className="metric-unit">tCO₂e</span>
            </p>
          </div>
        </div>
        <div className="card report-kpi-card">
          <span className="report-kpi-icon"><Recycle size={17} /></span>
          <div>
            <p className="report-kpi-label">Redução líquida creditada</p>
            <p className="metric">
              {totalCredited.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
              <span className="metric-unit">tCO₂e</span>
            </p>
          </div>
        </div>
        <div className="card report-kpi-card">
          <span className="report-kpi-icon"><BadgeCheck size={17} /></span>
          <div>
            <p className="report-kpi-label">Créditos aposentados</p>
            <p className="metric">
              {totalRetiredTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
              <span className="metric-unit">tCO₂e</span>
            </p>
          </div>
        </div>
        <div className="card report-kpi-card">
          <span className="report-kpi-icon"><Link2 size={17} /></span>
          <div>
            <p className="report-kpi-label">Tokens ativos</p>
            <p className="metric">{activeTokenCount}</p>
          </div>
        </div>
      </div>

      <h2>Por ano</h2>
      {years.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum dado de inventário, vazamento ou ciclo de crédito registrado ainda para este projeto.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ano</th>
              <th>Emissões inventariadas (tCO₂e)</th>
              <th>Vazamento (LF %)</th>
              <th>Lote de créditos (tCO₂e)</th>
              <th>Status do lote</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.year}>
                <td>{y.year}</td>
                <td>{y.emittedTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                <td>{y.leakagePct != null ? `${y.leakagePct}%` : "—"}</td>
                <td>{y.batchTco2e != null ? y.batchTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}</td>
                <td>
                  {y.batchStatus ? (
                    <span className={`badge ${y.batchStatus === "issued" ? "badge-success" : "badge-neutral"}`}>
                      {BATCH_STATUS_LABELS[y.batchStatus] ?? y.batchStatus}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Créditos tokenizados</h2>
      {tokens.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum crédito tokenizado ainda. Emita um lote em "Ciclo de créditos" para gerar o primeiro token.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Quantidade (tCO₂e)</th>
              <th>Status</th>
              <th>Emitido em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.token_id}>
                <td className="mono">{t.token_id}</td>
                <td>{t.issued_amount_tco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                <td>
                  <span
                    className={`badge ${
                      t.status === "active" ? "badge-success" : t.status === "retired" ? "badge-neutral" : "badge-info"
                    }`}
                  >
                    {t.status}
                  </span>
                </td>
                <td>{t.issued_at ? new Date(t.issued_at).toLocaleDateString("pt-BR") : "—"}</td>
                <td>
                  <Link to={`/verificar/${t.token_id}`} target="_blank" rel="noreferrer">
                    Página pública ↗
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

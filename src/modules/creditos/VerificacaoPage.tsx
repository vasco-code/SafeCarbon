import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { ShieldCheck, FileDown } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface VerificationCycle {
  id: string;
  period_start_year: number;
  period_end_year: number;
  vvb_org_id: string | null;
  status: string;
  findings: { texto: string } | null;
  verified_at: string | null;
}

export function VerificacaoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [cycles, setCycles] = useState<VerificationCycle[]>([]);
  const [vvbOrgs, setVvbOrgs] = useState<{ id: string; name: string }[]>([]);
  const [startYear, setStartYear] = useState("2025");
  const [endYear, setEndYear] = useState("2025");
  const [vvbOrgId, setVvbOrgId] = useState("");
  const [findingsByCycle, setFindingsByCycle] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [reportYear, setReportYear] = useState("2025");
  const [reportGenerating, setReportGenerating] = useState(false);

  async function loadData() {
    if (!projectId) return;
    const [cyclesResult, orgsResult] = await Promise.all([
      supabase
        .from("verification_cycles")
        .select("id, period_start_year, period_end_year, vvb_org_id, status, findings, verified_at")
        .eq("project_id", projectId)
        .order("period_start_year", { ascending: false }),
      supabase.from("organizations").select("id, name").eq("org_type", "verifier"),
    ]);
    setCycles(cyclesResult.data ?? []);
    setVvbOrgs(orgsResult.data ?? []);
  }

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function handleSchedule(event: FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    setError(null);
    const { error } = await supabase.from("verification_cycles").insert({
      project_id: projectId,
      period_start_year: Number(startYear),
      period_end_year: Number(endYear),
      vvb_org_id: vvbOrgId || null,
      status: "scheduled",
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage("Ciclo de verificação agendado.");
      loadData();
    }
  }

  async function handleReview(cycle: VerificationCycle, decision: "approved" | "rejected") {
    if (!projectId) return;
    setSubmitting(cycle.id);
    setError(null);
    setMessage(null);

    const findingsText = findingsByCycle[cycle.id]?.trim();
    if (!findingsText) {
      setError("Registre o parecer (findings) antes de aprovar ou rejeitar.");
      setSubmitting(null);
      return;
    }

    const { error: verificationError } = await supabase
      .from("verification_cycles")
      .update({ status: decision, findings: { texto: findingsText }, verified_at: new Date().toISOString() })
      .eq("id", cycle.id);
    if (verificationError) {
      setError(verificationError.message);
      setSubmitting(null);
      return;
    }

    const { data: creditCycle } = await supabase
      .from("credit_calculation_cycles")
      .select("id")
      .eq("project_id", projectId)
      .eq("period_year", cycle.period_start_year)
      .maybeSingle();

    if (creditCycle) {
      await supabase
        .from("credit_calculation_cycles")
        .update({ status: decision === "approved" ? "verified" : "rejected" })
        .eq("id", creditCycle.id);

      if (decision === "approved") {
        await supabase.from("credit_batches").update({ status: "approved" }).eq("cycle_id", creditCycle.id);
      }
    }

    setSubmitting(null);
    setMessage(`Ciclo ${decision === "approved" ? "aprovado" : "rejeitado"}.`);
    loadData();
  }

  async function handleGenerateReport() {
    if (!projectId) return;
    setReportGenerating(true);
    setError(null);
    const periodYear = Number(reportYear);

    const [summaryResult, inventoryResult, leakageResult] = await Promise.all([
      supabase
        .from("production_period_summary")
        .select("total_produced_kg, total_commercialized_kg, commercialization_factor")
        .eq("project_id", projectId)
        .eq("period_year", periodYear)
        .maybeSingle(),
      supabase
        .from("emission_inventory_entries")
        .select("source_type, calculated_tco2e")
        .eq("project_id", projectId)
        .eq("period_year", periodYear),
      supabase
        .from("leakage_assessments")
        .select("category, conclusion, leakage_factor_pct")
        .eq("project_id", projectId)
        .eq("period_year", periodYear),
    ]);

    const summary = summaryResult.data;
    const inventory = inventoryResult.data ?? [];
    const leakage = leakageResult.data ?? [];
    const totalInventario = inventory.reduce((sum, e) => sum + Number(e.calculated_tco2e), 0);

    const html = [
      `<html><head><meta charset="utf-8"></head><body>`,
      `<h1>Relatório de Monitoramento — ${reportYear}</h1>`,
      `<p>Produção: ${summary?.total_produced_kg?.toLocaleString("pt-BR") ?? "—"} kg. Comercialização: ${summary?.total_commercialized_kg?.toLocaleString("pt-BR") ?? "—"} kg (Fc = ${summary?.commercialization_factor?.toFixed(4) ?? "—"}).</p>`,
      `<h2>Inventário de emissões</h2>`,
      `<ul>${inventory.map((e) => `<li>${e.source_type}: ${Number(e.calculated_tco2e).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} tCO2e</li>`).join("")}</ul>`,
      `<p>Total: ${totalInventario.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} tCO2e</p>`,
      `<h2>Avaliação de vazamentos</h2>`,
      `<ul>${leakage.map((l) => `<li>${l.category}: ${l.conclusion} (LF = ${l.leakage_factor_pct}%)</li>`).join("")}</ul>`,
      `</body></html>`,
    ].join("\n");

    const { error: insertError } = await supabase
      .from("monitoring_reports")
      .insert({ project_id: projectId, period_year: periodYear });

    setReportGenerating(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Relatorio-Monitoramento-${reportYear}.doc`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Relatório de monitoramento gerado.");
  }

  return (
    <section>
      <h2 className="module-heading">
        <ShieldCheck size={20} /> Verificação e Emissão
      </h2>
      <p>Ciclos de verificação, pareceres e status de tokenização.</p>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      <h2>Agendar ciclo de verificação</h2>
      <form onSubmit={handleSchedule}>
        <label htmlFor="ver-start">Ano inicial</label>
        <input id="ver-start" type="number" value={startYear} onChange={(e) => setStartYear(e.target.value)} required />

        <label htmlFor="ver-end">Ano final</label>
        <input id="ver-end" type="number" value={endYear} onChange={(e) => setEndYear(e.target.value)} required />

        <label htmlFor="ver-vvb">Organismo verificador (VVB)</label>
        <select id="ver-vvb" value={vvbOrgId} onChange={(e) => setVvbOrgId(e.target.value)}>
          <option value="">(não listado — sem acesso de leitura a outras organizações)</option>
          {vvbOrgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>

        <button type="submit">Agendar</button>
      </form>

      <h2>Relatório de Monitoramento</h2>
      <div className="action-bar">
        <div className="action-bar-field">
          <label htmlFor="report-year">Ano</label>
          <input id="report-year" type="number" value={reportYear} onChange={(e) => setReportYear(e.target.value)} />
        </div>
        <button type="button" className="btn-primary" onClick={handleGenerateReport} disabled={reportGenerating}>
          <FileDown size={15} />
          {reportGenerating ? "Gerando..." : "Gerar relatório de monitoramento (.doc)"}
        </button>
      </div>

      <h2>Ciclos de verificação</h2>
      {cycles.map((cycle) => (
        <div key={cycle.id} className="dcp-section">
          <h2>
            {cycle.period_start_year}–{cycle.period_end_year} — status: {cycle.status}
          </h2>
          {cycle.findings && <p>Parecer registrado: {cycle.findings.texto}</p>}
          {cycle.verified_at && <p>Concluído em {new Date(cycle.verified_at).toLocaleString("pt-BR")}</p>}

          {(cycle.status === "scheduled" || cycle.status === "in_progress") && (
            <>
              <label htmlFor={`findings-${cycle.id}`}>Parecer (findings)</label>
              <textarea
                id={`findings-${cycle.id}`}
                rows={3}
                value={findingsByCycle[cycle.id] ?? ""}
                onChange={(e) => setFindingsByCycle((prev) => ({ ...prev, [cycle.id]: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => handleReview(cycle, "approved")}
                disabled={submitting === cycle.id}
              >
                Aprovar
              </button>{" "}
              <button
                type="button"
                onClick={() => handleReview(cycle, "rejected")}
                disabled={submitting === cycle.id}
              >
                Rejeitar
              </button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

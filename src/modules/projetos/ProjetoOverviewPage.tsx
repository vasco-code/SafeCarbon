import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

type ProjectStatus = "design" | "validation" | "active" | "suspended" | "closed";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  design: "Em design",
  validation: "Em validação",
  active: "Ativo",
  suspended: "Suspenso",
  closed: "Encerrado",
};

const STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  design: "badge-neutral",
  validation: "badge-warning",
  active: "badge-success",
  suspended: "badge-warning",
  closed: "badge-neutral",
};

function StatusCard({ projectId }: { projectId: string }) {
  const [currentStatus, setCurrentStatus] = useState<ProjectStatus | null>(null);
  const [newStatus, setNewStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowedTransitions: Record<ProjectStatus, ProjectStatus[]> = {
    design: ["validation", "suspended"],
    validation: ["active", "design", "suspended"],
    active: ["suspended", "closed"],
    suspended: ["active", "closed"],
    closed: [],
  };

  async function loadStatus() {
    const { data } = await supabase
      .from("carbon_projects")
      .select("status")
      .eq("id", projectId)
      .maybeSingle();
    if (data) {
      setCurrentStatus(data.status as ProjectStatus);
      setNewStatus(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadStatus();
  }, [projectId]);

  async function handleUpdateStatus() {
    if (!newStatus || newStatus === currentStatus) return;
    setUpdating(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase
      .from("carbon_projects")
      .update({ status: newStatus })
      .eq("id", projectId);

    setUpdating(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage(`Status alterado de "${STATUS_LABELS[currentStatus!]}" para "${STATUS_LABELS[newStatus]}"`);
      setCurrentStatus(newStatus);
      setNewStatus(null);
    }
  }

  if (loading || !currentStatus) return null;

  const availableTransitions = allowedTransitions[currentStatus];

  return (
    <div style={{ marginBottom: "2rem" }}>
      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          border: "2px solid var(--sc-border)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>Status do Projeto</h2>

        <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.5rem" }}>Status atual</div>
            <span className={`badge ${STATUS_BADGE_CLASS[currentStatus]}`} style={{ fontSize: "1rem", padding: "0.5rem 1rem" }}>
              {STATUS_LABELS[currentStatus]}
            </span>
          </div>

          {availableTransitions.length > 0 && (
            <>
              <ArrowRight size={20} color="#999" />
              <div>
                <label htmlFor="new-status" style={{ fontSize: "0.875rem", color: "#666", display: "block", marginBottom: "0.5rem" }}>
                  Alterar para
                </label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <select
                    id="new-status"
                    value={newStatus || ""}
                    onChange={(e) => setNewStatus((e.target.value || null) as ProjectStatus | null)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Selecione...</option>
                    {availableTransitions.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleUpdateStatus}
                    disabled={!newStatus || newStatus === currentStatus || updating}
                  >
                    {updating ? "Atualizando..." : "Atualizar"}
                  </button>
                </div>
              </div>
            </>
          )}

          {availableTransitions.length === 0 && (
            <div style={{ color: "#666", fontSize: "0.875rem" }}>
              Projeto finalizado — nenhuma transição de status disponível
            </div>
          )}
        </div>

        {message && <p style={{ color: "green", marginTop: "1rem", marginBottom: 0 }}>✓ {message}</p>}
        {error && <p style={{ color: "red", marginTop: "1rem", marginBottom: 0 }}>✗ {error}</p>}
      </div>
    </div>
  );
}

function ResumoCalculoCard({ projectId }: { projectId: string }) {
  const [year, setYear] = useState("2025");
  const [narrativeText, setNarrativeText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLatest(targetYear: string) {
    const { data: cycle } = await supabase
      .from("credit_calculation_cycles")
      .select("id")
      .eq("project_id", projectId)
      .eq("period_year", Number(targetYear))
      .maybeSingle();
    if (!cycle) {
      setNarrativeText(null);
      return;
    }
    const { data: resumo } = await supabase
      .from("resumo_calculo_documents")
      .select("narrative_text")
      .eq("cycle_id", cycle.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setNarrativeText(resumo?.narrative_text ?? null);
  }

  useEffect(() => {
    loadLatest(year);
  }, [projectId]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const periodYear = Number(year);

    const { data: cycle } = await supabase
      .from("credit_calculation_cycles")
      .select("id")
      .eq("project_id", projectId)
      .eq("period_year", periodYear)
      .maybeSingle();

    if (!cycle) {
      setError(`Nenhum ciclo calculado para ${year} — calcule em "Ciclo de créditos" primeiro.`);
      setLoading(false);
      return;
    }

    const [stepsResult, batchResult, inventoryResult] = await Promise.all([
      supabase
        .from("credit_calculation_steps")
        .select("step_key, output_value")
        .eq("cycle_id", cycle.id),
      supabase
        .from("credit_batches")
        .select("tco2e_amount, commercialization_factor")
        .eq("cycle_id", cycle.id)
        .maybeSingle(),
      supabase
        .from("emission_inventory_entries")
        .select("calculated_tco2e")
        .eq("project_id", projectId)
        .eq("period_year", periodYear),
    ]);

    const stepValue = (key: string) => stepsResult.data?.find((s) => s.step_key === key)?.output_value ?? 0;
    const batch = batchResult.data;
    const eOperacionais = (inventoryResult.data ?? []).reduce((sum, e) => sum + Number(e.calculated_tco2e), 0);

    const text = [
      `Resumo do Cálculo — Ciclo ${year}`,
      "",
      `No ciclo ${year}, a Premix produziu ${stepValue("producao_anual").toLocaleString("pt-BR")} toneladas do aditivo Fator P, das quais ${(stepValue("comercializacao") * stepValue("producao_anual")).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} toneladas foram comercializadas (fator de comercialização Fc = ${batch?.commercialization_factor?.toFixed(4) ?? "—"}).`,
      "",
      `A partir do consumo médio estimado por animal, projeta-se cobertura para aproximadamente ${Math.round(stepValue("estimativa_cobertura_animal")).toLocaleString("pt-BR")} animais suplementados — estimativa técnica intermediária, não uma unidade de crédito.`,
      "",
      `As emissões de metano entérico evitadas somam ${stepValue("conversao_co2e").toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO2e brutas. Após dedução de ${eOperacionais.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO2e de emissões operacionais da cadeia produtiva do aditivo, e aplicação dos descontos de incerteza e do buffer de integridade previstos na metodologia, a redução final elegível para geração de créditos de carbono é de ${batch?.tco2e_amount.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) ?? "—"} tCO2e.`,
    ].join("\n");

    const { error: insertError } = await supabase
      .from("resumo_calculo_documents")
      .insert({ cycle_id: cycle.id, narrative_text: text });

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setNarrativeText(text);
    }
  }

  return (
    <div className="dcp-section">
      <h2>Resumo de Cálculo</h2>
      <div className="action-bar">
        <div className="action-bar-field">
          <label htmlFor="resumo-year">Ano</label>
          <input
            id="resumo-year"
            type="number"
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              loadLatest(e.target.value);
            }}
          />
        </div>
        <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loading}>
          <Sparkles size={15} />
          {loading ? "Gerando..." : "Gerar resumo"}
        </button>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {narrativeText && <pre className="dcp-generated-content">{narrativeText}</pre>}
    </div>
  );
}

export function ProjetoOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return (
    <>
      <StatusCard projectId={projectId} />
      <ResumoCalculoCard projectId={projectId} />
    </>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowRight, Calendar, Package, Leaf, Award } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProjectRole } from "@/hooks/useProjectRole";

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

const CYCLE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  calculated: "Calculado",
  in_verification: "Em verificação",
  verified: "Verificado",
  approved: "Aprovado",
  issued: "Emitido",
  rejected: "Rejeitado",
};

interface PendingRequest {
  id: string;
  requested_status: ProjectStatus;
  reason: string | null;
  created_at: string;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card report-kpi-card">
      <span className="report-kpi-icon">
        <Icon size={17} />
      </span>
      <div>
        <p className="report-kpi-label">{label}</p>
        <p className="metric">{value}</p>
        {hint && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--sc-muted)" }}>{hint}</p>}
      </div>
    </div>
  );
}

function StatusCard({
  projectId,
  accessLevel,
}: {
  projectId: string;
  accessLevel: "full" | "proponent" | "verifier" | null;
}) {
  const [currentStatus, setCurrentStatus] = useState<ProjectStatus | null>(null);
  const [newStatus, setNewStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

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

  async function loadPendingRequest() {
    const { data } = await supabase
      .from("project_status_requests")
      .select("id, requested_status, reason, created_at")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPendingRequest((data as PendingRequest) ?? null);
  }

  useEffect(() => {
    loadStatus();
    loadPendingRequest();
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

  async function handleRequestInactivation() {
    setUpdating(true);
    setError(null);
    setMessage(null);

    const { data: userData } = await supabase.auth.getUser();
    const { data: project } = await supabase
      .from("carbon_projects")
      .select("proponent_org_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      setUpdating(false);
      setError("Não foi possível identificar a organização proponente.");
      return;
    }

    const { error: insertError } = await supabase.from("project_status_requests").insert({
      project_id: projectId,
      requested_by: userData.user?.id,
      requested_by_org_id: project.proponent_org_id,
      requested_status: "suspended",
      reason: requestReason || null,
    });

    setUpdating(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setMessage("Solicitação de inativação enviada — aguardando aprovação.");
      setShowRequestForm(false);
      setRequestReason("");
      loadPendingRequest();
    }
  }

  async function handleResolveRequest(approve: boolean) {
    if (!pendingRequest) return;
    setUpdating(true);
    setError(null);
    setMessage(null);

    const { error: rpcError } = await supabase.rpc("resolve_project_status_request", {
      p_request_id: pendingRequest.id,
      p_approve: approve,
      p_review_note: reviewNote || null,
    });

    setUpdating(false);
    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMessage(approve ? "Solicitação aprovada — status atualizado." : "Solicitação rejeitada.");
      setReviewNote("");
      loadStatus();
      loadPendingRequest();
    }
  }

  if (loading || !currentStatus) return null;

  const availableTransitions = allowedTransitions[currentStatus];
  const canManageFull = accessLevel === "full";
  const canRequest = accessLevel === "proponent";

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

          {canManageFull && availableTransitions.length > 0 && (
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

          {canRequest && !pendingRequest && currentStatus !== "closed" && currentStatus !== "suspended" && (
            <>
              <ArrowRight size={20} color="#999" />
              <div>
                {!showRequestForm ? (
                  <button type="button" className="btn-primary" onClick={() => setShowRequestForm(true)}>
                    Solicitar inativação
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "16rem" }}>
                    <label htmlFor="request-reason">Motivo (opcional)</label>
                    <textarea
                      id="request-reason"
                      value={requestReason}
                      onChange={(e) => setRequestReason(e.target.value)}
                      rows={2}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="button" className="btn-primary" onClick={handleRequestInactivation} disabled={updating}>
                        {updating ? "Enviando..." : "Enviar solicitação"}
                      </button>
                      <button type="button" onClick={() => setShowRequestForm(false)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {canRequest && pendingRequest && (
            <div style={{ color: "#666", fontSize: "0.875rem" }}>
              Solicitação de inativação enviada em {new Date(pendingRequest.created_at).toLocaleDateString("pt-BR")} —
              aguardando aprovação.
            </div>
          )}

          {!canManageFull && !canRequest && availableTransitions.length === 0 && (
            <div style={{ color: "#666", fontSize: "0.875rem" }}>
              Projeto finalizado — nenhuma transição de status disponível
            </div>
          )}
        </div>

        {canManageFull && pendingRequest && (
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "#fff3cd",
              borderRadius: "6px",
              border: "1px solid #f0d888",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>
              Pedido de inativação pendente — mudar para "{STATUS_LABELS[pendingRequest.requested_status]}"
            </p>
            {pendingRequest.reason && <p style={{ margin: "0.5rem 0" }}>Motivo: {pendingRequest.reason}</p>}
            <label htmlFor="review-note">Nota da revisão (opcional)</label>
            <textarea id="review-note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button type="button" className="btn-primary" onClick={() => handleResolveRequest(true)} disabled={updating}>
                Aprovar
              </button>
              <button type="button" className="btn-icon-danger" onClick={() => handleResolveRequest(false)} disabled={updating}>
                Rejeitar
              </button>
            </div>
          </div>
        )}

        {message && <p style={{ color: "green", marginTop: "1rem", marginBottom: 0 }}>✓ {message}</p>}
        {error && <p style={{ color: "red", marginTop: "1rem", marginBottom: 0 }}>✗ {error}</p>}
      </div>
    </div>
  );
}

function KpiCardsRow({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [cycleYear, setCycleYear] = useState<number | null>(null);
  const [cycleStatus, setCycleStatus] = useState<string | null>(null);
  const [commercializedKg, setCommercializedKg] = useState<number | null>(null);
  const [eligibleTco2e, setEligibleTco2e] = useState<number | null>(null);
  const [totalIssuedTco2e, setTotalIssuedTco2e] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: cycles } = await supabase
        .from("credit_calculation_cycles")
        .select("id, period_year, status, credit_batches(tco2e_amount, credit_issuances(issued_amount_tco2e))")
        .eq("project_id", projectId)
        .order("period_year", { ascending: false });

      const cyclesTyped = (cycles ?? []) as unknown as {
        period_year: number;
        status: string;
        credit_batches: { tco2e_amount: number; credit_issuances: { issued_amount_tco2e: number }[] }[];
      }[];

      const latest = cyclesTyped[0];
      if (latest) {
        setCycleYear(latest.period_year);
        setCycleStatus(latest.status);
        setEligibleTco2e(latest.credit_batches?.[0]?.tco2e_amount ?? null);
      }

      const totalIssued = cyclesTyped.reduce(
        (sum, c) =>
          sum +
          (c.credit_batches ?? []).reduce(
            (s2, b) => s2 + (b.credit_issuances ?? []).reduce((s3, i) => s3 + Number(i.issued_amount_tco2e), 0),
            0,
          ),
        0,
      );
      setTotalIssuedTco2e(totalIssued);

      const { data: production } = await supabase
        .from("production_period_summary")
        .select("period_year, total_commercialized_kg")
        .eq("project_id", projectId)
        .order("period_year", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCommercializedKg(production?.total_commercialized_kg ?? null);

      setLoading(false);
    }
    load();
  }, [projectId]);

  if (loading) return null;

  return (
    <div className="report-kpi-grid" style={{ marginBottom: "2rem" }}>
      <KpiCard
        icon={Calendar}
        label="Ciclo vigente"
        value={cycleYear ? String(cycleYear) : "—"}
        hint={cycleStatus ? CYCLE_STATUS_LABELS[cycleStatus] ?? cycleStatus : undefined}
      />
      <KpiCard
        icon={Package}
        label="Produto comercializado"
        value={
          commercializedKg != null
            ? `${commercializedKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`
            : "—"
        }
      />
      <KpiCard
        icon={Leaf}
        label="Redução de emissões elegível"
        value={
          eligibleTco2e != null
            ? `${eligibleTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`
            : "—"
        }
      />
      <KpiCard
        icon={Award}
        label="Créditos gerados"
        value={`${totalIssuedTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`}
      />
    </div>
  );
}

export function ProjetoOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { accessLevel } = useProjectRole(projectId);
  if (!projectId) return null;
  return (
    <>
      <StatusCard projectId={projectId} accessLevel={accessLevel} />
      <KpiCardsRow projectId={projectId} />
    </>
  );
}

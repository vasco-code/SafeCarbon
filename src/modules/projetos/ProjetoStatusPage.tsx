import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowRight, Flag } from "lucide-react";
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

interface PendingRequest {
  id: string;
  requested_status: ProjectStatus;
  reason: string | null;
  created_at: string;
}

export function ProjetoStatusPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { accessLevel } = useProjectRole(projectId);

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
    if (!projectId) return;
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
    if (!projectId) return;
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
    if (!newStatus || newStatus === currentStatus || !projectId) return;
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
    if (!projectId) return;
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

  if (!projectId) return null;
  if (loading || !currentStatus) return <p>Carregando...</p>;

  const availableTransitions = allowedTransitions[currentStatus];
  const canManageFull = accessLevel === "full";
  const canRequest = accessLevel === "proponent";

  return (
    <section>
      <h2 className="module-heading">
        <Flag size={20} /> Status do Projeto
      </h2>
      <p>Situação atual do projeto e transições disponíveis.</p>

      <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
        <div>
          <div style={{ fontSize: "0.875rem", color: "var(--sc-muted)", marginBottom: "0.5rem" }}>Status atual</div>
          <span className={`badge ${STATUS_BADGE_CLASS[currentStatus]}`} style={{ fontSize: "1rem", padding: "0.5rem 1rem" }}>
            {STATUS_LABELS[currentStatus]}
          </span>
        </div>

        {canManageFull && availableTransitions.length > 0 && (
          <>
            <ArrowRight size={20} color="var(--sc-muted)" />
            <div>
              <label htmlFor="new-status" style={{ fontSize: "0.875rem", color: "var(--sc-muted)", display: "block", marginBottom: "0.5rem" }}>
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
            <ArrowRight size={20} color="var(--sc-muted)" />
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
          <div style={{ color: "var(--sc-muted)", fontSize: "0.875rem" }}>
            Solicitação de inativação enviada em {new Date(pendingRequest.created_at).toLocaleDateString("pt-BR")} —
            aguardando aprovação.
          </div>
        )}

        {!canManageFull && !canRequest && availableTransitions.length === 0 && (
          <div style={{ color: "var(--sc-muted)", fontSize: "0.875rem" }}>
            Projeto finalizado — nenhuma transição de status disponível
          </div>
        )}
      </div>

      {canManageFull && pendingRequest && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            backgroundColor: "var(--sc-surface)",
            borderRadius: "var(--sc-radius)",
            border: "1px solid var(--sc-border)",
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

      {message && <p className="auth-success">{message}</p>}
      {error && <p className="auth-error">{error}</p>}
    </section>
  );
}

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { History, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  performed_by: string;
  organization_id: string | null;
  changes: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
  related_entity_id: string | null;
  related_entity_type: string | null;
  user_email?: string;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criado",
  UPDATE: "Modificado",
  DELETE: "Deletado",
  SOFT_DELETE: "Arquivado",
  RESTORE: "Restaurado",
  PUBLISH: "Publicado",
  DEPRECATE: "Descontinuado",
};

const ENTITY_LABELS: Record<string, string> = {
  methodology: "Metodologia",
  methodology_version: "Versão de Metodologia",
  project: "Projeto",
  organization: "Organização",
  dcp_document: "Documento DCP",
};

export function AuditoriaPage() {
  const [searchParams] = useSearchParams();
  const { memberships, isPlatformAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const entityType = searchParams.get("entity_type");
  const entityId = searchParams.get("entity_id");

  async function loadLogs() {
    setLoading(true);
    let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false });

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    // Se não é admin, filtrar por organização
    if (!isPlatformAdmin && memberships.length > 0) {
      const orgIds = memberships.map((m) => m.orgId);
      query = query.in("organization_id", orgIds);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error("Erro ao carregar logs:", error);
    } else {
      setLogs((data || []) as AuditLog[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadLogs();
  }, [entityType, entityId, isPlatformAdmin, memberships]);

  const title = entityType
    ? `Histórico — ${ENTITY_LABELS[entityType] || entityType}`
    : "Auditoria e Histórico";

  if (loading) {
    return <p>Carregando histórico...</p>;
  }

  return (
    <section>
      <h1 className="module-heading">
        <History size={22} /> {title}
      </h1>

      {logs.length === 0 ? (
        <p style={{ textAlign: "center", color: "#999", marginTop: "2rem" }}>
          Nenhum registro de atividade encontrado.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {logs.map((log) => (
            <div
              key={log.id}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: "6px",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                style={{
                  width: "100%",
                  padding: "1rem",
                  border: "none",
                  background: "#f9f9f9",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textAlign: "left",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#f9f9f9")}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "3px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        marginRight: "0.5rem",
                        backgroundColor:
                          log.action === "CREATE"
                            ? "#e8f5e9"
                            : log.action === "DELETE" || log.action === "SOFT_DELETE"
                              ? "#ffebee"
                              : log.action === "PUBLISH"
                                ? "#c8e6c9"
                                : "#fff3cd",
                        color:
                          log.action === "CREATE"
                            ? "#2e7d32"
                            : log.action === "DELETE" || log.action === "SOFT_DELETE"
                              ? "#c62828"
                              : log.action === "PUBLISH"
                                ? "#388e3c"
                                : "#856404",
                      }}
                    >
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    {ENTITY_LABELS[log.entity_type] || log.entity_type}
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "#666",
                    }}
                  >
                    {new Date(log.created_at).toLocaleString("pt-BR")} · {log.user_email || "Usuário desconhecido"}
                  </div>
                </div>
                <ChevronDown
                  size={20}
                  style={{
                    transition: "transform 0.2s",
                    transform: expandedId === log.id ? "rotate(180deg)" : "rotate(0deg)",
                    color: "#999",
                  }}
                />
              </button>

              {expandedId === log.id && (
                <div
                  style={{
                    padding: "1rem",
                    borderTop: "1px solid #e0e0e0",
                    backgroundColor: "#fafafa",
                    fontSize: "0.875rem",
                  }}
                >
                  <div style={{ marginBottom: "1rem" }}>
                    <strong>Entidade:</strong> {log.entity_type} ({log.entity_id.slice(0, 8)}...)
                  </div>

                  {log.changes && (
                    <div style={{ marginBottom: "1rem" }}>
                      <strong>Mudanças:</strong>
                      <pre
                        style={{
                          backgroundColor: "#fff",
                          padding: "0.75rem",
                          borderRadius: "4px",
                          overflow: "auto",
                          fontSize: "0.8rem",
                          margin: "0.5rem 0 0 0",
                        }}
                      >
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </div>
                  )}

                  {log.ip_address && (
                    <div style={{ marginBottom: "1rem" }}>
                      <strong>IP:</strong> {log.ip_address}
                    </div>
                  )}

                  {log.related_entity_id && (
                    <div>
                      <strong>Relacionado a:</strong> {log.related_entity_type} ({log.related_entity_id.slice(0, 8)}...)
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProjectRole } from "@/hooks/useProjectRole";
import { DistribuicaoPage } from "@/modules/distribuicao/DistribuicaoPage";

interface OrgInfo {
  name: string;
  logo_url: string | null;
  tax_id: string | null;
}

interface ProjectDescriptive {
  name: string;
  location_text: string | null;
  description: string | null;
  registry_standard: string;
  organizations_proponent: OrgInfo | null;
  organizations_developer: OrgInfo | null;
  methodology_versions: {
    version_label: string;
    methodologies: { name: string; sector: string; ipcc_category: string | null } | null;
  } | null;
}

const REGISTRY_LABELS: Record<string, string> = {
  verra: "Verra",
  gold_standard: "Gold Standard",
  mbre: "MBRE",
  none_yet: "Nenhum ainda",
};

function OrgSummary({ label, org }: { label: string; org: OrgInfo | null }) {
  if (!org) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      {org.logo_url ? (
        <img src={org.logo_url} alt={org.name} style={{ maxWidth: "48px", maxHeight: "48px", objectFit: "contain" }} />
      ) : null}
      <div>
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--sc-muted)" }}>{label}</p>
        <p style={{ margin: 0, fontWeight: 600 }}>{org.name}</p>
        {org.tax_id && <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--sc-muted)" }}>{org.tax_id}</p>}
      </div>
    </div>
  );
}

export function DescritivoProjetoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { accessLevel } = useProjectRole(projectId);
  const [project, setProject] = useState<ProjectDescriptive | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProject() {
    if (!projectId) return;
    const { data } = await supabase
      .from("carbon_projects")
      .select(
        "name, location_text, description, registry_standard, organizations_proponent:proponent_org_id(name, logo_url, tax_id), organizations_developer:developer_org_id(name, logo_url, tax_id), methodology_versions(version_label, methodologies(name, sector, ipcc_category))",
      )
      .eq("id", projectId)
      .maybeSingle();
    const p = data as unknown as ProjectDescriptive | null;
    setProject(p);
    setDescription(p?.description ?? "");
    setLoading(false);
  }

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function handleSaveDescription() {
    if (!projectId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const { error: updateError } = await supabase
      .from("carbon_projects")
      .update({ description })
      .eq("id", projectId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Descrição salva.");
      loadProject();
    }
  }

  if (loading) return <p>Carregando...</p>;
  if (!project) return null;

  const canEdit = accessLevel === "full";

  return (
    <section>
      <h2 className="module-heading">
        <FileText size={20} /> Descritivo do Projeto
      </h2>

      <div className="report-kpi-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="card" style={{ padding: "1rem" }}>
          <OrgSummary label="Organização proponente" org={project.organizations_proponent} />
        </div>
        <div className="card" style={{ padding: "1rem" }}>
          <OrgSummary label="Organização desenvolvedora (MRV)" org={project.organizations_developer} />
        </div>
      </div>

      <table style={{ marginBottom: "1.5rem" }}>
        <tbody>
          <tr>
            <th style={{ textAlign: "left", width: "12rem" }}>Metodologia</th>
            <td>
              {project.methodology_versions?.methodologies?.name ?? "—"}
              {project.methodology_versions ? ` v${project.methodology_versions.version_label}` : ""}
            </td>
          </tr>
          <tr>
            <th style={{ textAlign: "left" }}>Setor / Categoria IPCC</th>
            <td>
              {project.methodology_versions?.methodologies?.sector ?? "—"}
              {project.methodology_versions?.methodologies?.ipcc_category
                ? ` — ${project.methodology_versions.methodologies.ipcc_category}`
                : ""}
            </td>
          </tr>
          <tr>
            <th style={{ textAlign: "left" }}>Padrão de registro</th>
            <td>{REGISTRY_LABELS[project.registry_standard] ?? project.registry_standard}</td>
          </tr>
          <tr>
            <th style={{ textAlign: "left" }}>Localização</th>
            <td>{project.location_text ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      <h3>Descrição</h3>
      {canEdit ? (
        <>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            style={{ width: "100%" }}
            placeholder="Descreva o projeto: contexto, produto, metodologia aplicada, resultados esperados..."
          />
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          <button type="button" className="btn-primary" onClick={handleSaveDescription} disabled={saving} style={{ marginTop: "0.5rem" }}>
            {saving ? "Salvando..." : "Salvar descrição"}
          </button>
        </>
      ) : (
        <p>{project.description ?? "Nenhuma descrição cadastrada ainda."}</p>
      )}

      <div style={{ marginTop: "2rem" }}>
        <DistribuicaoPage />
      </div>
    </section>
  );
}

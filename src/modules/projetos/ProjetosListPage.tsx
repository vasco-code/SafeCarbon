import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ProjectRow {
  id: string;
  name: string;
  status: string;
}

interface OrgOption {
  id: string;
  name: string;
}

interface MethodologyVersionOption {
  id: string;
  version_label: string;
  methodologies: { name: string } | null;
}

type OrgType = "proponent" | "project_developer" | "verifier" | "buyer";
type RegistryStandard = "none_yet" | "verra" | "gold_standard" | "mbre";

const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: "proponent", label: "Proponente" },
  { value: "project_developer", label: "Desenvolvedor técnico" },
  { value: "verifier", label: "Verificador (VVB)" },
  { value: "buyer", label: "Comprador de crédito" },
];

const REGISTRY_STANDARDS: { value: RegistryStandard; label: string }[] = [
  { value: "none_yet", label: "Nenhum ainda" },
  { value: "verra", label: "Verra" },
  { value: "gold_standard", label: "Gold Standard" },
  { value: "mbre", label: "MBRE" },
];

function OrgPicker({
  label,
  orgs,
  value,
  onChange,
  onOrgCreated,
}: {
  label: string;
  orgs: OrgOption[];
  value: string;
  onChange: (id: string) => void;
  onOrgCreated: (org: OrgOption) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<OrgType>("proponent");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name: newName, org_type: newType })
      .select("id, name")
      .single();
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    onOrgCreated(data);
    onChange(data.id);
    setCreating(false);
    setNewName("");
  }

  return (
    <div>
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione...</option>
        {orgs.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      {!creating && (
        <button type="button" onClick={() => setCreating(true)} className="btn-icon-danger" style={{ color: "var(--sc-primary)" }}>
          + Criar nova organização
        </button>
      )}
      {creating && (
        <div className="nfe-preview">
          <label htmlFor={`new-org-name-${label}`}>Nome da organização</label>
          <input
            id={`new-org-name-${label}`}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <label htmlFor={`new-org-type-${label}`}>Tipo</label>
          <select id={`new-org-type-${label}`} value={newType} onChange={(e) => setNewType(e.target.value as OrgType)}>
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {error && <p className="auth-error">{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="button" onClick={handleCreate} disabled={submitting || !newName.trim()}>
              {submitting ? "Criando..." : "Criar"}
            </button>
            <button type="button" onClick={() => setCreating(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjetosListPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [methodologyVersions, setMethodologyVersions] = useState<MethodologyVersionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [proponentOrgId, setProponentOrgId] = useState("");
  const [developerOrgId, setDeveloperOrgId] = useState("");
  const [methodologyVersionId, setMethodologyVersionId] = useState("");
  const [registryStandard, setRegistryStandard] = useState<RegistryStandard>("none_yet");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    const [projectsResult, orgsResult, methodologyResult] = await Promise.all([
      supabase.from("carbon_projects").select("id, name, status").order("created_at", { ascending: false }),
      supabase.from("organizations").select("id, name").order("name"),
      supabase
        .from("methodology_versions")
        .select("id, version_label, methodologies(name)")
        .eq("status", "published"),
    ]);
    setProjects(projectsResult.data ?? []);
    setOrgs(orgsResult.data ?? []);
    setMethodologyVersions((methodologyResult.data ?? []) as unknown as MethodologyVersionOption[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOrgCreated(org: OrgOption) {
    setOrgs((prev) => [...prev, org].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    if (!proponentOrgId || !developerOrgId) {
      setError("Selecione a organização proponente e a desenvolvedora.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { data: project, error: projectError } = await supabase
      .from("carbon_projects")
      .insert({
        name,
        proponent_org_id: proponentOrgId,
        developer_org_id: developerOrgId,
        methodology_version_id: methodologyVersionId || null,
        registry_standard: registryStandard,
      })
      .select("id")
      .single();

    if (projectError || !project) {
      setError(projectError?.message ?? "Erro ao criar o projeto.");
      setSubmitting(false);
      return;
    }

    const roleRows = [{ project_id: project.id, org_id: proponentOrgId, role: "proponent" }];
    if (developerOrgId !== proponentOrgId) {
      roleRows.push({ project_id: project.id, org_id: developerOrgId, role: "developer" });
    }
    const { error: rolesError } = await supabase.from("project_roles").insert(roleRows);

    setSubmitting(false);
    if (rolesError) {
      setError(`Projeto criado, mas houve um erro ao atribuir papéis: ${rolesError.message}`);
    } else {
      setName("");
      setProponentOrgId("");
      setDeveloperOrgId("");
      setMethodologyVersionId("");
      setRegistryStandard("none_yet");
      setShowForm(false);
    }
    loadData();
  }

  return (
    <section>
      <h1>Projetos de Carbono</h1>
      <p>Lista de projetos ativos, em validação e encerrados.</p>

      <button type="button" onClick={() => setShowForm((v) => !v)}>
        {showForm ? "Cancelar" : "+ Novo projeto"}
      </button>

      {showForm && (
        <form onSubmit={handleCreateProject}>
          <label htmlFor="project-name">Nome do projeto</label>
          <input id="project-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />

          <OrgPicker
            label="Organização proponente"
            orgs={orgs}
            value={proponentOrgId}
            onChange={setProponentOrgId}
            onOrgCreated={handleOrgCreated}
          />
          <OrgPicker
            label="Organização desenvolvedora (MRV)"
            orgs={orgs}
            value={developerOrgId}
            onChange={setDeveloperOrgId}
            onOrgCreated={handleOrgCreated}
          />

          <label htmlFor="project-methodology">Metodologia (opcional)</label>
          <select
            id="project-methodology"
            value={methodologyVersionId}
            onChange={(e) => setMethodologyVersionId(e.target.value)}
          >
            <option value="">Nenhuma ainda</option>
            {methodologyVersions.map((mv) => (
              <option key={mv.id} value={mv.id}>
                {mv.methodologies?.name} v{mv.version_label}
              </option>
            ))}
          </select>

          <label htmlFor="project-registry">Padrão de registro</label>
          <select
            id="project-registry"
            value={registryStandard}
            onChange={(e) => setRegistryStandard(e.target.value as RegistryStandard)}
          >
            {REGISTRY_STANDARDS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? "Criando..." : "Criar projeto"}
          </button>
        </form>
      )}

      {loading && <p>Carregando...</p>}
      {!loading && projects.length === 0 && (
        <div className="empty-state">
          <p>Nenhum projeto disponível para sua organização ainda. Use "+ Novo projeto" para criar o primeiro.</p>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Projeto</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  <span className="badge badge-neutral">{p.status}</span>
                </td>
                <td>
                  <Link to={`/projetos/${p.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

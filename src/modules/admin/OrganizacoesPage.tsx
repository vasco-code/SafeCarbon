import { useEffect, useState, type FormEvent } from "react";
import { Building2, Plus, Edit2, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface Organization {
  id: string;
  name: string;
  org_type: "platform_operator" | "project_developer" | "proponent" | "verifier" | "buyer";
  tax_id: string | null;
  logo_url: string | null;
  created_at: string;
  memberCount?: number;
  projectCount?: number;
}

const ORG_TYPES = {
  platform_operator: "Operador de Plataforma",
  project_developer: "Desenvolvedor de Projeto",
  proponent: "Proponente",
  verifier: "Verificador",
  buyer: "Comprador",
} as const;

export function OrganizacoesPage() {
  const { canManageUsers } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    org_type: "project_developer" as Organization["org_type"],
    tax_id: "",
    logo_url: "",
  });

  useEffect(() => {
    if (!canManageUsers) return;
    loadOrganizations();
  }, [canManageUsers]);

  async function loadOrganizations() {
    setLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .order("name");

    if (data) {
      const orgsWithStats = await Promise.all(
        data.map(async (org) => {
          // Validar se org.id é um UUID válido
          if (!org.id || org.id === "00000000-0000-0000-0000-000000000001") {
            return {
              ...org,
              memberCount: 0,
              projectCount: 0,
            };
          }

          const [members, projects] = await Promise.all([
            supabase.from("org_members").select("id", { count: "exact" }).eq("org_id", org.id),
            supabase.from("carbon_projects").select("id", { count: "exact" }).or(`developer_org_id.eq.${org.id},proponent_org_id.eq.${org.id}`),
          ]);
          return {
            ...org,
            memberCount: members.count ?? 0,
            projectCount: projects.count ?? 0,
          };
        })
      );
      setOrgs(orgsWithStats);
    }
    setLoading(false);
  }

  function resetForm() {
    setFormData({
      name: "",
      org_type: "project_developer",
      tax_id: "",
      logo_url: "",
    });
    setEditingId(null);
    setShowCreateForm(false);
  }

  function handleEditClick(org: Organization) {
    setFormData({
      name: org.name,
      org_type: org.org_type,
      tax_id: org.tax_id ?? "",
      logo_url: org.logo_url ?? "",
    });
    setEditingId(org.id);
    setShowCreateForm(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);

    if (!formData.name.trim()) {
      setError("Nome da organização é obrigatório.");
      setSaving(false);
      return;
    }

    const payload = {
      name: formData.name.trim(),
      org_type: formData.org_type,
      tax_id: formData.tax_id.trim() || null,
      logo_url: formData.logo_url.trim() || null,
    };

    if (editingId) {
      // Update
      const { error: err } = await supabase
        .from("organizations")
        .update(payload)
        .eq("id", editingId);

      setSaving(false);
      if (err) {
        console.error("Update error:", err);
        const errorMsg = err.message.includes("policy")
          ? "Você não tem permissão para editar organizações. Apenas admins de plataforma podem editar."
          : err.message;
        setError(`Erro ao atualizar: ${errorMsg}`);
      } else {
        setMessage("Organização atualizada com sucesso!");
        resetForm();
        await loadOrganizations();
      }
    } else {
      // Create
      const { error: err } = await supabase.from("organizations").insert([payload]);

      setSaving(false);
      if (err) {
        setError(`Erro ao criar: ${err.message}`);
      } else {
        setMessage("Organização criada com sucesso!");
        resetForm();
        await loadOrganizations();
      }
    }
  }

  async function handleDelete(orgId: string) {
    if (!confirm("Deletar esta organização? Esta ação não pode ser desfeita.")) return;

    setDeleting(true);
    setError(null);

    const { error: err } = await supabase.from("organizations").delete().eq("id", orgId);

    setDeleting(false);
    if (err) {
      setError(`Erro ao deletar: ${err.message}`);
    } else {
      setMessage("Organização deletada com sucesso!");
      await loadOrganizations();
    }
  }

  if (!canManageUsers) {
    return (
      <section>
        <h1 className="module-heading">
          <Building2 size={22} /> Organizações
        </h1>
        <p>Você não tem permissão para gerenciar organizações.</p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="module-heading">
        <Building2 size={22} /> Organizações
      </h1>
      <p>Gerenciar todas as organizações do sistema (criar, editar, deletar).</p>

      {/* Message/Error feedback */}
      {message && (
        <div style={{ padding: "0.75rem", borderRadius: "4px", backgroundColor: "var(--sc-success-bg)", color: "var(--sc-success)", marginBottom: "1rem" }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ padding: "0.75rem", borderRadius: "4px", backgroundColor: "var(--sc-danger-bg)", color: "var(--sc-danger)", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: "2rem", padding: "1rem", backgroundColor: "var(--sc-surface)", borderRadius: "8px" }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? "Editar Organização" : "Adicionar Nova Organização"}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label htmlFor="org-name">Nome *</label>
              <input
                id="org-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome da organização"
                required
              />
            </div>
            <div>
              <label htmlFor="org-type">Tipo *</label>
              <select
                id="org-type"
                value={formData.org_type}
                onChange={(e) => setFormData((prev) => ({ ...prev, org_type: e.target.value as any }))}
              >
                {Object.entries(ORG_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label htmlFor="org-tax-id">CNPJ/Tax ID</label>
              <input
                id="org-tax-id"
                type="text"
                value={formData.tax_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, tax_id: e.target.value }))}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <label htmlFor="org-logo">Logo (URL)</label>
              <input
                id="org-logo"
                type="text"
                value={formData.logo_url}
                onChange={(e) => setFormData((prev) => ({ ...prev, logo_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1.25rem" }}>
            <button type="submit" disabled={saving || !formData.name.trim()} className="btn-primary" style={{ marginTop: 0 }}>
              {saving ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
            </button>
            <button
              type="button"
              onClick={() => resetForm()}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Create Button */}
      {!showCreateForm && (
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowCreateForm(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}
        >
          <Plus size={16} />
          Nova Organização
        </button>
      )}

      {/* Organizations List */}
      {loading ? (
        <p>Carregando...</p>
      ) : orgs.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma organização cadastrada ainda.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>CNPJ/Tax ID</th>
              <th>Membros</th>
              <th>Projetos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {org.logo_url && (
                      <img
                        src={org.logo_url}
                        alt={org.name}
                        style={{ width: "32px", height: "32px", objectFit: "contain", borderRadius: "4px" }}
                      />
                    )}
                    <span>{org.name}</span>
                  </div>
                </td>
                <td>{ORG_TYPES[org.org_type]}</td>
                <td className="mono" style={{ fontSize: "0.8125rem" }}>
                  {org.tax_id ?? "—"}
                </td>
                <td>{org.memberCount ?? 0}</td>
                <td>{org.projectCount ?? 0}</td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => handleEditClick(org)}
                    disabled={saving || deleting}
                    style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-danger"
                    onClick={() => handleDelete(org.id)}
                    disabled={saving || deleting}
                    style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

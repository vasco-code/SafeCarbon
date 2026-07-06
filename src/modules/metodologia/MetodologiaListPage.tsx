import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface MethodologyVersionRow {
  id: string;
  version_label: string;
  status: string;
  published_at: string | null;
  methodologies: { name: string; sector: string } | null;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "badge-neutral",
  published: "badge-success",
  deprecated: "badge-warning",
};

export function MetodologiaListPage() {
  const { memberships } = useAuth();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<MethodologyVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [ipccCategory, setIpccCategory] = useState("");
  const [ownerOrgId, setOwnerOrgId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadVersions() {
    const { data } = await supabase
      .from("methodology_versions")
      .select("id, version_label, status, published_at, methodologies(name, sector)")
      .order("published_at", { ascending: false });
    setVersions((data ?? []) as unknown as MethodologyVersionRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadVersions();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!ownerOrgId) {
      setError("Selecione a organização proprietária da metodologia.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const { data: methodology, error: methodologyError } = await supabase
      .from("methodologies")
      .insert({
        name,
        sector,
        ipcc_category: ipccCategory || null,
        owner_org_id: ownerOrgId,
      })
      .select("id")
      .single();

    if (methodologyError || !methodology) {
      setError(methodologyError?.message ?? "Erro ao criar a metodologia.");
      setSubmitting(false);
      return;
    }

    const { data: version, error: versionError } = await supabase
      .from("methodology_versions")
      .insert({
        methodology_id: methodology.id,
        version_label: "1.0",
        status: "draft",
        sections: {},
      })
      .select("id")
      .single();

    setSubmitting(false);
    if (versionError || !version) {
      setError(versionError?.message ?? "Metodologia criada, mas houve um erro ao criar a primeira versão.");
      return;
    }

    navigate(`/metodologias/${version.id}`);
  }

  return (
    <section>
      <h1 className="module-heading">
        <BookOpen size={22} /> Metodologias
      </h1>
      <p>Biblioteca de metodologias disponíveis para consulta pública.</p>

      <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
        <Plus size={15} />
        {showForm ? "Cancelar" : "Nova metodologia"}
      </button>

      {showForm && (
        <form onSubmit={handleCreate}>
          <label htmlFor="methodology-name">Nome</label>
          <input id="methodology-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />

          <label htmlFor="methodology-sector">Setor</label>
          <input
            id="methodology-sector"
            type="text"
            placeholder="ex.: AFOLU, Energia, Resíduos"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            required
          />

          <label htmlFor="methodology-ipcc">Categoria IPCC (opcional)</label>
          <input id="methodology-ipcc" type="text" value={ipccCategory} onChange={(e) => setIpccCategory(e.target.value)} />

          <label htmlFor="methodology-owner">Organização proprietária</label>
          <select id="methodology-owner" value={ownerOrgId} onChange={(e) => setOwnerOrgId(e.target.value)} required>
            <option value="">Selecione...</option>
            {memberships.map((m) => (
              <option key={m.orgId} value={m.orgId}>
                {m.orgName}
              </option>
            ))}
          </select>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? "Criando..." : "Criar metodologia (rascunho)"}
          </button>
        </form>
      )}

      {loading && <p>Carregando...</p>}

      {!loading && versions.length === 0 && (
        <div className="empty-state">
          <p>Nenhuma metodologia publicada ainda. Use "Nova metodologia" para criar a primeira.</p>
        </div>
      )}

      {!loading && versions.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Metodologia</th>
              <th>Setor</th>
              <th>Versão</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td>{v.methodologies?.name}</td>
                <td>{v.methodologies?.sector}</td>
                <td>{v.version_label}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[v.status] ?? "badge-neutral"}`}>{v.status}</span>
                </td>
                <td>
                  <button type="button" className="btn-primary" onClick={() => navigate(`/metodologias/${v.id}`)}>
                    Abrir
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

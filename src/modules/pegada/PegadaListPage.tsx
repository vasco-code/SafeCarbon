import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Inventory {
  id: string;
  organization_id: string;
  inventory_year: number;
  name: string | null;
  status: "draft" | "final";
}

const STATUS_LABELS: Record<string, string> = { draft: "Rascunho", final: "Finalizado" };

export function PegadaListPage() {
  const navigate = useNavigate();
  const { memberships, user } = useAuth();
  const [orgId, setOrgId] = useState("");
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (memberships.length > 0 && !orgId) setOrgId(memberships[0].orgId);
  }, [memberships, orgId]);

  async function loadInventories(targetOrg: string) {
    if (!targetOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from("ghg_inventories")
      .select("id, organization_id, inventory_year, name, status")
      .eq("organization_id", targetOrg)
      .order("inventory_year", { ascending: false });
    setInventories((data as Inventory[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (orgId) loadInventories(orgId);
  }, [orgId]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!orgId) return;
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from("ghg_inventories").insert({
      organization_id: orgId,
      inventory_year: Number(year),
      name: name.trim() || null,
      created_by: user?.id,
    });
    setSubmitting(false);
    if (insertError) {
      setError(
        insertError.message.includes("duplicate")
          ? `Já existe um inventário de ${year} para esta organização.`
          : insertError.message,
      );
    } else {
      setShowForm(false);
      setName("");
      loadInventories(orgId);
    }
  }

  return (
    <section>
      <h1 className="module-heading">
        <Leaf size={22} /> Inventários de Emissões
      </h1>
      <p>Inventários de emissões de GEE por organização e ano (GHG Protocol).</p>

      <div className="action-bar">
        {memberships.length > 1 && (
          <div className="action-bar-field">
            <label htmlFor="peg-org">Organização</label>
            <select id="peg-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {memberships.map((m) => (
                <option key={m.orgId} value={m.orgId}>
                  {m.orgName}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          <Plus size={15} />
          {showForm ? "Cancelar" : "Novo inventário"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate}>
          <label htmlFor="peg-year">Ano inventariado</label>
          <input id="peg-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} required />
          <label htmlFor="peg-name">Nome (opcional)</label>
          <input id="peg-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Criando..." : "Criar inventário"}
          </button>
        </form>
      )}

      {loading && <p>Carregando...</p>}

      {!loading && inventories.length === 0 && (
        <div className="empty-state">
          <p>Nenhum inventário ainda. Crie o primeiro para começar a calcular a pegada.</p>
        </div>
      )}

      {!loading && inventories.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Ano</th>
              <th>Nome</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {inventories.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.inventory_year}</td>
                <td>{inv.name ?? "—"}</td>
                <td>
                  <span className={`badge ${inv.status === "final" ? "badge-success" : "badge-neutral"}`}>
                    {STATUS_LABELS[inv.status]}
                  </span>
                </td>
                <td>
                  <button type="button" className="btn-primary" onClick={() => navigate(`/pegada/${inv.id}`)}>
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

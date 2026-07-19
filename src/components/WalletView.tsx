import { useEffect, useState } from "react";
import { Wallet, ArrowLeftRight, Flame, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface WalletToken {
  id: string;
  tokenId: string;
  status: "active" | "transferred" | "retired";
  holderOrgId: string | null;
  retiredAt: string | null;
  retiredReason: string | null;
  issuedAmount: number;
  projectId: string | null;
  projectName: string;
  periodYear: number | null;
}

interface TransferRow {
  id: string;
  blockchain_token_id: string;
  from_org_id: string | null;
  to_org_id: string;
  note: string | null;
  transferred_at: string;
}

interface OrgOption {
  id: string;
  name: string;
}

interface PhotoDoc {
  id: string;
  title: string;
  storage_path: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  transferred: "Transferido",
  retired: "Aposentado",
};

function KpiCard({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="card report-kpi-card">
      <span className="report-kpi-icon">
        <Icon size={17} />
      </span>
      <div>
        <p className="report-kpi-label">{label}</p>
        <p className="metric">{value}</p>
      </div>
    </div>
  );
}

export function WalletView({ projectId }: { projectId?: string }) {
  const [tokens, setTokens] = useState<WalletToken[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [photos, setPhotos] = useState<PhotoDoc[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [transferringId, setTransferringId] = useState<string | null>(null);
  const [toOrgId, setToOrgId] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [retiringId, setRetiringId] = useState<string | null>(null);
  const [retireReason, setRetireReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadTokens() {
    setLoading(true);
    const { data } = await supabase
      .from("blockchain_tokens")
      .select(
        "id, token_id, status, holder_org_id, retired_at, retired_reason, created_at, credit_issuances(issued_amount_tco2e, credit_batches(credit_calculation_cycles(project_id, period_year, carbon_projects(name))))",
      )
      .order("created_at", { ascending: false });

    // deno-lint-ignore no-explicit-any
    const mapped = ((data ?? []) as any[]).map((t) => ({
      id: t.id,
      tokenId: t.token_id,
      status: t.status,
      holderOrgId: t.holder_org_id,
      retiredAt: t.retired_at,
      retiredReason: t.retired_reason,
      issuedAmount: Number(t.credit_issuances?.issued_amount_tco2e ?? 0),
      projectId: t.credit_issuances?.credit_batches?.credit_calculation_cycles?.project_id ?? null,
      projectName: t.credit_issuances?.credit_batches?.credit_calculation_cycles?.carbon_projects?.name ?? "",
      periodYear: t.credit_issuances?.credit_batches?.credit_calculation_cycles?.period_year ?? null,
    })) as WalletToken[];

    const scoped = projectId ? mapped.filter((t) => t.projectId === projectId) : mapped;
    setTokens(scoped);

    if (scoped.length > 0) {
      const { data: transferRows } = await supabase
        .from("token_transfers")
        .select("id, blockchain_token_id, from_org_id, to_org_id, note, transferred_at")
        .in(
          "blockchain_token_id",
          scoped.map((t) => t.id),
        )
        .order("transferred_at", { ascending: false });
      setTransfers(transferRows ?? []);
    } else {
      setTransfers([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadTokens();
  }, [projectId]);

  useEffect(() => {
    supabase
      .from("organizations")
      .select("id, name")
      .order("name")
      .then(({ data }) => setOrgs(data ?? []));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setPhotos([]);
      return;
    }
    supabase
      .from("project_documents")
      .select("id, title, storage_path")
      .eq("project_id", projectId)
      .eq("doc_type", "foto")
      .then(async ({ data }) => {
        setPhotos((data as PhotoDoc[]) ?? []);
        const urls: Record<string, string> = {};
        for (const photo of data ?? []) {
          const { data: signed } = await supabase.storage
            .from("project-documents")
            .createSignedUrl(photo.storage_path, 3600);
          if (signed) urls[photo.id] = signed.signedUrl;
        }
        setPhotoUrls(urls);
      });
  }, [projectId]);

  async function handleTransfer(token: WalletToken) {
    if (!toOrgId) {
      setError("Selecione a organização de destino.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const { data, error: fnError } = await supabase.functions.invoke("transfer-credit", {
      body: { blockchainTokenId: token.id, toOrgId, note: transferNote || undefined },
    });
    setBusy(false);
    if (fnError) {
      setError((data as { error?: string } | null)?.error ?? fnError.message ?? "Erro ao transferir.");
    } else {
      setMessage("Crédito transferido.");
      setTransferringId(null);
      setToOrgId("");
      setTransferNote("");
      loadTokens();
    }
  }

  async function handleRetire(token: WalletToken) {
    if (!retireReason.trim()) {
      setError("Informe o motivo da aposentadoria.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const { data, error: fnError } = await supabase.functions.invoke("retire-credit", {
      body: { blockchainTokenId: token.id, reason: retireReason },
    });
    setBusy(false);
    if (fnError) {
      setError((data as { error?: string } | null)?.error ?? fnError.message ?? "Erro ao aposentar.");
    } else {
      setMessage("Crédito aposentado.");
      setRetiringId(null);
      setRetireReason("");
      loadTokens();
    }
  }

  if (loading) return <p>Carregando...</p>;

  const registered = tokens.reduce((sum, t) => sum + t.issuedAmount, 0);
  const retired = tokens.filter((t) => t.status === "retired").reduce((sum, t) => sum + t.issuedAmount, 0);
  const available = tokens.filter((t) => t.status === "active").reduce((sum, t) => sum + t.issuedAmount, 0);

  const orgById = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div>
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", marginBottom: "1.5rem" }}>
          {photos.map((photo) => (
            <div key={photo.id} style={{ flex: "0 0 auto" }}>
              {photoUrls[photo.id] ? (
                <img
                  src={photoUrls[photo.id]}
                  alt={photo.title}
                  style={{ width: "160px", height: "120px", objectFit: "cover", borderRadius: "8px" }}
                />
              ) : (
                <div
                  style={{
                    width: "160px",
                    height: "120px",
                    borderRadius: "8px",
                    background: "var(--sc-surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ImageIcon size={24} color="var(--sc-muted)" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="report-kpi-grid" style={{ marginBottom: "1.5rem" }}>
        <KpiCard icon={Wallet} label="Créditos registrados" value={`${registered.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`} />
        <KpiCard icon={Flame} label="Créditos aposentados" value={`${retired.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`} />
        <KpiCard icon={ArrowLeftRight} label="Saldo disponível" value={`${available.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`} />
      </div>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      {tokens.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum crédito tokenizado ainda.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Token</th>
              {!projectId && <th>Projeto</th>}
              <th>Quantidade (tCO₂e)</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.id}>
                <td className="mono">{token.tokenId}</td>
                {!projectId && <td>{token.projectName}</td>}
                <td>{token.issuedAmount.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                <td>
                  <span
                    className={`badge ${
                      token.status === "active" ? "badge-success" : token.status === "retired" ? "badge-neutral" : "badge-info"
                    }`}
                  >
                    {STATUS_LABELS[token.status] ?? token.status}
                  </span>
                </td>
                <td className="row-actions">
                  {token.status === "active" && (
                    <>
                      <button type="button" onClick={() => setTransferringId(transferringId === token.id ? null : token.id)}>
                        Transferir
                      </button>
                      <button
                        type="button"
                        className="btn-icon-danger"
                        onClick={() => setRetiringId(retiringId === token.id ? null : token.id)}
                      >
                        Aposentar
                      </button>
                    </>
                  )}
                  {token.status === "retired" && token.retiredReason && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--sc-muted)" }}>
                      {token.retiredAt && new Date(token.retiredAt).toLocaleDateString("pt-BR")} — {token.retiredReason}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {transferringId && (
        <div className="nfe-preview" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Transferir crédito</h3>
          <label htmlFor="transfer-to-org">Organização de destino</label>
          <select id="transfer-to-org" value={toOrgId} onChange={(e) => setToOrgId(e.target.value)}>
            <option value="">Selecione...</option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <label htmlFor="transfer-note">Nota (opcional)</label>
          <input id="transfer-note" type="text" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleTransfer(tokens.find((t) => t.id === transferringId)!)}
              disabled={busy}
            >
              {busy ? "Transferindo..." : "Confirmar transferência"}
            </button>
            <button type="button" onClick={() => setTransferringId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {retiringId && (
        <div className="nfe-preview" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Aposentar crédito</h3>
          <label htmlFor="retire-reason-wallet">Motivo</label>
          <input id="retire-reason-wallet" type="text" value={retireReason} onChange={(e) => setRetireReason(e.target.value)} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleRetire(tokens.find((t) => t.id === retiringId)!)}
              disabled={busy}
            >
              {busy ? "Aposentando..." : "Confirmar aposentadoria"}
            </button>
            <button type="button" onClick={() => setRetiringId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {transfers.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3>Histórico de movimentações</h3>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>De</th>
                <th>Para</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.transferred_at).toLocaleString("pt-BR")}</td>
                  <td>{t.from_org_id ? orgById.get(t.from_org_id) ?? "—" : "—"}</td>
                  <td>{orgById.get(t.to_org_id) ?? "—"}</td>
                  <td>{t.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

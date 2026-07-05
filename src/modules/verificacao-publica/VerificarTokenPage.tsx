import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";

interface PublicTokenInfo {
  token_id: string;
  tx_hash: string;
  ledger_ref: string | null;
  status: "active" | "transferred" | "retired";
  issued_amount_tco2e: number;
  issued_at: string;
  retired_at: string | null;
  retired_reason: string | null;
  project_name: string;
  methodology_name: string | null;
  methodology_version: string | null;
  registry_standard: string;
  period_year: number;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo — ainda não aposentado",
  transferred: "Transferido",
  retired: "Aposentado — neutralidade reivindicada",
};

export function VerificarTokenPage() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const [info, setInfo] = useState<PublicTokenInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenId) return;
    supabase
      .rpc("get_public_token_verification", { p_token_id: tokenId })
      .then(({ data }) => {
        const row = (data ?? [])[0] ?? null;
        setInfo(row as PublicTokenInfo | null);
        setNotFound(!row);
        setLoading(false);
      });
  }, [tokenId]);

  useEffect(() => {
    if (!tokenId) return;
    QRCode.toDataURL(window.location.href, { width: 176, margin: 1 }).then(setQrDataUrl);
  }, [tokenId]);

  if (loading) {
    return (
      <div className="verify-page">
        <div className="verify-card">
          <p>Verificando...</p>
        </div>
      </div>
    );
  }

  if (notFound || !info) {
    return (
      <div className="verify-page">
        <div className="verify-card">
          <div className="verify-seal invalid">✕ Token não encontrado</div>
          <p>
            Não encontramos nenhum crédito de carbono tokenizado com o identificador informado.
            Confira se o QR code ou o link estão corretos.
          </p>
        </div>
      </div>
    );
  }

  const isRetired = info.status === "retired";

  return (
    <div className="verify-page">
      <div className="verify-card">
        <div className={`verify-seal ${isRetired ? "valid" : "valid"}`}>
          ✓ Crédito de carbono verificado
        </div>

        <h1 style={{ marginTop: 0 }}>{info.project_name}</h1>
        <p style={{ color: "var(--sc-muted)", marginTop: "-0.5rem" }}>
          {info.methodology_name}
          {info.methodology_version && ` v${info.methodology_version}`} · Ciclo {info.period_year}
        </p>

        <dl>
          <div className="verify-field">
            <dt>Status</dt>
            <dd>{STATUS_LABELS[info.status] ?? info.status}</dd>
          </div>
          <div className="verify-field">
            <dt>Quantidade emitida</dt>
            <dd>{info.issued_amount_tco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e</dd>
          </div>
          <div className="verify-field">
            <dt>Padrão de registro</dt>
            <dd>{info.registry_standard === "none_yet" ? "Não registrado em padrão externo" : info.registry_standard}</dd>
          </div>
          <div className="verify-field">
            <dt>Emitido em</dt>
            <dd>{new Date(info.issued_at).toLocaleDateString("pt-BR")}</dd>
          </div>
          {isRetired && (
            <>
              <div className="verify-field">
                <dt>Aposentado em</dt>
                <dd>{info.retired_at && new Date(info.retired_at).toLocaleDateString("pt-BR")}</dd>
              </div>
              <div className="verify-field">
                <dt>Motivo</dt>
                <dd>{info.retired_reason}</dd>
              </div>
            </>
          )}
          <div className="verify-field">
            <dt>Token</dt>
            <dd className="mono">{info.token_id}</dd>
          </div>
          <div className="verify-field">
            <dt>Hash da transação</dt>
            <dd className="mono" style={{ wordBreak: "break-all" }}>
              {info.tx_hash}
            </dd>
          </div>
        </dl>

        {qrDataUrl && (
          <div className="verify-qr">
            <img src={qrDataUrl} alt="QR code para esta página de verificação" width={176} height={176} />
          </div>
        )}

        <p style={{ fontSize: "var(--sc-text-xs)", color: "var(--sc-muted)", textAlign: "center", marginTop: "1.5rem" }}>
          Verificação pública SafeCarbon — dados provenientes do registro interno da plataforma.
        </p>
      </div>
    </div>
  );
}

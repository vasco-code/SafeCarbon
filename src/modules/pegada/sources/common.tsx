import { Fragment, useEffect, useState } from "react";
import type { FactorContext } from "../engine/factors";
import type { Entry, EvidenceFile } from "../entryActions";
import { deleteEntry, deleteEvidence, getEvidenceUrl, listEvidence, uploadEvidence } from "../entryActions";
import { FileDropzone } from "@/components/FileDropzone";

export interface SourceProps {
  inventoryId: string;
  ctx: FactorContext;
  entries: Entry[];
  reload: () => void;
  readOnly: boolean;
}

export function fmt(n: number, digits = 3): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

export const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Seletor de mês opcional para o lançamento, usado por quase todas as fontes
// (exceto o método "landfill" de Resíduos sólidos, cuja série já cobre vários
// anos por lançamento). `value` é o mês (1-12) ou "" para "ano inteiro".
export function PeriodField({
  value,
  onChange,
  idPrefix,
}: {
  value: string;
  onChange: (value: string) => void;
  idPrefix: string;
}) {
  return (
    <>
      <label htmlFor={`${idPrefix}-period`}>Período</label>
      <select id={`${idPrefix}-period`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Ano inteiro</option>
        {MONTH_LABELS.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
    </>
  );
}

// Evidências em arquivo (nota fiscal, fatura, foto do medidor etc.) de um
// lançamento — painel que expande abaixo da linha na EntryTable. Cada
// instância carrega sua própria lista ao montar, então só dispara query
// quando a linha é de fato expandida (não em toda entry da tabela).
function EvidencePanel({ entryId, readOnly }: { entryId: string; readOnly: boolean }) {
  const [files, setFiles] = useState<EvidenceFile[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setFiles(await listEvidence(entryId));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  async function handleUpload(uploadFiles: File[]) {
    setUploading(true);
    setError(null);
    for (const file of uploadFiles) {
      const { error: err } = await uploadEvidence(entryId, file);
      if (err) setError(err);
    }
    setUploading(false);
    load();
  }

  async function handleDelete(file: EvidenceFile) {
    if (!confirm(`Excluir "${file.file_name}"?`)) return;
    await deleteEvidence(file);
    load();
  }

  async function handleDownload(file: EvidenceFile) {
    const url = await getEvidenceUrl(file.storage_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  if (files === null) return <p style={{ margin: 0 }}>Carregando evidências...</p>;

  return (
    <div style={{ padding: "0.75rem 0" }}>
      {files.length === 0 && <p style={{ margin: "0 0 0.5rem", color: "var(--sc-muted)" }}>Nenhuma evidência anexada.</p>}
      {files.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.5rem" }}>
          {files.map((f) => (
            <li key={f.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => handleDownload(f)}
                style={{ background: "none", border: "none", color: "var(--sc-primary)", textDecoration: "underline", padding: 0, cursor: "pointer" }}
              >
                {f.file_name}
              </button>
              {!readOnly && (
                <button type="button" className="btn-icon-danger" onClick={() => handleDelete(f)}>
                  Excluir
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="auth-error">{error}</p>}
      {!readOnly && (
        <FileDropzone
          multiple
          onFiles={handleUpload}
          disabled={uploading}
          label={uploading ? "Enviando..." : "Arraste evidências aqui ou clique para escolher"}
        />
      )}
    </div>
  );
}

// Tabela padrão de lançamentos de uma fonte: descrição + colunas de gases +
// CO2e, com ação de excluir. `columns` descreve os campos de atividade a
// mostrar antes das colunas de emissão.
export function EntryTable({
  entries,
  columns,
  reload,
  readOnly,
}: {
  entries: Entry[];
  columns: { header: string; render: (e: Entry) => string }[];
  reload: () => void;
  readOnly: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    await deleteEntry(id);
    reload();
  }

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p>Nenhum lançamento ainda nesta fonte.</p>
      </div>
    );
  }

  const total = entries.reduce((s, e) => s + (e.computed?.co2e_t ?? 0), 0);

  return (
    <table>
      <thead>
        <tr>
          <th>Registro</th>
          <th>Descrição</th>
          {columns.map((c) => (
            <th key={c.header}>{c.header}</th>
          ))}
          <th>Período</th>
          <th>CO₂e (t)</th>
          <th>Evidências</th>
          {!readOnly && <th></th>}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <Fragment key={e.id}>
            <tr>
              <td>{e.source_ref ?? "—"}</td>
              <td>{e.description ?? "—"}</td>
              {columns.map((c) => (
                <td key={c.header}>{c.render(e)}</td>
              ))}
              <td>{e.period_month ? MONTH_LABELS[e.period_month - 1] : "Ano inteiro"}</td>
              <td>{fmt(e.computed?.co2e_t ?? 0, 4)}</td>
              <td>
                <button type="button" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                  {expandedId === e.id ? "Ocultar" : "Ver/anexar"}
                </button>
              </td>
              {!readOnly && (
                <td className="row-actions">
                  <button type="button" className="btn-icon-danger" onClick={() => handleDelete(e.id)}>
                    Excluir
                  </button>
                </td>
              )}
            </tr>
            {expandedId === e.id && (
              <tr>
                <td colSpan={5 + columns.length + (readOnly ? 0 : 1)}>
                  <EvidencePanel entryId={e.id} readOnly={readOnly} />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
        <tr>
          <td colSpan={3 + columns.length}>
            <strong>Total</strong>
          </td>
          <td>
            <strong>{fmt(total, 4)}</strong>
          </td>
          <td></td>
          {!readOnly && <td></td>}
        </tr>
      </tbody>
    </table>
  );
}

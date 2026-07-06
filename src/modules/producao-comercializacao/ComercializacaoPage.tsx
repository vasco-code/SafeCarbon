import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Receipt, FileWarning, FileCheck2 } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { supabase } from "@/lib/supabase";

interface CommercializationDocument {
  id: string;
  nfe_key: string;
  nfe_number: string | null;
  issue_date: string;
  buyer_tax_id: string | null;
  quantity_kg: number;
  already_credited: boolean;
  linked_production_period_year: number | null;
}

interface ParsedNfe {
  nfeKey: string;
  nfeNumber: string;
  issueDate: string;
  buyerTaxId: string;
  quantityKg: number;
}

interface BatchItem {
  fileName: string;
  parsed: ParsedNfe | null;
  error: string | null;
}

// Faz o parsing mínimo de uma NF-e (modelo 55) para extrair só o que
// commercialization_documents precisa. Assume que toda a NF-e é do aditivo
// Fator P (soma qCom de todos os itens) — não diferencia por produto.
function parseNfeXml(xmlText: string): ParsedNfe {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Arquivo XML inválido.");
  }

  const infNFe = doc.querySelector("infNFe");
  const nfeKey = (infNFe?.getAttribute("Id") ?? "").replace(/^NFe/, "").trim();
  if (nfeKey.length !== 44) {
    throw new Error("Não foi possível localizar a chave de 44 dígitos da NF-e.");
  }

  const nfeNumber = doc.querySelector("ide > nNF")?.textContent ?? "";
  const emissionText =
    doc.querySelector("ide > dhEmi")?.textContent ?? doc.querySelector("ide > dEmi")?.textContent ?? "";
  const issueDate = emissionText.slice(0, 10);
  if (!issueDate) {
    throw new Error("Não foi possível localizar a data de emissão da NF-e.");
  }

  const buyerTaxId =
    doc.querySelector("dest > CNPJ")?.textContent ?? doc.querySelector("dest > CPF")?.textContent ?? "";

  const quantityKg = Array.from(doc.querySelectorAll("det > prod > qCom")).reduce(
    (sum, el) => sum + parseFloat(el.textContent ?? "0"),
    0,
  );
  if (!quantityKg) {
    throw new Error("Não foi possível localizar a quantidade comercializada (qCom) na NF-e.");
  }

  return { nfeKey, nfeNumber, issueDate, buyerTaxId, quantityKg };
}

export function ComercializacaoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [documents, setDocuments] = useState<CommercializationDocument[]>([]);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadDocuments() {
    if (!projectId) return;
    const { data } = await supabase
      .from("commercialization_documents")
      .select("id, nfe_key, nfe_number, issue_date, buyer_tax_id, quantity_kg, already_credited, linked_production_period_year")
      .eq("project_id", projectId)
      .order("issue_date", { ascending: false });
    setDocuments(data ?? []);
  }

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  async function handleFiles(files: File[]) {
    setError(null);
    const items: BatchItem[] = await Promise.all(
      files.map(async (file) => {
        try {
          const text = await file.text();
          return { fileName: file.name, parsed: parseNfeXml(text), error: null };
        } catch (err) {
          return {
            fileName: file.name,
            parsed: null,
            error: err instanceof Error ? err.message : "Erro ao ler o arquivo.",
          };
        }
      }),
    );
    setBatch((prev) => [...prev, ...items]);
  }

  const validCount = batch.filter((item) => item.parsed).length;

  async function handleConfirmBatch() {
    if (!projectId) return;
    const valid = batch.filter((item): item is BatchItem & { parsed: ParsedNfe } => item.parsed !== null);
    if (valid.length === 0) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.from("commercialization_documents").insert(
      valid.map((item) => ({
        project_id: projectId,
        nfe_key: item.parsed.nfeKey,
        nfe_number: item.parsed.nfeNumber || null,
        issue_date: item.parsed.issueDate,
        buyer_tax_id: item.parsed.buyerTaxId || null,
        quantity_kg: item.parsed.quantityKg,
      })),
    );
    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      setBatch([]);
      loadDocuments();
    }
  }

  function handleRemoveBatchItem(fileName: string) {
    setBatch((prev) => prev.filter((item) => item.fileName !== fileName));
  }

  async function handleToggleCredited(doc: CommercializationDocument) {
    const { error } = await supabase
      .from("commercialization_documents")
      .update({ already_credited: !doc.already_credited })
      .eq("id", doc.id);
    if (error) {
      setError(error.message);
    } else {
      loadDocuments();
    }
  }

  async function handleSetLinkedYear(doc: CommercializationDocument, value: string) {
    const { error } = await supabase
      .from("commercialization_documents")
      .update({ linked_production_period_year: value ? Number(value) : null })
      .eq("id", doc.id);
    if (error) {
      setError(error.message);
    } else {
      loadDocuments();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta NF-e importada? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("commercialization_documents").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      loadDocuments();
    }
  }

  const totalCommercialized = documents.reduce((sum, d) => sum + d.quantity_kg, 0);

  return (
    <section>
      <h2 className="module-heading">
        <Receipt size={20} /> Comercialização
      </h2>
      <p>Notas fiscais importadas e fator de comercialização calculado.</p>

      <FileDropzone
        accept=".xml"
        multiple
        onFiles={handleFiles}
        label="Arraste os XML das NF-e aqui ou clique para escolher"
        hint="Aceita várias notas de uma vez — cada arquivo é lido e validado antes de importar."
      />

      {error && <p className="auth-error">{error}</p>}

      {batch.length > 0 && (
        <div className="nfe-preview" style={{ maxWidth: "none" }}>
          <p>
            {validCount} de {batch.length} arquivo(s) prontos para importar.
          </p>
          <ul className="file-batch-list" style={{ listStyle: "none", paddingLeft: 0 }}>
            {batch.map((item) => (
              <li key={item.fileName} className="file-batch-item">
                {item.parsed ? (
                  <FileCheck2 size={16} color="var(--sc-success)" />
                ) : (
                  <FileWarning size={16} color="var(--sc-danger)" />
                )}
                <span className="file-batch-name" title={item.fileName}>
                  {item.parsed
                    ? `${item.fileName} — ${item.parsed.quantityKg.toLocaleString("pt-BR")} kg, emissão ${item.parsed.issueDate}`
                    : `${item.fileName} — ${item.error}`}
                </span>
                <button type="button" className="btn-icon-danger" onClick={() => handleRemoveBatchItem(item.fileName)}>
                  Remover
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={handleConfirmBatch} disabled={submitting || validCount === 0}>
            {submitting ? "Importando..." : `Importar ${validCount} nota(s)`}
          </button>
        </div>
      )}

      <h2>
        Notas importadas ({documents.length}) — total {totalCommercialized.toLocaleString("pt-BR")} kg
      </h2>
      <p style={{ marginBottom: "0.5rem" }}>
        "Já creditado" e "Ano vinculado" alimentam a reconciliação Fe do motor de cálculo — marque uma
        NF-e como já creditada quando o volume dela já entrou num ciclo anterior, para não contar duas
        vezes.
      </p>
      {documents.length === 0 && (
        <div className="empty-state">
          <p>Nenhuma NF-e importada ainda. Use o campo acima para importar o primeiro XML.</p>
        </div>
      )}
      {documents.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Chave</th>
              <th>Número</th>
              <th>Emissão</th>
              <th>Comprador</th>
              <th>Quantidade (kg)</th>
              <th>Já creditado</th>
              <th>Ano vinculado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td className="mono" title={d.nfe_key}>
                  {d.nfe_key.slice(0, 8)}…{d.nfe_key.slice(-4)}
                </td>
                <td>{d.nfe_number}</td>
                <td>{d.issue_date}</td>
                <td>{d.buyer_tax_id}</td>
                <td>{d.quantity_kg.toLocaleString("pt-BR")}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={d.already_credited}
                    onChange={() => handleToggleCredited(d)}
                    aria-label="Já creditado"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: "5.5rem" }}
                    defaultValue={d.linked_production_period_year ?? ""}
                    onBlur={(e) => handleSetLinkedYear(d, e.target.value)}
                    aria-label="Ano de produção vinculado"
                  />
                </td>
                <td className="row-actions">
                  <button type="button" className="btn-icon-danger" onClick={() => handleDelete(d.id)}>
                    Excluir
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

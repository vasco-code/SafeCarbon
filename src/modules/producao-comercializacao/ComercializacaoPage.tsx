import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface CommercializationDocument {
  id: string;
  nfe_key: string;
  nfe_number: string | null;
  issue_date: string;
  buyer_tax_id: string | null;
  quantity_kg: number;
}

interface ParsedNfe {
  nfeKey: string;
  nfeNumber: string;
  issueDate: string;
  buyerTaxId: string;
  quantityKg: number;
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
  const [parsed, setParsed] = useState<ParsedNfe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadDocuments() {
    if (!projectId) return;
    const { data } = await supabase
      .from("commercialization_documents")
      .select("id, nfe_key, nfe_number, issue_date, buyer_tax_id, quantity_kg")
      .eq("project_id", projectId)
      .order("issue_date", { ascending: false });
    setDocuments(data ?? []);
  }

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsed(null);
    try {
      const text = await file.text();
      setParsed(parseNfeXml(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler o arquivo.");
    }
  }

  async function handleConfirm() {
    if (!projectId || !parsed) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.from("commercialization_documents").insert({
      project_id: projectId,
      nfe_key: parsed.nfeKey,
      nfe_number: parsed.nfeNumber || null,
      issue_date: parsed.issueDate,
      buyer_tax_id: parsed.buyerTaxId || null,
      quantity_kg: parsed.quantityKg,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      setParsed(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadDocuments();
    }
  }

  const totalCommercialized = documents.reduce((sum, d) => sum + d.quantity_kg, 0);

  return (
    <section>
      <h1>Comercialização</h1>
      <p>Notas fiscais importadas e fator de comercialização calculado.</p>

      <label htmlFor="nfe-file">Importar NF-e (XML)</label>
      <input id="nfe-file" ref={fileInputRef} type="file" accept=".xml" onChange={handleFileChange} />

      {error && <p className="auth-error">{error}</p>}

      {parsed && (
        <div className="nfe-preview">
          <p>Chave: {parsed.nfeKey}</p>
          <p>Número: {parsed.nfeNumber}</p>
          <p>Data de emissão: {parsed.issueDate}</p>
          <p>Comprador: {parsed.buyerTaxId}</p>
          <p>Quantidade: {parsed.quantityKg.toLocaleString("pt-BR")} kg</p>
          <button type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Importando..." : "Confirmar importação"}
          </button>
        </div>
      )}

      <h2>
        Notas importadas ({documents.length}) — total {totalCommercialized.toLocaleString("pt-BR")} kg
      </h2>
      <table>
        <thead>
          <tr>
            <th>Chave</th>
            <th>Número</th>
            <th>Emissão</th>
            <th>Comprador</th>
            <th>Quantidade (kg)</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id}>
              <td>{d.nfe_key}</td>
              <td>{d.nfe_number}</td>
              <td>{d.issue_date}</td>
              <td>{d.buyer_tax_id}</td>
              <td>{d.quantity_kg.toLocaleString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

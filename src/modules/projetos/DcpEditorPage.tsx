import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface SectionDef {
  key: string;
  label: string;
  generated: boolean;
}

const SECTION_DEFS: SectionDef[] = [
  { key: "introducao", label: "1. Introdução", generated: false },
  { key: "mecanismo_biologico", label: "2. Mecanismo de ação", generated: false },
  { key: "estrutura_metodologica", label: "3. Estrutura metodológica do projeto", generated: false },
  { key: "linha_de_base", label: "4. Linha de base", generated: false },
  { key: "cenario_projeto", label: "5. Cenário do projeto", generated: false },
  { key: "adicionalidade", label: "6. Adicionalidade", generated: false },
  { key: "calculo_creditos", label: "7. Cálculo e emissão de créditos", generated: true },
  { key: "vazamentos", label: "8. Vazamentos (leakage)", generated: true },
  { key: "beneficios", label: "9. Benefícios ambientais e socioeconômicos", generated: false },
  { key: "governanca", label: "10. Gestão do projeto e governança", generated: false },
  { key: "permanencia", label: "11. Permanência, riscos e salvaguardas", generated: false },
  { key: "referencias", label: "12. Referências bibliográficas", generated: false },
  { key: "anexo_inventario", label: "Anexo I — Inventário de emissões", generated: true },
  { key: "anexo_comercializacao", label: "Anexo II — Relatório de comercialização", generated: true },
];

interface SectionState {
  texto: string;
  isGenerated: boolean;
}

export function DcpEditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [dcpDocumentId, setDcpDocumentId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [sections, setSections] = useState<Record<string, SectionState>>({});
  const [year, setYear] = useState("2025");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    const { data: projectRow } = await supabase
      .from("carbon_projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();
    setProjectName(projectRow?.name ?? "");

    let { data: doc } = await supabase
      .from("dcp_documents")
      .select("id")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!doc) {
      const { data: created, error: createError } = await supabase
        .from("dcp_documents")
        .insert({ project_id: projectId, version_number: 1, status: "draft" })
        .select("id")
        .single();
      if (createError) {
        // 23505 = unique violation: outra chamada concorrente (ex.: StrictMode
        // rodando o efeito duas vezes) já criou a linha — não é falta de permissão.
        if (createError.code === "23505") {
          const { data: existing } = await supabase
            .from("dcp_documents")
            .select("id")
            .eq("project_id", projectId)
            .order("version_number", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existing) {
            doc = existing;
          } else {
            setError("Erro ao carregar o DCP deste projeto.");
            setLoading(false);
            return;
          }
        } else {
          setError("Nenhum DCP existe ainda para este projeto, e você não tem permissão para criar um.");
          setLoading(false);
          return;
        }
      } else {
        doc = created;
      }
    }

    setDcpDocumentId(doc.id);

    const { data: sectionRows } = await supabase
      .from("dcp_sections")
      .select("section_key, content, is_generated")
      .eq("dcp_document_id", doc.id);

    const map: Record<string, SectionState> = {};
    for (const row of sectionRows ?? []) {
      map[row.section_key] = { texto: row.content?.texto ?? "", isGenerated: row.is_generated };
    }
    setSections(map);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function saveNarrativeSection(key: string) {
    if (!dcpDocumentId) return;
    setSavingKey(key);
    setError(null);
    const { error } = await supabase.from("dcp_sections").upsert(
      {
        dcp_document_id: dcpDocumentId,
        section_key: key,
        content: { texto: sections[key]?.texto ?? "" },
        is_generated: false,
      },
      { onConflict: "dcp_document_id,section_key" },
    );
    setSavingKey(null);
    if (error) {
      setError(error.message);
    } else {
      setMessage("Seção salva.");
    }
  }

  async function generateSections() {
    if (!dcpDocumentId || !projectId) return;
    setGenerating(true);
    setError(null);
    setMessage(null);

    const periodYear = Number(year);

    const { data: cycle } = await supabase
      .from("credit_calculation_cycles")
      .select("id")
      .eq("project_id", projectId)
      .eq("period_year", periodYear)
      .maybeSingle();

    if (!cycle) {
      setError(`Nenhum ciclo calculado para ${year}. Calcule o ciclo em "Ciclo de créditos" primeiro.`);
      setGenerating(false);
      return;
    }

    const [stepsResult, batchResult, inventoryResult, leakageResult, nfeResult] = await Promise.all([
      supabase
        .from("credit_calculation_steps")
        .select("step_number, step_key, output_value, unit")
        .eq("cycle_id", cycle.id)
        .order("step_number"),
      supabase
        .from("credit_batches")
        .select("tco2e_amount, commercialization_factor, eligibility_factor")
        .eq("cycle_id", cycle.id)
        .maybeSingle(),
      supabase
        .from("emission_inventory_entries")
        .select("source_type, activity_quantity, activity_unit, calculated_tco2e")
        .eq("project_id", projectId)
        .eq("period_year", periodYear),
      supabase
        .from("leakage_assessments")
        .select("category, conclusion, justification, leakage_factor_pct")
        .eq("project_id", projectId)
        .eq("period_year", periodYear),
      supabase
        .from("commercialization_documents")
        .select("nfe_number, issue_date, buyer_tax_id, quantity_kg")
        .eq("project_id", projectId)
        .gte("issue_date", `${periodYear}-01-01`)
        .lte("issue_date", `${periodYear}-12-31`)
        .order("issue_date"),
    ]);

    const steps = stepsResult.data ?? [];
    const batch = batchResult.data;
    const inventory = inventoryResult.data ?? [];
    const leakage = leakageResult.data ?? [];
    const nfeDocs = nfeResult.data ?? [];

    const calculoTexto = [
      `Ciclo ${year} — cálculo gerado automaticamente a partir do motor de cálculo (nunca digitado à mão).`,
      "",
      ...steps.map(
        (s) =>
          `${s.step_number}. ${s.step_key}: ${s.output_value.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${s.unit ?? ""}`,
      ),
      "",
      batch
        ? `Redução final elegível: ${batch.tco2e_amount.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO2e (Fc = ${batch.commercialization_factor?.toFixed(4)}, Fe = ${batch.eligibility_factor.toFixed(4)}).`
        : "",
    ].join("\n");

    const vazamentosTexto = leakage.length
      ? leakage
          .map((l) => `${l.category}: ${l.conclusion} — ${l.justification} (LF = ${l.leakage_factor_pct}%)`)
          .join("\n")
      : "Nenhuma avaliação de vazamento registrada para este período.";

    const totalInventario = inventory.reduce((sum, e) => sum + Number(e.calculated_tco2e), 0);
    const anexoInventarioTexto = [
      ...inventory.map(
        (e) =>
          `${e.source_type}: ${Number(e.activity_quantity).toLocaleString("pt-BR")} ${e.activity_unit} -> ${Number(e.calculated_tco2e).toLocaleString("pt-BR", { maximumFractionDigits: 4 })} tCO2e`,
      ),
      `Total: ${totalInventario.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} tCO2e`,
    ].join("\n");

    const totalNfe = nfeDocs.reduce((sum, d) => sum + Number(d.quantity_kg), 0);
    const anexoComercializacaoTexto = [
      ...nfeDocs.map(
        (d) =>
          `NF-e ${d.nfe_number ?? "—"} (${d.issue_date}): ${Number(d.quantity_kg).toLocaleString("pt-BR")} kg — comprador ${d.buyer_tax_id ?? "—"}`,
      ),
      `Total comercializado: ${totalNfe.toLocaleString("pt-BR")} kg`,
    ].join("\n");

    const generated = [
      { key: "calculo_creditos", texto: calculoTexto },
      { key: "vazamentos", texto: vazamentosTexto },
      { key: "anexo_inventario", texto: anexoInventarioTexto },
      { key: "anexo_comercializacao", texto: anexoComercializacaoTexto },
    ];

    const { error } = await supabase.from("dcp_sections").upsert(
      generated.map((g) => ({
        dcp_document_id: dcpDocumentId,
        section_key: g.key,
        content: { texto: g.texto },
        is_generated: true,
        source_reference: { cycle_id: cycle.id },
      })),
      { onConflict: "dcp_document_id,section_key" },
    );

    setGenerating(false);
    if (error) {
      setError(error.message);
    } else {
      setMessage("Seções geradas a partir do ciclo — sem divergência com o motor de cálculo.");
      loadData();
    }
  }

  function handleExport() {
    const html = [
      `<html><head><meta charset="utf-8"></head><body>`,
      `<h1>Documento de Concepção de Projeto — ${projectName}</h1>`,
      ...SECTION_DEFS.map((def) => {
        const section = sections[def.key];
        const texto = (section?.texto ?? "(seção vazia)").replace(/\n/g, "<br/>");
        return `<h2>${def.label}${section?.isGenerated ? " (gerada automaticamente)" : ""}</h2><p>${texto}</p>`;
      }),
      `</body></html>`,
    ].join("\n");

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DCP-${projectName.replace(/\s+/g, "-")}-${year}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <section>
      <h1>DCP — {projectName}</h1>
      <p>Seções narrativas editáveis + seções geradas automaticamente do motor de cálculo.</p>

      <label htmlFor="dcp-year">Ano do ciclo para gerar seções automáticas</label>
      <input id="dcp-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
      <button type="button" onClick={generateSections} disabled={generating || !dcpDocumentId}>
        {generating ? "Gerando..." : "Gerar seções automáticas"}
      </button>
      <button type="button" onClick={handleExport} disabled={!dcpDocumentId}>
        Exportar DCP (.doc)
      </button>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      {SECTION_DEFS.map((def) => {
        const section = sections[def.key];
        return (
          <div key={def.key} className="dcp-section">
            <h2>
              {def.label}
              {def.generated && <span className="dcp-generated-badge">gerada automaticamente</span>}
            </h2>
            {def.generated ? (
              <pre className="dcp-generated-content">{section?.texto || "Ainda não gerada."}</pre>
            ) : (
              <>
                <textarea
                  value={section?.texto ?? ""}
                  onChange={(e) =>
                    setSections((prev) => ({ ...prev, [def.key]: { texto: e.target.value, isGenerated: false } }))
                  }
                  rows={4}
                />
                <button
                  type="button"
                  onClick={() => saveNarrativeSection(def.key)}
                  disabled={savingKey === def.key}
                >
                  {savingKey === def.key ? "Salvando..." : "Salvar seção"}
                </button>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type LeakageCategory =
  | "rebound_effect"
  | "technology_substitution"
  | "supply_chain"
  | "geographic_displacement"
  | "other";

interface LeakageAssessment {
  id: string;
  period_year: number;
  category: LeakageCategory;
  conclusion: string;
  justification: string;
  leakage_factor_pct: number;
}

const CATEGORY_LABELS: Record<LeakageCategory, string> = {
  rebound_effect: "Efeito rebote",
  technology_substitution: "Substituição tecnológica",
  supply_chain: "Cadeia de suprimentos",
  geographic_displacement: "Deslocamento geográfico",
  other: "Outra",
};

const DCP_CATEGORIES: LeakageCategory[] = [
  "rebound_effect",
  "technology_substitution",
  "supply_chain",
  "geographic_displacement",
];

export function VazamentosPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [assessments, setAssessments] = useState<LeakageAssessment[]>([]);
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
  const [category, setCategory] = useState<LeakageCategory>("rebound_effect");
  const [conclusion, setConclusion] = useState("");
  const [justification, setJustification] = useState("");
  const [leakageFactorPct, setLeakageFactorPct] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    if (!projectId) return;
    const { data } = await supabase
      .from("leakage_assessments")
      .select("id, period_year, category, conclusion, justification, leakage_factor_pct")
      .eq("project_id", projectId)
      .order("period_year", { ascending: false });
    setAssessments(data ?? []);
  }

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    setError(null);

    if (!conclusion.trim() || !justification.trim()) {
      setError("Conclusão e justificativa são obrigatórias — mesmo quando o fator de vazamento é 0.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("leakage_assessments").insert({
      project_id: projectId,
      period_year: Number(periodYear),
      category,
      conclusion,
      justification,
      leakage_factor_pct: Number(leakageFactorPct) || 0,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      setConclusion("");
      setJustification("");
      setLeakageFactorPct("0");
      loadData();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta avaliação de vazamento? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("leakage_assessments").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      loadData();
    }
  }

  const yearsWithLeakage = new Set(
    assessments.filter((a) => a.leakage_factor_pct > 0).map((a) => a.period_year),
  );

  return (
    <section>
      <h1>Avaliação de Vazamentos</h1>
      <p>Avaliação por categoria e fator de vazamento (LF) do ciclo.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="leak-year">Ano</label>
        <input id="leak-year" type="number" value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} required />

        <label htmlFor="leak-category">Categoria</label>
        <select id="leak-category" value={category} onChange={(e) => setCategory(e.target.value as LeakageCategory)}>
          {(Object.keys(CATEGORY_LABELS) as LeakageCategory[]).map((key) => (
            <option key={key} value={key}>
              {CATEGORY_LABELS[key]}
              {DCP_CATEGORIES.includes(key) ? "" : " (extensão além do framework do DCP)"}
            </option>
          ))}
        </select>

        <label htmlFor="leak-conclusion">Conclusão</label>
        <input id="leak-conclusion" type="text" value={conclusion} onChange={(e) => setConclusion(e.target.value)} required />

        <label htmlFor="leak-justification">Justificativa técnica</label>
        <input
          id="leak-justification"
          type="text"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          required
        />

        <label htmlFor="leak-factor">Fator de vazamento — LF (%)</label>
        <input
          id="leak-factor"
          type="number"
          step="0.01"
          min="0"
          value={leakageFactorPct}
          onChange={(e) => setLeakageFactorPct(e.target.value)}
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Registrar avaliação"}
        </button>
      </form>

      <h2>Avaliações registradas</h2>
      {assessments.length === 0 && (
        <div className="empty-state">
          <p>Nenhuma avaliação de vazamento registrada ainda. O motor de cálculo exige ao menos uma por ano.</p>
        </div>
      )}
      {assessments.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Ano</th>
              <th>Categoria</th>
              <th>Conclusão</th>
              <th>Justificativa</th>
              <th>LF (%)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.period_year}
                  {yearsWithLeakage.has(a.period_year) && a.leakage_factor_pct > 0 && (
                    <span className="badge badge-warning" style={{ marginLeft: "0.4rem" }}>
                      ⚠ LF&gt;0
                    </span>
                  )}
                </td>
                <td>{CATEGORY_LABELS[a.category]}</td>
                <td>{a.conclusion}</td>
                <td>{a.justification}</td>
                <td>{a.leakage_factor_pct}</td>
                <td className="row-actions">
                  <button type="button" className="btn-icon-danger" onClick={() => handleDelete(a.id)}>
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

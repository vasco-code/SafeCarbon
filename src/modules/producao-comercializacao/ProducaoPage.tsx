import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ProductionRecord {
  id: string;
  period_year: number;
  period_month: number | null;
  quantity_kg: number;
  source: string;
}

interface PeriodSummary {
  period_year: number;
  total_produced_kg: number;
  total_commercialized_kg: number;
  commercialization_factor: number | null;
}

export function ProducaoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [summary, setSummary] = useState<PeriodSummary[]>([]);
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
  const [periodMonth, setPeriodMonth] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    if (!projectId) return;
    const [recordsResult, summaryResult] = await Promise.all([
      supabase
        .from("production_records")
        .select("id, period_year, period_month, quantity_kg, source")
        .eq("project_id", projectId)
        .order("period_year", { ascending: false }),
      supabase
        .from("production_period_summary")
        .select("period_year, total_produced_kg, total_commercialized_kg, commercialization_factor")
        .eq("project_id", projectId)
        .order("period_year", { ascending: false }),
    ]);
    setRecords(recordsResult.data ?? []);
    setSummary(summaryResult.data ?? []);
  }

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.from("production_records").insert({
      project_id: projectId,
      period_year: Number(periodYear),
      period_month: periodMonth ? Number(periodMonth) : null,
      quantity_kg: Number(quantityKg),
      source: "manual_entry",
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      setQuantityKg("");
      setPeriodMonth("");
      loadData();
    }
  }

  return (
    <section>
      <h1>Produção</h1>
      <p>Lançamento e consolidação da produção por período.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="period-year">Ano</label>
        <input
          id="period-year"
          type="number"
          value={periodYear}
          onChange={(e) => setPeriodYear(e.target.value)}
          required
        />

        <label htmlFor="period-month">Mês (opcional)</label>
        <input
          id="period-month"
          type="number"
          min={1}
          max={12}
          value={periodMonth}
          onChange={(e) => setPeriodMonth(e.target.value)}
        />

        <label htmlFor="quantity-kg">Quantidade produzida (kg)</label>
        <input
          id="quantity-kg"
          type="number"
          step="0.01"
          min="0"
          value={quantityKg}
          onChange={(e) => setQuantityKg(e.target.value)}
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Lançar produção"}
        </button>
      </form>

      <h2>Resumo por ano (Pfp, Tc, Fc)</h2>
      <table>
        <thead>
          <tr>
            <th>Ano</th>
            <th>Produzido (kg)</th>
            <th>Comercializado (kg)</th>
            <th>Fc</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((s) => (
            <tr key={s.period_year}>
              <td>{s.period_year}</td>
              <td>{s.total_produced_kg.toLocaleString("pt-BR")}</td>
              <td>{s.total_commercialized_kg.toLocaleString("pt-BR")}</td>
              <td>{s.commercialization_factor != null ? s.commercialization_factor.toFixed(4) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Lançamentos</h2>
      <table>
        <thead>
          <tr>
            <th>Ano</th>
            <th>Mês</th>
            <th>Quantidade (kg)</th>
            <th>Origem</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>{r.period_year}</td>
              <td>{r.period_month ?? "—"}</td>
              <td>{r.quantity_kg.toLocaleString("pt-BR")}</td>
              <td>{r.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

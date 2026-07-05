import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface StepRow {
  id: string;
  step_number: number;
  step_key: string;
  output_value: number;
  unit: string | null;
  input_values: Record<string, unknown>;
}

interface CycleRow {
  id: string;
  status: string;
  calculated_at: string | null;
}

interface BatchRow {
  tco2e_amount: number;
  commercialization_factor: number | null;
  eligibility_factor: number;
  status: string;
}

const STEP_LABELS: Record<string, string> = {
  producao_anual: "1. Produção anual (Pfp)",
  comercializacao: "2. Comercialização (Fc)",
  estimativa_cobertura_animal: "3. Estimativa de cobertura animal",
  emissoes_linha_base: "4. Emissões na linha de base",
  emissoes_cenario_projeto: "5. Emissões no cenário do projeto",
  reducao_bruta_metano: "6. Redução bruta de metano",
  conversao_co2e: "7. Conversão para CO₂e",
  subtracao_emissoes_operacionais: "8. Subtração das emissões operacionais",
  ajuste_vazamento: "8b. Ajuste de vazamento (LF)",
  fatores_integridade: "9. Fatores de integridade (final)",
};

export function CicloCalculoPage() {
  const { projectId, year } = useParams<{ projectId: string; year: string }>();
  const [cycle, setCycle] = useState<CycleRow | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [batch, setBatch] = useState<BatchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    if (!projectId || !year) return;
    setLoading(true);
    const { data: cycleRow } = await supabase
      .from("credit_calculation_cycles")
      .select("id, status, calculated_at")
      .eq("project_id", projectId)
      .eq("period_year", Number(year))
      .maybeSingle();

    setCycle(cycleRow ?? null);

    if (cycleRow) {
      const [stepsResult, batchResult] = await Promise.all([
        supabase
          .from("credit_calculation_steps")
          .select("id, step_number, step_key, output_value, unit, input_values")
          .eq("cycle_id", cycleRow.id)
          .order("step_number"),
        supabase
          .from("credit_batches")
          .select("tco2e_amount, commercialization_factor, eligibility_factor, status")
          .eq("cycle_id", cycleRow.id)
          .maybeSingle(),
      ]);
      setSteps(stepsResult.data ?? []);
      setBatch(batchResult.data ?? null);
    } else {
      setSteps([]);
      setBatch(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [projectId, year]);

  async function handleCalculate() {
    if (!projectId || !year) return;
    setCalculating(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("calculate-credit-cycle", {
      body: { projectId, periodYear: Number(year) },
    });
    setCalculating(false);
    if (error) {
      setError((data as { error?: string } | null)?.error ?? error.message ?? "Erro ao calcular o ciclo.");
    } else {
      await loadData();
    }
  }

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <section>
      <h1>Ciclo de Créditos {year}</h1>
      <p>Etapas do cálculo, resultado final e status de verificação.</p>

      {cycle && (
        <p>
          Status do ciclo: <strong>{cycle.status}</strong>
          {cycle.calculated_at && ` — calculado em ${new Date(cycle.calculated_at).toLocaleString("pt-BR")}`}
        </p>
      )}

      {error && <p className="auth-error">{error}</p>}

      <button type="button" onClick={handleCalculate} disabled={calculating}>
        {calculating ? "Calculando..." : cycle ? "Recalcular ciclo" : "Calcular ciclo"}
      </button>

      {batch && (
        <div className="nfe-preview">
          <p>
            <strong>Redução final elegível: {batch.tco2e_amount.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e</strong>
          </p>
          <p>Fc (comercialização): {batch.commercialization_factor?.toFixed(4)}</p>
          <p>Fe (elegibilidade/reconciliação): {batch.eligibility_factor.toFixed(4)}</p>
          <p>Status do lote: {batch.status}</p>
        </div>
      )}

      {steps.length > 0 && (
        <>
          <h2>Etapas</h2>
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Valor</th>
                <th>Unidade</th>
                <th>Entradas</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.id}>
                  <td>{STEP_LABELS[s.step_key] ?? s.step_key}</td>
                  <td>{s.output_value.toLocaleString("pt-BR", { maximumFractionDigits: 6 })}</td>
                  <td>{s.unit}</td>
                  <td>
                    {Object.entries(s.input_values)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

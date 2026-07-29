import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Calendar, Package, Leaf, Award } from "lucide-react";
import { supabase } from "@/lib/supabase";

const CYCLE_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  calculated: "Calculado",
  in_verification: "Em verificação",
  verified: "Verificado",
  approved: "Aprovado",
  issued: "Emitido",
  rejected: "Rejeitado",
};

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card report-kpi-card">
      <span className="report-kpi-icon">
        <Icon size={17} />
      </span>
      <div>
        <p className="report-kpi-label">{label}</p>
        <p className="metric">{value}</p>
        {hint && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--sc-muted)" }}>{hint}</p>}
      </div>
    </div>
  );
}

function KpiCardsRow({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [cycleYear, setCycleYear] = useState<number | null>(null);
  const [cycleStatus, setCycleStatus] = useState<string | null>(null);
  const [commercializedKg, setCommercializedKg] = useState<number | null>(null);
  const [eligibleTco2e, setEligibleTco2e] = useState<number | null>(null);
  const [totalIssuedTco2e, setTotalIssuedTco2e] = useState(0);

  useEffect(() => {
    async function load() {
      const { data: cycles } = await supabase
        .from("credit_calculation_cycles")
        .select("id, period_year, status, credit_batches(tco2e_amount, credit_issuances(issued_amount_tco2e))")
        .eq("project_id", projectId)
        .order("period_year", { ascending: false });

      const cyclesTyped = (cycles ?? []) as unknown as {
        period_year: number;
        status: string;
        credit_batches: { tco2e_amount: number; credit_issuances: { issued_amount_tco2e: number }[] }[];
      }[];

      const latest = cyclesTyped[0];
      if (latest) {
        setCycleYear(latest.period_year);
        setCycleStatus(latest.status);
        setEligibleTco2e(latest.credit_batches?.[0]?.tco2e_amount ?? null);
      }

      const totalIssued = cyclesTyped.reduce(
        (sum, c) =>
          sum +
          (c.credit_batches ?? []).reduce(
            (s2, b) => s2 + (b.credit_issuances ?? []).reduce((s3, i) => s3 + Number(i.issued_amount_tco2e), 0),
            0,
          ),
        0,
      );
      setTotalIssuedTco2e(totalIssued);

      const { data: production } = await supabase
        .from("production_period_summary")
        .select("period_year, total_commercialized_kg")
        .eq("project_id", projectId)
        .order("period_year", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCommercializedKg(production?.total_commercialized_kg ?? null);

      setLoading(false);
    }
    load();
  }, [projectId]);

  if (loading) return null;

  return (
    <div className="report-kpi-grid" style={{ marginBottom: "2rem" }}>
      <KpiCard
        icon={Calendar}
        label="Ciclo vigente"
        value={cycleYear ? String(cycleYear) : "—"}
        hint={cycleStatus ? CYCLE_STATUS_LABELS[cycleStatus] ?? cycleStatus : undefined}
      />
      <KpiCard
        icon={Package}
        label="Produto comercializado"
        value={
          commercializedKg != null
            ? `${commercializedKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`
            : "—"
        }
      />
      <KpiCard
        icon={Leaf}
        label="Redução de emissões elegível"
        value={
          eligibleTco2e != null
            ? `${eligibleTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`
            : "—"
        }
      />
      <KpiCard
        icon={Award}
        label="Créditos gerados"
        value={`${totalIssuedTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`}
      />
    </div>
  );
}

export function ProjetoOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;
  return <KpiCardsRow projectId={projectId} />;
}

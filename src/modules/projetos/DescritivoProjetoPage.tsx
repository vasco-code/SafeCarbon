import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, Calendar, Package, Leaf, Award } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProjectRole } from "@/hooks/useProjectRole";
import { DistribuicaoPage } from "@/modules/distribuicao/DistribuicaoPage";

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
  const [volumeLabel, setVolumeLabel] = useState("Produto comercializado");
  const [volumeKg, setVolumeKg] = useState<number | null>(null);
  const [reductionTco2e, setReductionTco2e] = useState<number | null>(null);
  const [reductionVerified, setReductionVerified] = useState(false);
  const [totalIssuedTco2e, setTotalIssuedTco2e] = useState(0);
  const [potentialTco2e, setPotentialTco2e] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const { data: cycles } = await supabase
        .from("credit_calculation_cycles")
        .select(
          "id, period_year, status, credit_batches(tco2e_amount, status, credit_issuances(issued_amount_tco2e, blockchain_tokens(status)))",
        )
        .eq("project_id", projectId)
        .order("period_year", { ascending: false });

      type IssuanceRow = {
        issued_amount_tco2e: number;
        blockchain_tokens: { status: string } | { status: string }[] | null;
      };
      const cyclesTyped = (cycles ?? []) as unknown as {
        id: string;
        period_year: number;
        status: string;
        credit_batches: { tco2e_amount: number; status: string; credit_issuances: IssuanceRow[] }[];
      }[];

      const latest = cyclesTyped[0];
      let usesVolumeStep = false;
      if (latest) {
        setCycleYear(latest.period_year);
        setCycleStatus(latest.status);
        const batch = latest.credit_batches?.[0];
        setReductionTco2e(batch?.tco2e_amount != null ? Number(batch.tco2e_amount) : null);
        // Só conta como "verificada" depois da aprovação do lote pelo verificador.
        setReductionVerified(batch?.status === "approved" || batch?.status === "issued");

        // Motores novos (PMX-EM v2.0) gravam o volume creditável na etapa E1;
        // os antigos não — nesse caso segue o "produto comercializado".
        const { data: volumeStep } = await supabase
          .from("credit_calculation_steps")
          .select("output_value")
          .eq("cycle_id", latest.id)
          .eq("step_key", "volume_creditavel")
          .maybeSingle();
        if (volumeStep) {
          usesVolumeStep = true;
          setVolumeLabel("Volume creditável");
          setVolumeKg(Number(volumeStep.output_value));
        }

        const { data: potential } = await supabase
          .from("project_period_inputs")
          .select("value")
          .eq("project_id", projectId)
          .eq("period_year", latest.period_year)
          .eq("input_key", "potencial_validacao_tco2e")
          .maybeSingle();
        setPotentialTco2e(potential ? Number(potential.value) : null);
      }

      // Créditos gerados = emissões vigentes; token cancelado não conta.
      const isCancelled = (i: IssuanceRow) => {
        const token = Array.isArray(i.blockchain_tokens) ? i.blockchain_tokens[0] : i.blockchain_tokens;
        return token?.status === "cancelled";
      };
      const totalIssued = cyclesTyped.reduce(
        (sum, c) =>
          sum +
          (c.credit_batches ?? []).reduce(
            (s2, b) =>
              s2 +
              (b.credit_issuances ?? [])
                .filter((i) => !isCancelled(i))
                .reduce((s3, i) => s3 + Number(i.issued_amount_tco2e), 0),
            0,
          ),
        0,
      );
      setTotalIssuedTco2e(totalIssued);

      if (!usesVolumeStep) {
        const { data: production } = await supabase
          .from("production_period_summary")
          .select("period_year, total_commercialized_kg")
          .eq("project_id", projectId)
          .order("period_year", { ascending: false })
          .limit(1)
          .maybeSingle();
        setVolumeKg(production?.total_commercialized_kg ?? null);
      }

      setLoading(false);
    }
    load();
  }, [projectId]);

  if (loading) return null;

  return (
    <div className="report-kpi-grid" style={{ marginBottom: "1.5rem" }}>
      <KpiCard
        icon={Calendar}
        label="Ciclo vigente"
        value={cycleYear ? String(cycleYear) : "—"}
        hint={cycleStatus ? CYCLE_STATUS_LABELS[cycleStatus] ?? cycleStatus : undefined}
      />
      <KpiCard
        icon={Package}
        label={volumeLabel}
        value={volumeKg != null ? `${volumeKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg` : "—"}
      />
      <KpiCard
        icon={Leaf}
        label={reductionVerified ? "Redução verificada" : "Redução calculada"}
        value={
          reductionTco2e != null
            ? `${reductionTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`
            : "—"
        }
        hint={reductionVerified ? undefined : "Aguardando verificação"}
      />
      <KpiCard
        icon={Award}
        label="Créditos gerados"
        value={`${totalIssuedTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`}
      />
      {potentialTco2e != null && (
        <KpiCard
          icon={Leaf}
          label="Potencial em validação"
          value={`${potentialTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`}
          hint="Informativo — não emitível"
        />
      )}
    </div>
  );
}

interface OrgInfo {
  name: string;
  logo_url: string | null;
  tax_id: string | null;
}

interface ProjectDescriptive {
  name: string;
  location_text: string | null;
  description: string | null;
  registry_standard: string;
  organizations_proponent: OrgInfo | null;
  organizations_developer: OrgInfo | null;
  methodology_versions: {
    version_label: string;
    methodologies: { name: string; sector: string; ipcc_category: string | null } | null;
  } | null;
}

const REGISTRY_LABELS: Record<string, string> = {
  verra: "Verra",
  gold_standard: "Gold Standard",
  mbre: "MBRE",
  none_yet: "Nenhum ainda",
  safe_trace_proprio: "Metodologia própria registrada na Safe Trace (em registro)",
};

function OrgSummary({ label, org }: { label: string; org: OrgInfo | null }) {
  if (!org) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      {org.logo_url ? (
        <img src={org.logo_url} alt={org.name} style={{ maxWidth: "48px", maxHeight: "48px", objectFit: "contain" }} />
      ) : null}
      <div>
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--sc-muted)", whiteSpace: "nowrap" }}>{label}</p>
        <p style={{ margin: 0, fontWeight: 600 }}>{org.name}</p>
        {org.tax_id && <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--sc-muted)" }}>{org.tax_id}</p>}
      </div>
    </div>
  );
}

export function DescritivoProjetoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { accessLevel } = useProjectRole(projectId);
  const [project, setProject] = useState<ProjectDescriptive | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProject() {
    if (!projectId) return;
    const { data } = await supabase
      .from("carbon_projects")
      .select(
        "name, location_text, description, registry_standard, organizations_proponent:proponent_org_id(name, logo_url, tax_id), organizations_developer:developer_org_id(name, logo_url, tax_id), methodology_versions(version_label, methodologies(name, sector, ipcc_category))",
      )
      .eq("id", projectId)
      .maybeSingle();
    const p = data as unknown as ProjectDescriptive | null;
    setProject(p);
    setDescription(p?.description ?? "");
    setLoading(false);
  }

  useEffect(() => {
    loadProject();
  }, [projectId]);

  async function handleSaveDescription() {
    if (!projectId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const { error: updateError } = await supabase
      .from("carbon_projects")
      .update({ description })
      .eq("id", projectId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Descrição salva.");
      loadProject();
    }
  }

  if (loading) return <p>Carregando...</p>;
  if (!project) return null;

  const canEdit = accessLevel === "full";

  return (
    <section>
      {projectId && <KpiCardsRow projectId={projectId} />}

      <h2 className="module-heading">
        <FileText size={20} /> Descritivo do Projeto
      </h2>

      {/* auto-fit, não repeat(2, ...): quando outros projetos tiverem mais
          organizações (ex.: "Organizações Participantes"), os cards se
          reorganizam sozinhos em vez de precisar mexer no grid de novo. */}
      <div className="report-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", marginBottom: "1.5rem" }}>
        <div className="card report-kpi-card" style={{ padding: "1rem" }}>
          <OrgSummary label="Organização proponente" org={project.organizations_proponent} />
        </div>
        <div className="card report-kpi-card" style={{ padding: "1rem" }}>
          <OrgSummary label="Organização desenvolvedora (MRV)" org={project.organizations_developer} />
        </div>
      </div>

      <table style={{ marginBottom: "1.5rem" }}>
        <tbody>
          <tr>
            <th style={{ textAlign: "left", width: "12rem" }}>Metodologia</th>
            <td>
              {project.methodology_versions?.methodologies?.name ?? "—"}
              {project.methodology_versions ? ` v${project.methodology_versions.version_label}` : ""}
            </td>
          </tr>
          <tr>
            <th style={{ textAlign: "left" }}>Setor / Categoria IPCC</th>
            <td>
              {project.methodology_versions?.methodologies?.sector ?? "—"}
              {project.methodology_versions?.methodologies?.ipcc_category
                ? ` — ${project.methodology_versions.methodologies.ipcc_category}`
                : ""}
            </td>
          </tr>
          <tr>
            <th style={{ textAlign: "left" }}>Padrão de registro</th>
            <td>{REGISTRY_LABELS[project.registry_standard] ?? project.registry_standard}</td>
          </tr>
          <tr>
            <th style={{ textAlign: "left" }}>Localização</th>
            <td>{project.location_text ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      <h3>Descrição</h3>
      {canEdit ? (
        <>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            style={{ width: "100%" }}
            placeholder="Descreva o projeto: contexto, produto, metodologia aplicada, resultados esperados..."
          />
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          <button type="button" className="btn-primary" onClick={handleSaveDescription} disabled={saving} style={{ marginTop: "0.5rem" }}>
            {saving ? "Salvando..." : "Salvar descrição"}
          </button>
        </>
      ) : (
        <p>{project.description ?? "Nenhuma descrição cadastrada ainda."}</p>
      )}

      <div style={{ marginTop: "2rem" }}>
        <DistribuicaoPage />
      </div>
    </section>
  );
}

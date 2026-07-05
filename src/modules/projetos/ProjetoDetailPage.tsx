import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ProjectDetail {
  id: string;
  name: string;
  status: string;
  registry_standard: string;
  methodology_versions: {
    version_label: string;
    methodologies: { name: string } | null;
  } | null;
}

function ResumoCalculoCard({ projectId }: { projectId: string }) {
  const [year, setYear] = useState("2025");
  const [narrativeText, setNarrativeText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLatest(targetYear: string) {
    const { data: cycle } = await supabase
      .from("credit_calculation_cycles")
      .select("id")
      .eq("project_id", projectId)
      .eq("period_year", Number(targetYear))
      .maybeSingle();
    if (!cycle) {
      setNarrativeText(null);
      return;
    }
    const { data: resumo } = await supabase
      .from("resumo_calculo_documents")
      .select("narrative_text")
      .eq("cycle_id", cycle.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setNarrativeText(resumo?.narrative_text ?? null);
  }

  useEffect(() => {
    loadLatest(year);
  }, [projectId]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const periodYear = Number(year);

    const { data: cycle } = await supabase
      .from("credit_calculation_cycles")
      .select("id")
      .eq("project_id", projectId)
      .eq("period_year", periodYear)
      .maybeSingle();

    if (!cycle) {
      setError(`Nenhum ciclo calculado para ${year} — calcule em "Ciclo de créditos" primeiro.`);
      setLoading(false);
      return;
    }

    const [stepsResult, batchResult, inventoryResult] = await Promise.all([
      supabase
        .from("credit_calculation_steps")
        .select("step_key, output_value")
        .eq("cycle_id", cycle.id),
      supabase
        .from("credit_batches")
        .select("tco2e_amount, commercialization_factor")
        .eq("cycle_id", cycle.id)
        .maybeSingle(),
      supabase
        .from("emission_inventory_entries")
        .select("calculated_tco2e")
        .eq("project_id", projectId)
        .eq("period_year", periodYear),
    ]);

    const stepValue = (key: string) => stepsResult.data?.find((s) => s.step_key === key)?.output_value ?? 0;
    const batch = batchResult.data;
    const eOperacionais = (inventoryResult.data ?? []).reduce((sum, e) => sum + Number(e.calculated_tco2e), 0);

    const text = [
      `Resumo do Cálculo — Ciclo ${year}`,
      "",
      `No ciclo ${year}, a Premix produziu ${stepValue("producao_anual").toLocaleString("pt-BR")} toneladas do aditivo Fator P, das quais ${(stepValue("comercializacao") * stepValue("producao_anual")).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} toneladas foram comercializadas (fator de comercialização Fc = ${batch?.commercialization_factor?.toFixed(4) ?? "—"}).`,
      "",
      `A partir do consumo médio estimado por animal, projeta-se cobertura para aproximadamente ${Math.round(stepValue("estimativa_cobertura_animal")).toLocaleString("pt-BR")} animais suplementados — estimativa técnica intermediária, não uma unidade de crédito.`,
      "",
      `As emissões de metano entérico evitadas somam ${stepValue("conversao_co2e").toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO2e brutas. Após dedução de ${eOperacionais.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO2e de emissões operacionais da cadeia produtiva do aditivo, e aplicação dos descontos de incerteza e do buffer de integridade previstos na metodologia, a redução final elegível para geração de créditos de carbono é de ${batch?.tco2e_amount.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) ?? "—"} tCO2e.`,
    ].join("\n");

    const { error: insertError } = await supabase
      .from("resumo_calculo_documents")
      .insert({ cycle_id: cycle.id, narrative_text: text });

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setNarrativeText(text);
    }
  }

  return (
    <div className="dcp-section">
      <h2>Resumo de Cálculo</h2>
      <label htmlFor="resumo-year">Ano</label>
      <input
        id="resumo-year"
        type="number"
        value={year}
        onChange={(e) => {
          setYear(e.target.value);
          loadLatest(e.target.value);
        }}
      />
      <button type="button" onClick={handleGenerate} disabled={loading}>
        {loading ? "Gerando..." : "Gerar resumo"}
      </button>
      {error && <p className="auth-error">{error}</p>}
      {narrativeText && <pre className="dcp-generated-content">{narrativeText}</pre>}
    </div>
  );
}

export function ProjetoDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("carbon_projects")
      .select("id, name, status, registry_standard, methodology_versions(version_label, methodologies(name))")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        setProject(data as unknown as ProjectDetail | null);
        setLoading(false);
      });
  }, [projectId]);

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (!project) {
    return (
      <section>
        <h1>Projeto</h1>
        <p>Projeto não encontrado, ou você não tem acesso a ele.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>{project.name}</h1>
      <p>
        Status: {project.status}
        {project.methodology_versions && (
          <>
            {" "}
            · Metodologia: {project.methodology_versions.methodologies?.name} v
            {project.methodology_versions.version_label}
          </>
        )}
      </p>

      <ul className="project-nav-list">
        <li>
          <Link to={`/projetos/${project.id}/producao`}>Produção</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/comercializacao`}>Comercialização</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/inventario`}>Inventário de emissões</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/vazamentos`}>Avaliação de vazamentos</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/ciclos/${new Date().getFullYear()}`}>Ciclo de créditos</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/verificacao`}>Verificação</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/dcp`}>DCP</Link>
        </li>
      </ul>

      <ResumoCalculoCard projectId={project.id} />
    </section>
  );
}

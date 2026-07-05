import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface MethodologyVersionDetail {
  id: string;
  version_label: string;
  status: string;
  published_at: string | null;
  sections: Record<string, { titulo: string; corpo: string }>;
  methodologies: { name: string; sector: string; ipcc_category: string | null } | null;
}

interface ParameterRow {
  id: string;
  param_key: string;
  value: number;
  unit: string | null;
  source_citation: string | null;
  valid_from: string;
}

const SECTION_ORDER = [
  "enquadramento",
  "principio_central",
  "linha_de_base",
  "fator_mitigacao",
  "estrutura_calculo",
  "fatores_integridade",
  "mrv",
  "renovacao_anual",
  "governanca",
  "resultado_esperado",
  "sintese_executiva",
  "referencias",
];

const PARAM_LABELS: Record<string, string> = {
  mitigation_factor_pct: "Fator de mitigação (R)",
  baseline_ef_ch4_kg_per_animal_year: "Fator de emissão da linha de base (EF)",
  gwp_ch4: "GWP do metano (GWP₁₀₀)",
  avg_consumption_kg_per_animal_year: "Consumo médio do aditivo por animal (C_uso)",
  uncertainty_discount_pct: "Desconto de incerteza",
  integrity_buffer_pct: "Buffer de integridade",
};

export function MetodologiaDetailPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const [version, setVersion] = useState<MethodologyVersionDetail | null>(null);
  const [parameters, setParameters] = useState<ParameterRow[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!versionId) return;

    Promise.all([
      supabase
        .from("methodology_versions")
        .select("id, version_label, status, published_at, sections, methodologies(name, sector, ipcc_category)")
        .eq("id", versionId)
        .maybeSingle(),
      supabase
        .from("methodology_parameters")
        .select("id, param_key, value, unit, source_citation, valid_from")
        .eq("methodology_version_id", versionId)
        .order("param_key"),
    ]).then(([versionResult, parametersResult]) => {
      const v = versionResult.data as unknown as MethodologyVersionDetail | null;
      setVersion(v);
      setParameters((parametersResult.data ?? []) as ParameterRow[]);
      if (v) {
        const firstKey = SECTION_ORDER.find((key) => key in v.sections) ?? Object.keys(v.sections)[0];
        setActiveSection(firstKey ?? null);
      }
      setLoading(false);
    });
  }, [versionId]);

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (!version) {
    return (
      <section>
        <h1>Metodologia</h1>
        <p>Versão não encontrada, ou você não tem acesso a ela.</p>
      </section>
    );
  }

  const sectionKeys = SECTION_ORDER.filter((key) => key in version.sections).concat(
    Object.keys(version.sections).filter((key) => !SECTION_ORDER.includes(key)),
  );
  const active = activeSection ? version.sections[activeSection] : null;

  return (
    <section>
      <h1>{version.methodologies?.name}</h1>
      <p>
        Setor {version.methodologies?.sector} · {version.methodologies?.ipcc_category} · versão{" "}
        {version.version_label} · {version.status}
      </p>

      <div className="methodology-layout">
        <nav className="methodology-nav">
          {sectionKeys.map((key) => (
            <button
              key={key}
              type="button"
              className={key === activeSection ? "active" : ""}
              onClick={() => setActiveSection(key)}
            >
              {version.sections[key].titulo}
            </button>
          ))}
        </nav>

        <div className="methodology-content">
          {active && (
            <article>
              <h2>{active.titulo}</h2>
              {active.corpo.split("\n\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </article>
          )}
        </div>
      </div>

      <h2>Parâmetros vigentes</h2>
      <table>
        <thead>
          <tr>
            <th>Parâmetro</th>
            <th>Valor</th>
            <th>Unidade</th>
            <th>Fonte</th>
            <th>Vigente desde</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((p) => (
            <tr key={p.id}>
              <td>{PARAM_LABELS[p.param_key] ?? p.param_key}</td>
              <td>{p.value}</td>
              <td>{p.unit}</td>
              <td>{p.source_citation}</td>
              <td>{p.valid_from}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

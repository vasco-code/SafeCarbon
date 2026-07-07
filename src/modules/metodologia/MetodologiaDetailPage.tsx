import { useEffect, useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen, Send, Copy, Archive, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface MethodologyVersionDetail {
  id: string;
  version_label: string;
  status: "draft" | "published" | "deprecated";
  published_at: string | null;
  sections: Record<string, { titulo: string; corpo: string }>;
  methodologies: { id: string; name: string; sector: string; ipcc_category: string | null; owner_org_id: string } | null;
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

const SECTION_DEFAULT_TITLES: Record<string, string> = {
  enquadramento: "Enquadramento e Aplicabilidade",
  principio_central: "Princípio Central",
  linha_de_base: "Linha de Base",
  fator_mitigacao: "Fator de Mitigação",
  estrutura_calculo: "Estrutura de Cálculo",
  fatores_integridade: "Fatores de Integridade",
  mrv: "MRV (Monitoramento, Relato e Verificação)",
  renovacao_anual: "Renovação Anual",
  governanca: "Governança",
  resultado_esperado: "Resultado Esperado",
  sintese_executiva: "Síntese Executiva",
  referencias: "Referências",
};

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
  const navigate = useNavigate();
  const { memberships, isPlatformAdmin } = useAuth();
  const [version, setVersion] = useState<MethodologyVersionDetail | null>(null);
  const [parameters, setParameters] = useState<ParameterRow[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionBody, setSectionBody] = useState("");
  const [savingSection, setSavingSection] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [replicating, setReplicating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [newVersionLabel, setNewVersionLabel] = useState("");
  const [showReplicateForm, setShowReplicateForm] = useState(false);
  const [newParam, setNewParam] = useState({ param_key: "", value: "", unit: "", source_citation: "", valid_from: "" });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    if (!versionId) return;
    const [versionResult, parametersResult] = await Promise.all([
      supabase
        .from("methodology_versions")
        .select("id, version_label, status, published_at, sections, methodologies(id, name, sector, ipcc_category, owner_org_id)")
        .eq("id", versionId)
        .maybeSingle(),
      supabase
        .from("methodology_parameters")
        .select("id, param_key, value, unit, source_citation, valid_from")
        .eq("methodology_version_id", versionId)
        .order("param_key"),
    ]);
    const v = versionResult.data as unknown as MethodologyVersionDetail | null;
    setVersion(v);
    setParameters((parametersResult.data ?? []) as ParameterRow[]);
    setLoading(false);
    return v;
  }

  useEffect(() => {
    loadData().then((v) => {
      if (!v) return;
      const firstKey = SECTION_ORDER.find((key) => key in v.sections) ?? Object.keys(v.sections)[0] ?? SECTION_ORDER[0];
      setActiveSection(firstKey ?? null);
    });
  }, [versionId]);

  const canEdit =
    !!version?.methodologies &&
    (isPlatformAdmin || memberships.some((m) => m.orgId === version.methodologies!.owner_org_id));

  useEffect(() => {
    if (!version || !activeSection) return;
    const existing = version.sections[activeSection];
    setSectionTitle(existing?.titulo ?? SECTION_DEFAULT_TITLES[activeSection] ?? activeSection);
    setSectionBody(existing?.corpo ?? "");
  }, [activeSection, version]);

  async function handleSaveSection() {
    if (!version || !activeSection) return;
    setSavingSection(true);
    setError(null);
    const newSections = { ...version.sections, [activeSection]: { titulo: sectionTitle, corpo: sectionBody } };
    const { error } = await supabase.from("methodology_versions").update({ sections: newSections }).eq("id", version.id);
    setSavingSection(false);
    if (error) {
      setError(error.message);
    } else {
      setMessage("Seção salva.");
      loadData();
    }
  }

  async function handlePublish() {
    if (!version) return;
    if (!confirm("Publicar esta versão? Ela passa a ficar visível publicamente e disponível para uso em projetos.")) return;
    setPublishing(true);
    setError(null);
    const { error } = await supabase
      .from("methodology_versions")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", version.id);
    setPublishing(false);
    if (error) {
      setError(error.message);
    } else {
      setMessage("Versão publicada.");
      loadData();
    }
  }

  async function handleAddParameter(event: FormEvent) {
    event.preventDefault();
    if (!version) return;
    setError(null);
    const { error } = await supabase.from("methodology_parameters").insert({
      methodology_version_id: version.id,
      param_key: newParam.param_key,
      value: Number(newParam.value),
      unit: newParam.unit || null,
      source_citation: newParam.source_citation || null,
      valid_from: newParam.valid_from || new Date().toISOString().slice(0, 10),
    });
    if (error) {
      setError(error.message);
    } else {
      setNewParam({ param_key: "", value: "", unit: "", source_citation: "", valid_from: "" });
      loadData();
    }
  }

  async function handleUpdateParameter(param: ParameterRow, patch: Partial<ParameterRow>) {
    const { error } = await supabase.from("methodology_parameters").update(patch).eq("id", param.id);
    if (error) {
      setError(error.message);
    } else {
      loadData();
    }
  }

  async function handleDeleteParameter(id: string) {
    if (!confirm("Excluir este parâmetro?")) return;
    const { error } = await supabase.from("methodology_parameters").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      loadData();
    }
  }

  async function handleReplicateVersion() {
    if (!version || !newVersionLabel.trim()) return;
    setReplicating(true);
    setError(null);
    const { data, error } = await supabase.rpc("replicate_methodology_version", {
      p_version_id: version.id,
      p_new_label: newVersionLabel,
    });
    setReplicating(false);
    if (error) {
      setError(error.message);
    } else {
      setMessage("Versão replicada com sucesso!");
      setShowReplicateForm(false);
      setNewVersionLabel("");
      navigate(`/metodologias/${data}`);
    }
  }

  async function handleArchiveMethodology() {
    if (!version?.methodologies) return;
    if (!confirm("Arquivar esta metodologia? Ela não aparecerá mais nas listagens.")) return;
    setArchiving(true);
    setError(null);
    const { error } = await supabase.rpc("soft_delete_methodology", {
      p_methodology_id: version.methodologies.id,
    });
    setArchiving(false);
    if (error) {
      setError(error.message);
    } else {
      setMessage("Metodologia arquivada.");
      setTimeout(() => navigate("/metodologias"), 1500);
    }
  }

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

  const sectionKeys = canEdit
    ? SECTION_ORDER.concat(Object.keys(version.sections).filter((key) => !SECTION_ORDER.includes(key)))
    : SECTION_ORDER.filter((key) => key in version.sections).concat(
        Object.keys(version.sections).filter((key) => !SECTION_ORDER.includes(key)),
      );
  const active = activeSection ? version.sections[activeSection] : null;
  const isDraft = version.status === "draft";

  return (
    <section>
      <h1 className="module-heading">
        <BookOpen size={22} /> {version.methodologies?.name}
      </h1>
      <p>
        Setor {version.methodologies?.sector} · {version.methodologies?.ipcc_category} · versão{" "}
        {version.version_label} · <span className="badge badge-neutral">{version.status}</span>
      </p>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      {canEdit && isDraft && (
        <div className="action-bar">
          <p style={{ margin: 0 }}>Rascunho — visível só para membros da organização proprietária até ser publicado.</p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="btn-primary" onClick={handlePublish} disabled={publishing}>
              <Send size={15} />
              {publishing ? "Publicando..." : "Publicar versão"}
            </button>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="action-bar">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowReplicateForm(!showReplicateForm)}
              disabled={replicating}
            >
              <Copy size={15} />
              {replicating ? "Replicando..." : "Criar nova versão"}
            </button>
            <button
              type="button"
              className="btn-icon-danger"
              onClick={handleArchiveMethodology}
              disabled={archiving}
              title="Arquivar esta metodologia"
            >
              <Archive size={15} />
              {archiving ? "Arquivando..." : "Arquivar"}
            </button>
            <button
              type="button"
              className="btn-icon-primary"
              onClick={() => navigate(`/auditoria?entity_type=methodology&entity_id=${version.methodologies?.id || ""}`)}
              title="Ver histórico de alterações"
            >
              <History size={15} />
              Histórico
            </button>
          </div>

          {showReplicateForm && (
            <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
              <label htmlFor="new-version-label">Nova versão (ex: 1.1, 2.0)</label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                <input
                  id="new-version-label"
                  type="text"
                  value={newVersionLabel}
                  onChange={(e) => setNewVersionLabel(e.target.value)}
                  placeholder="1.1"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleReplicateVersion}
                  disabled={replicating || !newVersionLabel.trim()}
                >
                  {replicating ? "Criando..." : "Criar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="methodology-layout">
        <nav className="methodology-nav">
          {sectionKeys.map((key) => (
            <button
              key={key}
              type="button"
              className={key === activeSection ? "active" : ""}
              onClick={() => setActiveSection(key)}
            >
              {version.sections[key]?.titulo ?? SECTION_DEFAULT_TITLES[key] ?? key}
            </button>
          ))}
        </nav>

        <div className="methodology-content">
          {canEdit && isDraft ? (
            <div>
              <label htmlFor="section-title">Título da seção</label>
              <input id="section-title" type="text" value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} />
              <label htmlFor="section-body">Conteúdo</label>
              <textarea
                id="section-body"
                rows={12}
                value={sectionBody}
                onChange={(e) => setSectionBody(e.target.value)}
                style={{ width: "100%" }}
              />
              <button type="button" className="btn-primary" onClick={handleSaveSection} disabled={savingSection}>
                {savingSection ? "Salvando..." : "Salvar seção"}
              </button>
            </div>
          ) : (
            active && (
              <article>
                <h2>{active.titulo}</h2>
                {active.corpo.split("\n\n").map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </article>
            )
          )}
        </div>
      </div>

      <h2>Parâmetros vigentes</h2>
      {parameters.length === 0 && (
        <div className="empty-state">
          <p>Nenhum parâmetro cadastrado ainda.</p>
        </div>
      )}
      {parameters.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Parâmetro</th>
              <th>Valor</th>
              <th>Unidade</th>
              <th>Fonte</th>
              <th>Vigente desde</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {parameters.map((p) => (
              <tr key={p.id}>
                <td>{PARAM_LABELS[p.param_key] ?? p.param_key}</td>
                {canEdit ? (
                  <>
                    <td>
                      <input
                        type="number"
                        style={{ width: "6rem" }}
                        defaultValue={p.value}
                        onBlur={(e) => handleUpdateParameter(p, { value: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        style={{ width: "6rem" }}
                        defaultValue={p.unit ?? ""}
                        onBlur={(e) => handleUpdateParameter(p, { unit: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        defaultValue={p.source_citation ?? ""}
                        onBlur={(e) => handleUpdateParameter(p, { source_citation: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        defaultValue={p.valid_from}
                        onBlur={(e) => handleUpdateParameter(p, { valid_from: e.target.value })}
                      />
                    </td>
                    <td className="row-actions">
                      <button type="button" className="btn-icon-danger" onClick={() => handleDeleteParameter(p.id)}>
                        Excluir
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{p.value}</td>
                    <td>{p.unit}</td>
                    <td>{p.source_citation}</td>
                    <td>{p.valid_from}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canEdit && (
        <form onSubmit={handleAddParameter} style={{ marginTop: "1.5rem" }}>
          <h2>Adicionar parâmetro</h2>
          <label htmlFor="param-key">Chave</label>
          <input
            id="param-key"
            type="text"
            placeholder="ex.: mitigation_factor_pct"
            value={newParam.param_key}
            onChange={(e) => setNewParam((prev) => ({ ...prev, param_key: e.target.value }))}
            required
          />
          <label htmlFor="param-value">Valor</label>
          <input
            id="param-value"
            type="number"
            step="any"
            value={newParam.value}
            onChange={(e) => setNewParam((prev) => ({ ...prev, value: e.target.value }))}
            required
          />
          <label htmlFor="param-unit">Unidade</label>
          <input
            id="param-unit"
            type="text"
            value={newParam.unit}
            onChange={(e) => setNewParam((prev) => ({ ...prev, unit: e.target.value }))}
          />
          <label htmlFor="param-source">Fonte</label>
          <input
            id="param-source"
            type="text"
            value={newParam.source_citation}
            onChange={(e) => setNewParam((prev) => ({ ...prev, source_citation: e.target.value }))}
          />
          <label htmlFor="param-valid-from">Vigente desde</label>
          <input
            id="param-valid-from"
            type="date"
            value={newParam.valid_from}
            onChange={(e) => setNewParam((prev) => ({ ...prev, valid_from: e.target.value }))}
          />
          <button type="submit">Adicionar parâmetro</button>
        </form>
      )}
    </section>
  );
}

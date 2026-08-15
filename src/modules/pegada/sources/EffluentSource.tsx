import { useMemo, useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import type { EffluentMethod } from "../engine/types";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, PeriodField, type SourceProps } from "./common";

// Efluentes (Escopo 1). Dois métodos: cálculo detalhado (metodologia IPCC, com
// até três etapas — tratamento, tratamento sequencial e disposição final) e
// relato direto de CO2/CH4/N2O. Ver calcEffluent no registry.

const METHOD_LABELS: Record<EffluentMethod, string> = {
  detailed: "Cálculo detalhado (IPCC)",
  direct: "Relato direto de CO₂/CH₄/N₂O",
};

const DOMAIN_LABELS: Record<"domestic" | "industrial", string> = {
  domestic: "Doméstico (esgoto sanitário)",
  industrial: "Industrial",
};

// Campos de uma etapa adicional do caminho do efluente (tratamento sequencial
// ou disposição final). Mesma forma da etapa 1; a disposição final não tem
// carga removida nem recuperação de CH₄ (a planilha não os considera lá).
type StageForm = {
  treatment_type: string;
  volume_m3: string;
  organic_unit: "dbo" | "dqo";
  organic_load_kg_m3: string;
  organic_removed_kg_m3: string;
  nitrogen_kg_m3: string;
  ch4_recovered_t: string;
  biogas_flared: boolean;
};

const EMPTY_STAGE: StageForm = {
  treatment_type: "",
  volume_m3: "",
  organic_unit: "dbo",
  organic_load_kg_m3: "",
  organic_removed_kg_m3: "",
  nitrogen_kg_m3: "",
  ch4_recovered_t: "",
  biogas_flared: false,
};

function StageFields({
  idPrefix,
  legend,
  treatments,
  stage,
  setStage,
  allowRemoval,
}: {
  idPrefix: string;
  legend: string;
  treatments: string[];
  stage: StageForm;
  setStage: (updater: (s: StageForm) => StageForm) => void;
  allowRemoval: boolean;
}) {
  const set = (k: keyof StageForm) => (v: string | boolean) => setStage((s) => ({ ...s, [k]: v }));
  return (
    <div style={{ borderLeft: "3px solid var(--sc-border)", paddingLeft: "0.9rem", marginTop: "0.5rem" }}>
      <p style={{ fontSize: "0.8rem", color: "var(--sc-muted)", margin: "0 0 0.5rem" }}>{legend}</p>

      <label htmlFor={`${idPrefix}-treatment`}>Tipo de tratamento</label>
      <select id={`${idPrefix}-treatment`} value={stage.treatment_type} onChange={(e) => set("treatment_type")(e.target.value)}>
        <option value="">Selecione...</option>
        {treatments.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <label htmlFor={`${idPrefix}-volume`}>Vazão nesta etapa (m³/ano)</label>
      <input id={`${idPrefix}-volume`} type="number" step="0.01" min="0" value={stage.volume_m3} onChange={(e) => set("volume_m3")(e.target.value)} />

      <label htmlFor={`${idPrefix}-unit`}>Unidade da carga orgânica</label>
      <select id={`${idPrefix}-unit`} value={stage.organic_unit} onChange={(e) => set("organic_unit")(e.target.value)}>
        <option value="dbo">DBO — kgDBO/m³</option>
        <option value="dqo">DQO — kgDQO/m³</option>
      </select>

      <label htmlFor={`${idPrefix}-load`}>
        Carga orgânica degradável (kg{stage.organic_unit === "dqo" ? "DQO" : "DBO"}/m³)
      </label>
      <input id={`${idPrefix}-load`} type="number" step="0.0001" min="0" value={stage.organic_load_kg_m3} onChange={(e) => set("organic_load_kg_m3")(e.target.value)} />

      {allowRemoval && (
        <>
          <label htmlFor={`${idPrefix}-removed`}>Carga orgânica removida com o lodo (kg/m³, opcional)</label>
          <input id={`${idPrefix}-removed`} type="number" step="0.0001" min="0" value={stage.organic_removed_kg_m3} onChange={(e) => set("organic_removed_kg_m3")(e.target.value)} />
        </>
      )}

      <label htmlFor={`${idPrefix}-n`}>Nitrogênio no efluente (kgN/m³, opcional — deixe em branco para usar o default da origem, se houver)</label>
      <input id={`${idPrefix}-n`} type="number" step="0.0001" min="0" value={stage.nitrogen_kg_m3} onChange={(e) => set("nitrogen_kg_m3")(e.target.value)} />

      {allowRemoval && (
        <>
          <label htmlFor={`${idPrefix}-rec`}>CH₄ recuperado (tCH₄/ano, opcional)</label>
          <input id={`${idPrefix}-rec`} type="number" step="0.0001" min="0" value={stage.ch4_recovered_t} onChange={(e) => set("ch4_recovered_t")(e.target.value)} />

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
            <input type="checkbox" checked={stage.biogas_flared} onChange={(e) => set("biogas_flared")(e.target.checked)} style={{ width: "auto" }} />
            Biogás recuperado é queimado em flare (gera CO₂ biogênico)
          </label>
        </>
      )}
    </div>
  );
}

function stageToData(s: StageForm, allowRemoval: boolean) {
  return {
    treatment_type: s.treatment_type,
    volume_m3: s.volume_m3 ? Number(s.volume_m3) : undefined,
    organic_unit: s.organic_unit,
    organic_load_kg_m3: s.organic_load_kg_m3 ? Number(s.organic_load_kg_m3) : undefined,
    nitrogen_kg_m3: s.nitrogen_kg_m3 ? Number(s.nitrogen_kg_m3) : undefined,
    ...(allowRemoval
      ? {
          organic_removed_kg_m3: s.organic_removed_kg_m3 ? Number(s.organic_removed_kg_m3) : undefined,
          ch4_recovered_t: s.ch4_recovered_t ? Number(s.ch4_recovered_t) : undefined,
          biogas_flared: s.biogas_flared,
        }
      : {}),
  };
}

export function EffluentSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  // Tipos de tratamento por domínio, derivados da tabela de fator.
  const treatmentsByDomain = useMemo(() => {
    const map: Record<"domestic" | "industrial", string[]> = { domestic: [], industrial: [] };
    for (const f of ctx.effluents.values()) map[f.domain].push(f.treatment_type);
    return map;
  }, [ctx.effluents]);

  const nitrogenDefaultTypes = useMemo(
    () => [...ctx.effluentNitrogenDefaults.keys()].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [ctx.effluentNitrogenDefaults],
  );

  const [method, setMethod] = useState<EffluentMethod>("detailed");
  const [domain, setDomain] = useState<"domestic" | "industrial">("domestic");
  const [effluentType, setEffluentType] = useState("");
  const [treatment, setTreatment] = useState("");
  const [volume, setVolume] = useState("");
  const [organicUnit, setOrganicUnit] = useState<"dbo" | "dqo">("dbo");
  const [organicLoad, setOrganicLoad] = useState("");
  const [organicRemoved, setOrganicRemoved] = useState("");
  const [nitrogen, setNitrogen] = useState("");
  const [ch4Recovered, setCh4Recovered] = useState("");
  const [biogasFlared, setBiogasFlared] = useState(false);
  // etapas adicionais
  const [hasSequential, setHasSequential] = useState(false);
  const [seq, setSeq] = useState<StageForm>(EMPTY_STAGE);
  const [hasDisposal, setHasDisposal] = useState(false);
  const [disp, setDisp] = useState<StageForm>(EMPTY_STAGE);
  // direto
  const [co2, setCo2] = useState("");
  const [ch4, setCh4] = useState("");
  const [n2o, setN2o] = useState("");
  const [bioCo2, setBioCo2] = useState("");

  const [sourceRef, setSourceRef] = useState("");
  const [desc, setDesc] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const treatmentOptions = treatmentsByDomain[domain];

  function buildData() {
    if (method === "direct") {
      return {
        source_category: "effluents",
        method: "direct",
        co2_t: co2 ? Number(co2) : undefined,
        ch4_t: ch4 ? Number(ch4) : undefined,
        n2o_t: n2o ? Number(n2o) : undefined,
        biogenic_co2_t: bioCo2 ? Number(bioCo2) : undefined,
      } as const;
    }
    return {
      source_category: "effluents",
      method: "detailed",
      domain,
      effluent_type: domain === "industrial" && effluentType ? effluentType : undefined,
      treatment_type: treatment,
      volume_m3: volume ? Number(volume) : undefined,
      organic_unit: organicUnit,
      organic_load_kg_m3: organicLoad ? Number(organicLoad) : undefined,
      organic_removed_kg_m3: organicRemoved ? Number(organicRemoved) : undefined,
      nitrogen_kg_m3: nitrogen ? Number(nitrogen) : undefined,
      ch4_recovered_t: ch4Recovered ? Number(ch4Recovered) : undefined,
      biogas_flared: biogasFlared,
      ...(hasSequential && seq.treatment_type ? { sequential: stageToData(seq, true) } : {}),
      ...(hasDisposal && disp.treatment_type ? { disposal: stageToData(disp, false) } : {}),
    } as const;
  }

  const canPreview =
    method === "direct"
      ? Boolean(co2 || ch4 || n2o)
      : Boolean(treatment && Number(volume) > 0 && Number(organicLoad) > 0);
  const preview = canPreview ? calculate(buildData(), ctx) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (method === "detailed" && !treatment) {
      setError("Selecione o tipo de tratamento.");
      return;
    }
    if (!canPreview) {
      setError("Preencha os dados necessários para o cálculo.");
      return;
    }
    const result = calculate(buildData(), ctx);
    if (!result.ok) {
      setError(`Erro no cálculo: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(inventoryId, buildData(), result.computed, {
      sourceRef,
      description: desc,
      periodMonth: periodMonth ? Number(periodMonth) : null,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setEffluentType("");
      setVolume("");
      setOrganicLoad("");
      setOrganicRemoved("");
      setNitrogen("");
      setCh4Recovered("");
      setBiogasFlared(false);
      setHasSequential(false);
      setSeq(EMPTY_STAGE);
      setHasDisposal(false);
      setDisp(EMPTY_STAGE);
      setCo2("");
      setCh4("");
      setN2o("");
      setBioCo2("");
      setSourceRef("");
      setDesc("");
      setPeriodMonth("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Efluentes</h2>
      <p>
        Emissões de CH₄ e N₂O do tratamento e disposição final de efluentes líquidos (Escopo 1). O CH₄
        do efluente é de origem biogênica; quando recuperado e queimado em flare, vira CO₂ biogênico
        (reportado à parte).
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="ef-ref">Registro da fonte</label>
          <input id="ef-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="ex.: ETE Matriz" />

          <label htmlFor="ef-desc">Descrição</label>
          <input id="ef-desc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} />

          <label htmlFor="ef-method">Método de cálculo</label>
          <select id="ef-method" value={method} onChange={(e) => setMethod(e.target.value as EffluentMethod)}>
            {(Object.keys(METHOD_LABELS) as EffluentMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>

          {method === "detailed" ? (
            <>
              <label htmlFor="ef-domain">Tipo de efluente</label>
              <select
                id="ef-domain"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value as "domestic" | "industrial");
                  setTreatment("");
                  setEffluentType("");
                }}
              >
                {(Object.keys(DOMAIN_LABELS) as ("domestic" | "industrial")[]).map((d) => (
                  <option key={d} value={d}>
                    {DOMAIN_LABELS[d]}
                  </option>
                ))}
              </select>

              {domain === "industrial" && (
                <>
                  <label htmlFor="ef-origin">Origem do efluente (opcional — default de nitrogênio)</label>
                  <select id="ef-origin" value={effluentType} onChange={(e) => setEffluentType(e.target.value)}>
                    <option value="">Nenhuma / outros efluentes industriais (informar N manualmente)</option>
                    {nitrogenDefaultTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {effluentType && (
                    <p style={{ fontSize: "0.8125rem", color: "var(--sc-muted)", marginTop: 0 }}>
                      Default IPCC: {fmt(ctx.effluentNitrogenDefaults.get(effluentType) ?? 0, 4)} kgN/m³ — usado em
                      qualquer etapa cujo campo de nitrogênio ficar em branco.
                    </p>
                  )}
                </>
              )}

              <label htmlFor="ef-treatment">Tipo de tratamento</label>
              <select id="ef-treatment" value={treatment} onChange={(e) => setTreatment(e.target.value)}>
                <option value="">Selecione...</option>
                {treatmentOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <label htmlFor="ef-volume">Vazão de efluente gerada no ano (m³/ano)</label>
              <input id="ef-volume" type="number" step="0.01" min="0" value={volume} onChange={(e) => setVolume(e.target.value)} />

              <label htmlFor="ef-unit">Unidade da carga orgânica</label>
              <select id="ef-unit" value={organicUnit} onChange={(e) => setOrganicUnit(e.target.value as "dbo" | "dqo")}>
                <option value="dbo">DBO (Demanda Bioquímica de Oxigênio) — kgDBO/m³</option>
                <option value="dqo">DQO (Demanda Química de Oxigênio) — kgDQO/m³</option>
              </select>

              <label htmlFor="ef-load">Carga orgânica degradável (kg{organicUnit === "dqo" ? "DQO" : "DBO"}/m³)</label>
              <input id="ef-load" type="number" step="0.0001" min="0" value={organicLoad} onChange={(e) => setOrganicLoad(e.target.value)} />

              <label htmlFor="ef-removed">Carga orgânica removida com o lodo (kg/m³, opcional)</label>
              <input id="ef-removed" type="number" step="0.0001" min="0" value={organicRemoved} onChange={(e) => setOrganicRemoved(e.target.value)} />

              <label htmlFor="ef-n">Nitrogênio no efluente (kgN/m³, opcional — para N₂O)</label>
              <input id="ef-n" type="number" step="0.0001" min="0" value={nitrogen} onChange={(e) => setNitrogen(e.target.value)} />

              <label htmlFor="ef-rec">CH₄ recuperado (tCH₄/ano, opcional)</label>
              <input id="ef-rec" type="number" step="0.0001" min="0" value={ch4Recovered} onChange={(e) => setCh4Recovered(e.target.value)} />

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
                <input type="checkbox" checked={biogasFlared} onChange={(e) => setBiogasFlared(e.target.checked)} style={{ width: "auto" }} />
                Biogás recuperado é queimado em flare (gera CO₂ biogênico)
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.25rem" }}>
                <input type="checkbox" checked={hasSequential} onChange={(e) => setHasSequential(e.target.checked)} style={{ width: "auto" }} />
                O efluente passa por um segundo tratamento (sequencial)
              </label>
              {hasSequential && (
                <StageFields
                  idPrefix="ef-seq"
                  legend="Tratamento sequencial — dados do efluente que sai do primeiro tratamento"
                  treatments={treatmentOptions}
                  stage={seq}
                  setStage={setSeq}
                  allowRemoval
                />
              )}

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1.25rem" }}>
                <input type="checkbox" checked={hasDisposal} onChange={(e) => setHasDisposal(e.target.checked)} style={{ width: "auto" }} />
                O efluente é lançado ao ambiente (disposição final)
              </label>
              {hasDisposal && (
                <StageFields
                  idPrefix="ef-dis"
                  legend="Disposição final — efluente lançado ao ambiente. A planilha não considera carga removida nem recuperação de CH₄ nesta etapa."
                  treatments={treatmentOptions}
                  stage={disp}
                  setStage={setDisp}
                  allowRemoval={false}
                />
              )}
            </>
          ) : (
            <>
              <label htmlFor="ef-co2">Emissões de CO₂ (t)</label>
              <input id="ef-co2" type="number" step="0.0001" min="0" value={co2} onChange={(e) => setCo2(e.target.value)} />
              <label htmlFor="ef-ch4">Emissões de CH₄ (t)</label>
              <input id="ef-ch4" type="number" step="0.0001" min="0" value={ch4} onChange={(e) => setCh4(e.target.value)} />
              <label htmlFor="ef-n2o">Emissões de N₂O (t)</label>
              <input id="ef-n2o" type="number" step="0.0001" min="0" value={n2o} onChange={(e) => setN2o(e.target.value)} />
              <label htmlFor="ef-bio">CO₂ biogênico (t, opcional)</label>
              <input id="ef-bio" type="number" step="0.0001" min="0" value={bioCo2} onChange={(e) => setBioCo2(e.target.value)} />
            </>
          )}

          <PeriodField idPrefix="ef" value={periodMonth} onChange={setPeriodMonth} />

          {preview?.ok && (
            <p className="auth-success">
              Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e
              {preview.computed.biogenic_co2_t > 0 ? ` (CO₂ biogênico: ${fmt(preview.computed.biogenic_co2_t, 4)} t)` : ""}
            </p>
          )}
          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Lançando..." : "Lançar fonte"}
          </button>
        </form>
      )}

      <EntryTable
        entries={entries}
        reload={reload}
        readOnly={readOnly}
        columns={[
          {
            header: "Tratamento",
            render: (e) =>
              e.activity_data.method === "direct"
                ? "Relato direto"
                : String(e.activity_data.treatment_type ?? "—"),
          },
          {
            header: "CH₄ (t)",
            render: (e) => fmt(Number(e.computed?.ch4_t ?? 0), 4),
          },
          {
            header: "N₂O (t)",
            render: (e) => fmt(Number(e.computed?.n2o_t ?? 0), 4),
          },
        ]}
      />
    </section>
  );
}

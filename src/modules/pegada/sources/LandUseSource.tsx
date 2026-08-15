import { useState, type FormEvent } from "react";
import { GAS_LABELS } from "../engine/gwp";
import { calculate } from "../engine/registry";
import { LAND_USE_CATEGORIES, type LandUseMethod } from "../engine/types";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, PeriodField, type SourceProps } from "./common";

const METHOD_LABELS: Record<LandUseMethod, string> = {
  direct: "Relato direto de CO₂/CH₄/N₂O",
  detailed: "Cálculo detalhado (diferença de estoque de carbono)",
};

export function LandUseSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const gasOptions = [...ctx.gwp.keys()].sort((a, b) => {
    const order = ["CO2", "CH4", "N2O", "SF6", "NF3"];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });

  const [method, setMethod] = useState<LandUseMethod>("detailed");
  // direct
  const [gas, setGas] = useState("CO2");
  const [emittedT, setEmittedT] = useState("");
  const [biogenicEm, setBiogenicEm] = useState("");
  const [biogenicRem, setBiogenicRem] = useState("");
  // detailed
  const [uf, setUf] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [previousUse, setPreviousUse] = useState("");
  const [nextUse, setNextUse] = useState("");
  const [perennialWoody, setPerennialWoody] = useState(false);

  const [sourceRef, setSourceRef] = useState("");
  const [desc, setDesc] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function buildData() {
    if (method === "detailed") {
      return {
        source_category: "land_use" as const,
        method: "detailed" as const,
        uf: uf || undefined,
        area_ha: areaHa ? Number(areaHa) : undefined,
        previous_use: previousUse || undefined,
        next_use: nextUse || undefined,
        perennial_woody_biomass: nextUse === "Cultura perene" ? perennialWoody : undefined,
      };
    }
    return {
      source_category: "land_use" as const,
      method: "direct" as const,
      gas,
      emitted_t: Number(emittedT),
      biogenic_co2_emissions_t: biogenicEm ? Number(biogenicEm) : undefined,
      biogenic_co2_removals_t: biogenicRem ? Number(biogenicRem) : undefined,
    };
  }

  const canPreview =
    method === "detailed"
      ? Boolean(uf && areaHa && previousUse && nextUse && Number(areaHa) > 0)
      : Number(emittedT) > 0 || Number(biogenicEm) > 0;
  const preview = canPreview ? calculate(buildData(), ctx) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canPreview) {
      setError(
        method === "detailed"
          ? "Selecione o estado, a área e os usos do solo anterior/posterior."
          : "Informe a massa emitida do gás (em toneladas).",
      );
      return;
    }
    const data = buildData();
    const result = calculate(data, ctx);
    if (!result.ok) {
      setError(`Erro no cálculo: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(inventoryId, data, result.computed, {
      sourceRef,
      description: desc,
      periodMonth: periodMonth ? Number(periodMonth) : null,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setEmittedT("");
      setBiogenicEm("");
      setBiogenicRem("");
      setAreaHa("");
      setPreviousUse("");
      setNextUse("");
      setPerennialWoody(false);
      setSourceRef("");
      setDesc("");
      setPeriodMonth("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Mudança no uso do solo</h2>
      <p>
        Emissões e remoções de CO₂ por conversão de uso do solo (Escopo 1) — supressão de vegetação emite,
        reflorestamento remove. O CO₂ é sempre biogênico, reportado à parte do total de escopo.
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="lu-ref">Registro da fonte</label>
          <input id="lu-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="ex.: Talhão 12" />

          <label htmlFor="lu-desc">Descrição da atividade</label>
          <input id="lu-desc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} />

          <label htmlFor="lu-method">Método de cálculo</label>
          <select id="lu-method" value={method} onChange={(e) => setMethod(e.target.value as LandUseMethod)}>
            {(Object.keys(METHOD_LABELS) as LandUseMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>

          {method === "detailed" ? (
            <>
              <label htmlFor="lu-uf">Estado onde ocorreu a mudança</label>
              <select id="lu-uf" value={uf} onChange={(e) => setUf(e.target.value)}>
                <option value="">Selecione...</option>
                {ctx.lulucfStateOptions.map((s) => (
                  <option key={s.uf} value={s.uf}>
                    {s.name}
                  </option>
                ))}
              </select>

              <label htmlFor="lu-area">Área da mudança (ha)</label>
              <input id="lu-area" type="number" step="0.01" min="0" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />

              <label htmlFor="lu-prev">Uso anterior do solo</label>
              <select id="lu-prev" value={previousUse} onChange={(e) => setPreviousUse(e.target.value)}>
                <option value="">Selecione...</option>
                {LAND_USE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label htmlFor="lu-next">Uso posterior do solo</label>
              <select id="lu-next" value={nextUse} onChange={(e) => setNextUse(e.target.value)}>
                <option value="">Selecione...</option>
                {LAND_USE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {(nextUse === "Cultura perene" || nextUse.startsWith("Vegetação natural") || nextUse === "Silvicultura") && (
                <p style={{ fontSize: "0.8125rem", color: "var(--sc-muted)", marginTop: 0 }}>
                  {nextUse === "Cultura perene"
                    ? "Marque abaixo se a cultura perene é de biomassa lenhosa — nesse caso a remoção de carbono da biomassa é amortizada em 20 anos, como vegetação natural/silvicultura."
                    : "Uso de crescimento lento: a remoção de carbono da biomassa (se houver) é amortizada em 20 anos, reportando 1/20 por ano."}
                </p>
              )}

              {nextUse === "Cultura perene" && (
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <input type="checkbox" checked={perennialWoody} onChange={(e) => setPerennialWoody(e.target.checked)} style={{ width: "auto" }} />
                  Cultura perene de biomassa lenhosa (amortiza em 20 anos)
                </label>
              )}
            </>
          ) : (
            <>
              <label htmlFor="lu-gas">Gás de Efeito Estufa</label>
              <select id="lu-gas" value={gas} onChange={(e) => setGas(e.target.value)}>
                {gasOptions.map((g) => (
                  <option key={g} value={g}>
                    {GAS_LABELS[g] ?? g} — GWP {fmt(ctx.gwp.get(g) ?? 0, 0)}
                  </option>
                ))}
              </select>

              <label htmlFor="lu-emitted">Massa emitida (t {gas})</label>
              <input id="lu-emitted" type="number" step="0.0001" min="0" value={emittedT} onChange={(e) => setEmittedT(e.target.value)} />

              <label htmlFor="lu-bio-em">CO₂ biogênico emitido (t, opcional)</label>
              <input id="lu-bio-em" type="number" step="0.0001" min="0" value={biogenicEm} onChange={(e) => setBiogenicEm(e.target.value)} />

              <label htmlFor="lu-bio-rem">CO₂ biogênico removido/absorvido (t, opcional)</label>
              <input id="lu-bio-rem" type="number" step="0.0001" min="0" value={biogenicRem} onChange={(e) => setBiogenicRem(e.target.value)} />
            </>
          )}

          <PeriodField idPrefix="lu" value={periodMonth} onChange={setPeriodMonth} />

          {preview?.ok && (
            <p className="auth-success">
              Prévia — CO₂ biogênico: +{fmt(preview.computed.biogenic_co2_t, 4)} t emitido / -
              {fmt(preview.computed.biogenic_co2_removals_t ?? 0, 4)} t removido (não entra no total de escopo)
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
            header: "Método",
            render: (e) => (e.activity_data.method === "detailed" ? "Estoque de carbono" : "Relato direto"),
          },
          {
            header: "Detalhe",
            render: (e) =>
              e.activity_data.method === "detailed"
                ? `${e.activity_data.uf} — ${e.activity_data.previous_use} → ${e.activity_data.next_use} (${fmt(Number(e.activity_data.area_ha), 1)} ha)`
                : `${GAS_LABELS[String(e.activity_data.gas)] ?? e.activity_data.gas}: ${fmt(Number(e.activity_data.emitted_t), 4)} t`,
          },
        ]}
      />
    </section>
  );
}

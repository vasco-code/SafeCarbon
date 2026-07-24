import { useState, type FormEvent } from "react";
import { GAS_LABELS } from "../engine/gwp";
import { calculate } from "../engine/registry";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

// Componente compartilhado por Processos industriais e Agricultura — mesma
// planilha, mesma matemática (massa do gás relatada direto × GWP), só muda
// rótulo/categoria. Ver calcDirectGasEmission no registry.
export function DirectGasEmissionSource({
  category,
  title,
  description,
  sourceRefLabel,
  sourceRefPlaceholder,
  descriptionFieldLabel,
  inventoryId,
  ctx,
  entries,
  reload,
  readOnly,
}: SourceProps & {
  category: "industrial_processes" | "agriculture";
  title: string;
  description: string;
  sourceRefLabel: string;
  sourceRefPlaceholder: string;
  descriptionFieldLabel: string;
}) {
  const gasOptions = [...ctx.gwp.keys()].sort((a, b) => {
    // Gases mais comuns primeiro, depois o resto em ordem alfabética.
    const order = ["CO2", "CH4", "N2O", "SF6", "NF3"];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });

  const [gas, setGas] = useState("CO2");
  const [emittedT, setEmittedT] = useState("");
  const [biogenicEm, setBiogenicEm] = useState("");
  const [biogenicRem, setBiogenicRem] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function buildData() {
    return {
      source_category: category,
      gas,
      emitted_t: Number(emittedT),
      biogenic_co2_emissions_t: biogenicEm ? Number(biogenicEm) : undefined,
      biogenic_co2_removals_t: biogenicRem ? Number(biogenicRem) : undefined,
    } as const;
  }

  const preview = Number(emittedT) > 0 || Number(biogenicEm) > 0 ? calculate(buildData(), ctx) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!(Number(emittedT) >= 0) || emittedT === "") {
      setError("Informe a massa emitida do gás (em toneladas).");
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
    });
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setEmittedT("");
      setBiogenicEm("");
      setBiogenicRem("");
      setSourceRef("");
      setDesc("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="dg-ref">{sourceRefLabel}</label>
          <input id="dg-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder={sourceRefPlaceholder} />

          <label htmlFor="dg-desc">{descriptionFieldLabel}</label>
          <input id="dg-desc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} />

          <label htmlFor="dg-gas">Gás de Efeito Estufa</label>
          <select id="dg-gas" value={gas} onChange={(e) => setGas(e.target.value)}>
            {gasOptions.map((g) => (
              <option key={g} value={g}>
                {GAS_LABELS[g] ?? g} — GWP {fmt(ctx.gwp.get(g) ?? 0, 0)}
              </option>
            ))}
          </select>

          <label htmlFor="dg-emitted">Massa emitida (t {gas})</label>
          <input id="dg-emitted" type="number" step="0.0001" min="0" value={emittedT} onChange={(e) => setEmittedT(e.target.value)} />

          <label htmlFor="dg-bio-em">CO₂ biogênico emitido (t, opcional)</label>
          <input id="dg-bio-em" type="number" step="0.0001" min="0" value={biogenicEm} onChange={(e) => setBiogenicEm(e.target.value)} />

          <label htmlFor="dg-bio-rem">CO₂ biogênico removido/absorvido (t, opcional)</label>
          <input id="dg-bio-rem" type="number" step="0.0001" min="0" value={biogenicRem} onChange={(e) => setBiogenicRem(e.target.value)} />

          {preview?.ok && (
            <p className="auth-success">
              Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e
              {(preview.computed.biogenic_co2_t > 0 || (preview.computed.biogenic_co2_removals_t ?? 0) > 0)
                ? ` (biogênico: +${fmt(preview.computed.biogenic_co2_t, 4)} / -${fmt(preview.computed.biogenic_co2_removals_t ?? 0, 4)} t)`
                : ""}
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
          { header: "Gás", render: (e) => GAS_LABELS[String(e.activity_data.gas)] ?? String(e.activity_data.gas) },
          { header: "Massa (t)", render: (e) => fmt(Number(e.activity_data.emitted_t), 4) },
        ]}
      />
    </section>
  );
}

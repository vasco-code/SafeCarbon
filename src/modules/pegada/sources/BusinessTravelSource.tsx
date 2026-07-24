import { useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

export function BusinessTravelSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const options = [...ctx.generic.values()].filter((g) => g.source_category === "business_travel");
  const [factorKey, setFactorKey] = useState("");
  const [distance, setDistance] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const preview =
    factorKey && Number(distance) > 0
      ? calculate({ source_category: "business_travel", factor_key: factorKey, distance_km: Number(distance) }, ctx)
      : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!factorKey || !(Number(distance) > 0)) {
      setError("Selecione a faixa de distância e informe a distância total.");
      return;
    }
    const result = calculate({ source_category: "business_travel", factor_key: factorKey, distance_km: Number(distance) }, ctx);
    if (!result.ok) {
      setError(`Fator não encontrado: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(
      inventoryId,
      { source_category: "business_travel", factor_key: factorKey, distance_km: Number(distance) },
      result.computed,
      { sourceRef, description },
    );
    setSubmitting(false);
    if (err) setError(err);
    else {
      setDistance("");
      setSourceRef("");
      setDescription("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Viagens a negócios</h2>
      <p>Viagens aéreas — informe a distância total (passageiro.km) por faixa de distância do trecho.</p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="bt-ref">Registro da viagem</label>
          <input id="bt-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
          <label htmlFor="bt-desc">Descrição</label>
          <input id="bt-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex.: GRU-BSB ida/volta" />
          <label htmlFor="bt-factor">Faixa de distância</label>
          <select id="bt-factor" value={factorKey} onChange={(e) => setFactorKey(e.target.value)}>
            <option value="">Selecione...</option>
            {options.map((o) => (
              <option key={o.factor_key} value={o.factor_key}>
                {o.description}
              </option>
            ))}
          </select>
          <label htmlFor="bt-dist">Distância total (passageiro.km)</label>
          <input id="bt-dist" type="number" step="0.1" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} />
          {preview?.ok && <p className="auth-success">Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e</p>}
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Lançando..." : "Lançar viagem"}
          </button>
        </form>
      )}

      <EntryTable
        entries={entries}
        reload={reload}
        readOnly={readOnly}
        columns={[
          {
            header: "Faixa",
            render: (e) => ctx.generic.get(`business_travel:${e.activity_data.factor_key}`)?.description ?? "—",
          },
          { header: "p.km", render: (e) => fmt(Number(e.activity_data.distance_km), 1) },
        ]}
      />
    </section>
  );
}

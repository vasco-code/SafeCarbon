import { useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

export function CommutingSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const options = [...ctx.generic.values()].filter((g) => g.source_category === "commuting");
  const [factorKey, setFactorKey] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [distance, setDistance] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const preview =
    factorKey && Number(distance) > 0 && Number(passengers) > 0
      ? calculate(
          { source_category: "commuting", factor_key: factorKey, passengers: Number(passengers), distance_km: Number(distance) },
          ctx,
        )
      : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!factorKey || !(Number(distance) > 0) || !(Number(passengers) > 0)) {
      setError("Selecione o modal, os passageiros e a distância.");
      return;
    }
    const result = calculate(
      { source_category: "commuting", factor_key: factorKey, passengers: Number(passengers), distance_km: Number(distance) },
      ctx,
    );
    if (!result.ok) {
      setError(`Fator não encontrado: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(
      inventoryId,
      { source_category: "commuting", factor_key: factorKey, passengers: Number(passengers), distance_km: Number(distance) },
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
      <h2>Emissões casa-trabalho</h2>
      <p>Deslocamento de colaboradores por modal de transporte (fator por passageiro.km).</p>
      {options.length === 0 && (
        <div className="empty-state">
          <p>Nenhum modal de transporte cadastrado ainda para casa-trabalho.</p>
        </div>
      )}

      {!readOnly && options.length > 0 && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="cm-ref">Registro do colaborador/percurso</label>
          <input id="cm-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
          <label htmlFor="cm-desc">Descrição</label>
          <input id="cm-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label htmlFor="cm-factor">Modal de transporte</label>
          <select id="cm-factor" value={factorKey} onChange={(e) => setFactorKey(e.target.value)}>
            <option value="">Selecione...</option>
            {options.map((o) => (
              <option key={o.factor_key} value={o.factor_key}>
                {o.description}
              </option>
            ))}
          </select>
          <label htmlFor="cm-pax">Número de passageiros</label>
          <input id="cm-pax" type="number" step="1" min="1" value={passengers} onChange={(e) => setPassengers(e.target.value)} />
          <label htmlFor="cm-dist">Distância percorrida (km)</label>
          <input id="cm-dist" type="number" step="0.1" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} />
          {preview?.ok && <p className="auth-success">Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e</p>}
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Lançando..." : "Lançar percurso"}
          </button>
        </form>
      )}

      <EntryTable
        entries={entries}
        reload={reload}
        readOnly={readOnly}
        columns={[
          { header: "Modal", render: (e) => ctx.generic.get(`commuting:${e.activity_data.factor_key}`)?.description ?? "—" },
          { header: "Passageiros", render: (e) => String(e.activity_data.passengers) },
          { header: "km", render: (e) => fmt(Number(e.activity_data.distance_km), 1) },
        ]}
      />
    </section>
  );
}

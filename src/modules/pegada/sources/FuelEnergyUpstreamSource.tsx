import { useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

// Escopo 3 Categoria 3 — WTT (well-to-tank/cradle-to-gate) do combustível já
// lançado em Combustão estacionária/móvel: a mesma quantidade em GJ, um fator
// diferente (extração+produção+transporte do combustível, não a queima dele).
export function FuelEnergyUpstreamSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const fuels = [...ctx.wttFuels.values()].sort((a, b) => a.name_pt.localeCompare(b.name_pt));
  const [fuelKey, setFuelKey] = useState("");
  const [gj, setGj] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const preview =
    fuelKey && Number(gj) > 0
      ? calculate({ source_category: "fuel_energy_upstream", fuel_key: fuelKey, consumption_gj: Number(gj) }, ctx)
      : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!fuelKey || !(Number(gj) > 0)) {
      setError("Selecione o combustível e informe o consumo em GJ.");
      return;
    }
    const result = calculate({ source_category: "fuel_energy_upstream", fuel_key: fuelKey, consumption_gj: Number(gj) }, ctx);
    if (!result.ok) {
      setError(`Fator não encontrado: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(
      inventoryId,
      { source_category: "fuel_energy_upstream", fuel_key: fuelKey, consumption_gj: Number(gj) },
      result.computed,
      { sourceRef, description },
    );
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setGj("");
      setSourceRef("");
      setDescription("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Atividades relacionadas a combustível e energia</h2>
      <p>
        Emissões upstream (extração, produção e transporte) do combustível já lançado em Combustão estacionária/móvel
        — use o mesmo consumo, convertido para GJ com base no PCI.
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="fu-ref">Registro</label>
          <input id="fu-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />

          <label htmlFor="fu-desc">Descrição</label>
          <input id="fu-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />

          <label htmlFor="fu-fuel">Combustível</label>
          <select id="fu-fuel" value={fuelKey} onChange={(e) => setFuelKey(e.target.value)}>
            <option value="">Selecione...</option>
            {fuels.map((f) => (
              <option key={f.name_pt} value={f.name_pt}>
                {f.name_pt}
              </option>
            ))}
          </select>

          <label htmlFor="fu-gj">Consumo (GJ, base PCI)</label>
          <input id="fu-gj" type="number" step="0.001" min="0" value={gj} onChange={(e) => setGj(e.target.value)} />

          {preview?.ok && <p className="auth-success">Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e</p>}
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
          { header: "Combustível", render: (e) => String(e.activity_data.fuel_key) },
          { header: "Consumo (GJ)", render: (e) => fmt(Number(e.activity_data.consumption_gj), 2) },
        ]}
      />
    </section>
  );
}

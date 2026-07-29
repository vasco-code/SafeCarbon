import { useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

export function ThermalEnergyPurchasedSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const fuels = [...ctx.fuels.values()]
    .filter((f) => f.co2_kg_tj != null)
    .sort((a, b) => a.name_pt.localeCompare(b.name_pt));
  const [fuelRef, setFuelRef] = useState<number | "">("");
  const [steamGj, setSteamGj] = useState("");
  const [efficiency, setEfficiency] = useState("80");
  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function buildData() {
    return {
      source_category: "thermal_energy_purchased" as const,
      fuel_ref_no: Number(fuelRef),
      steam_gj: Number(steamGj),
      boiler_efficiency: Number(efficiency) / 100,
    };
  }

  const preview = fuelRef !== "" && Number(steamGj) > 0 ? calculate(buildData(), ctx) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (fuelRef === "" || !(Number(steamGj) > 0)) {
      setError("Selecione o combustível e informe o vapor comprado.");
      return;
    }
    const result = calculate(buildData(), ctx);
    if (!result.ok) {
      setError(`Fator não encontrado: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(inventoryId, buildData(), result.computed, { sourceRef, description });
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setSteamGj("");
      setSourceRef("");
      setDescription("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Compra de energia térmica</h2>
      <p>
        Vapor comprado de terceiros. O consumo de combustível é estimado a partir do vapor comprado e da
        eficiência do fervedor (80% se não souber o valor real).
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="tep-ref">Registro da fonte</label>
          <input id="tep-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="ex.: Sala de Vapor" />

          <label htmlFor="tep-desc">Descrição</label>
          <input id="tep-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />

          <label htmlFor="tep-fuel">Combustível utilizado pelo fornecedor</label>
          <select id="tep-fuel" value={fuelRef} onChange={(e) => setFuelRef(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Selecione...</option>
            {fuels.map((f) => (
              <option key={f.ref_no} value={f.ref_no}>
                {f.name_pt}
              </option>
            ))}
          </select>

          <label htmlFor="tep-eff">Eficiência do fervedor (%)</label>
          <input id="tep-eff" type="number" step="1" min="1" max="100" value={efficiency} onChange={(e) => setEfficiency(e.target.value)} />

          <label htmlFor="tep-steam">Vapor comprado (GJ)</label>
          <input id="tep-steam" type="number" step="0.001" min="0" value={steamGj} onChange={(e) => setSteamGj(e.target.value)} />

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
          {
            header: "Combustível",
            render: (e) => {
              const ref = e.activity_data.fuel_ref_no as number;
              return ctx.fuels.get(ref)?.name_pt ?? String(ref);
            },
          },
          { header: "Vapor (GJ)", render: (e) => fmt(Number(e.activity_data.steam_gj), 2) },
        ]}
      />
    </section>
  );
}

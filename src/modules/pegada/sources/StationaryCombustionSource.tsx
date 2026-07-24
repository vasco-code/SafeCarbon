import { useState, type FormEvent } from "react";
import { SECTOR_LABELS, type ActivitySector } from "../engine/types";
import { calculate } from "../engine/registry";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

export function StationaryCombustionSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const fuels = [...ctx.fuels.values()].sort((a, b) => a.name_pt.localeCompare(b.name_pt));
  const [fuelRef, setFuelRef] = useState<number | "">("");
  const [sector, setSector] = useState<ActivitySector>("energy");
  const [quantity, setQuantity] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedFuel = fuelRef === "" ? null : ctx.fuels.get(Number(fuelRef));

  const preview =
    fuelRef !== "" && Number(quantity) > 0
      ? calculate(
          { source_category: "stationary_combustion", fuel_ref_no: Number(fuelRef), quantity: Number(quantity), sector },
          ctx,
        )
      : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (fuelRef === "" || !(Number(quantity) > 0)) {
      setError("Selecione o combustível e informe a quantidade.");
      return;
    }
    const result = calculate(
      { source_category: "stationary_combustion", fuel_ref_no: Number(fuelRef), quantity: Number(quantity), sector },
      ctx,
    );
    if (!result.ok) {
      setError(`Fator não encontrado: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(
      inventoryId,
      { source_category: "stationary_combustion", fuel_ref_no: Number(fuelRef), quantity: Number(quantity), sector },
      result.computed,
      { sourceRef, description },
    );
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setQuantity("");
      setSourceRef("");
      setDescription("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Combustão estacionária</h2>
      <p>Caldeiras, fornos, geradores — combustível queimado em fontes fixas.</p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="sc-ref">Registro da fonte</label>
          <input id="sc-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="ex.: CALD-01" />

          <label htmlFor="sc-desc">Descrição</label>
          <input id="sc-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />

          <label htmlFor="sc-fuel">Combustível</label>
          <select id="sc-fuel" value={fuelRef} onChange={(e) => setFuelRef(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Selecione...</option>
            {fuels.map((f) => (
              <option key={f.ref_no} value={f.ref_no}>
                {f.name_pt} ({f.unit}){f.is_biofuel ? " — biocombustível" : ""}
              </option>
            ))}
          </select>

          <label htmlFor="sc-sector">Setor de atividade</label>
          <select id="sc-sector" value={sector} onChange={(e) => setSector(e.target.value as ActivitySector)}>
            {Object.entries(SECTOR_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          <label htmlFor="sc-qty">Quantidade consumida{selectedFuel ? ` (${selectedFuel.unit})` : ""}</label>
          <input id="sc-qty" type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />

          {preview?.ok && (
            <p className="auth-success">
              Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e
              {preview.computed.biogenic_co2_t > 0 ? ` (+ ${fmt(preview.computed.biogenic_co2_t, 4)} t CO₂ biogênico)` : ""}
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
            header: "Combustível",
            render: (e) => {
              const ref = e.activity_data.fuel_ref_no as number;
              return ctx.fuels.get(ref)?.name_pt ?? String(ref);
            },
          },
          { header: "Quantidade", render: (e) => fmt(Number(e.activity_data.quantity), 2) },
        ]}
      />
    </section>
  );
}

import { useState, type FormEvent } from "react";
import { SECTOR_LABELS, type ActivitySector } from "../engine/types";
import { calculate } from "../engine/registry";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, PeriodField, type SourceProps } from "./common";

export function MobileCombustionSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const fuels = [...ctx.fuels.values()].sort((a, b) => a.name_pt.localeCompare(b.name_pt));
  const [fuelRef, setFuelRef] = useState<number | "">("");
  const [sector, setSector] = useState<ActivitySector>("energy");
  const [fleetType, setFleetType] = useState("");
  const [fleetYear, setFleetYear] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedFuel = fuelRef === "" ? null : ctx.fuels.get(Number(fuelRef));

  function buildData() {
    return {
      source_category: "mobile_combustion",
      fuel_ref_no: Number(fuelRef),
      quantity: Number(quantity),
      sector,
      ...(fleetType ? { fleet_type: fleetType } : {}),
      ...(fleetType && fleetYear ? { fleet_year: Number(fleetYear) } : {}),
    } as const;
  }

  const preview = fuelRef !== "" && Number(quantity) > 0 ? calculate(buildData(), ctx) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (fuelRef === "" || !(Number(quantity) > 0)) {
      setError("Selecione o combustível e informe a quantidade.");
      return;
    }
    const result = calculate(buildData(), ctx);
    if (!result.ok) {
      setError(`Fator não encontrado: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(inventoryId, buildData(), result.computed, {
      sourceRef,
      description,
      periodMonth: periodMonth ? Number(periodMonth) : null,
    });
    setSubmitting(false);
    if (err) setError(err);
    else {
      setQuantity("");
      setSourceRef("");
      setDescription("");
      setPeriodMonth("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Combustão móvel</h2>
      <p>
        Frota própria — combustível queimado em veículos e máquinas. Informe o tipo de frota para usar
        os fatores de CH₄/N₂O por tecnologia e ano do veículo (mais preciso); sem isso, o cálculo usa o
        fator por setor de atividade. O CO₂ vem sempre do combustível.
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="mc-ref">Registro da frota</label>
          <input id="mc-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="ex.: FROTA-SP" />
          <label htmlFor="mc-desc">Descrição</label>
          <input id="mc-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label htmlFor="mc-fuel">Combustível</label>
          <select id="mc-fuel" value={fuelRef} onChange={(e) => setFuelRef(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Selecione...</option>
            {fuels.map((f) => (
              <option key={f.ref_no} value={f.ref_no}>
                {f.name_pt} ({f.unit}){f.is_biofuel ? " — biocombustível" : ""}
              </option>
            ))}
          </select>
          <label htmlFor="mc-fleet">Tipo da frota de veículos (opcional)</label>
          <select id="mc-fleet" value={fleetType} onChange={(e) => setFleetType(e.target.value)}>
            <option value="">Não informar — usar fator por setor</option>
            {ctx.fleetTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {fleetType ? (
            <>
              <label htmlFor="mc-fleet-year">Ano da frota (opcional)</label>
              <input
                id="mc-fleet-year"
                type="number"
                step="1"
                min="1980"
                max="2100"
                value={fleetYear}
                onChange={(e) => setFleetYear(e.target.value)}
                placeholder="ex.: 2014 — em branco usa o fator geral"
              />
            </>
          ) : (
            <>
              <label htmlFor="mc-sector">Setor de atividade</label>
              <select id="mc-sector" value={sector} onChange={(e) => setSector(e.target.value as ActivitySector)}>
                {Object.entries(SECTOR_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="mc-qty">Quantidade consumida{selectedFuel ? ` (${selectedFuel.unit})` : ""}</label>
          <input id="mc-qty" type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />

          <PeriodField idPrefix="mc" value={periodMonth} onChange={setPeriodMonth} />
          {preview?.ok && (
            <p className="auth-success">
              Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e
              {preview.computed.biogenic_co2_t > 0 ? ` (+ ${fmt(preview.computed.biogenic_co2_t, 4)} t CO₂ biogênico)` : ""}
            </p>
          )}
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Lançando..." : "Lançar frota"}
          </button>
        </form>
      )}

      <EntryTable
        entries={entries}
        reload={reload}
        readOnly={readOnly}
        columns={[
          { header: "Combustível", render: (e) => ctx.fuels.get(e.activity_data.fuel_ref_no as number)?.name_pt ?? "—" },
          {
            header: "Frota",
            render: (e) => {
              const t = e.activity_data.fleet_type;
              if (!t) return "— (por setor)";
              const y = e.activity_data.fleet_year;
              return y ? `${String(t)} (${String(y)})` : String(t);
            },
          },
          { header: "Quantidade", render: (e) => fmt(Number(e.activity_data.quantity), 2) },
        ]}
      />
    </section>
  );
}

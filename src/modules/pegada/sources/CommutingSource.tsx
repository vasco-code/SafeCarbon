import { useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, PeriodField, type SourceProps } from "./common";

const METHOD_LABELS: Record<"generic" | "private_vehicle", string> = {
  generic: "Transporte coletivo (metrô/trem, ônibus, balsa)",
  private_vehicle: "Veículo particular do colaborador",
};

export function CommutingSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const options = [...ctx.generic.values()].filter((g) => g.source_category === "commuting");
  const fuels = [...ctx.fuels.values()].sort((a, b) => a.name_pt.localeCompare(b.name_pt));

  const [method, setMethod] = useState<"generic" | "private_vehicle">("generic");
  // generic
  const [factorKey, setFactorKey] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [distance, setDistance] = useState("");
  // private_vehicle
  const [fuelRef, setFuelRef] = useState<number | "">("");
  const [quantity, setQuantity] = useState("");
  const [fleetType, setFleetType] = useState("");
  const [fleetYear, setFleetYear] = useState("");

  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function buildData() {
    if (method === "private_vehicle") {
      return {
        source_category: "commuting" as const,
        method: "private_vehicle" as const,
        fuel_ref_no: fuelRef === "" ? undefined : Number(fuelRef),
        quantity: quantity ? Number(quantity) : undefined,
        fleet_type: fleetType || undefined,
        fleet_year: fleetYear ? Number(fleetYear) : undefined,
      };
    }
    return {
      source_category: "commuting" as const,
      method: "generic" as const,
      factor_key: factorKey,
      passengers: Number(passengers),
      distance_km: Number(distance),
    };
  }

  const canPreview =
    method === "private_vehicle"
      ? fuelRef !== "" && Number(quantity) > 0
      : Boolean(factorKey) && Number(distance) > 0 && Number(passengers) > 0;
  const preview = canPreview ? calculate(buildData(), ctx) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canPreview) {
      setError(
        method === "private_vehicle"
          ? "Selecione o combustível e informe a quantidade consumida no ano."
          : "Selecione o modal, os passageiros e a distância.",
      );
      return;
    }
    const data = buildData();
    const result = calculate(data, ctx);
    if (!result.ok) {
      setError(`Fator não encontrado: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(inventoryId, data, result.computed, {
      sourceRef,
      description,
      periodMonth: periodMonth ? Number(periodMonth) : null,
    });
    setSubmitting(false);
    if (err) setError(err);
    else {
      setDistance("");
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
      <h2>Emissões casa-trabalho</h2>
      <p>Deslocamento de colaboradores entre casa e trabalho — transporte coletivo ou veículo particular.</p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="cm-ref">Registro do colaborador/percurso</label>
          <input id="cm-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
          <label htmlFor="cm-desc">Descrição</label>
          <input id="cm-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />

          <label htmlFor="cm-method">Tipo de deslocamento</label>
          <select id="cm-method" value={method} onChange={(e) => setMethod(e.target.value as "generic" | "private_vehicle")}>
            {(Object.keys(METHOD_LABELS) as ("generic" | "private_vehicle")[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>

          {method === "generic" ? (
            options.length === 0 ? (
              <div className="empty-state">
                <p>Nenhum modal de transporte coletivo cadastrado ainda.</p>
              </div>
            ) : (
              <>
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
              </>
            )
          ) : (
            <>
              <label htmlFor="cm-fuel">Combustível</label>
              <select id="cm-fuel" value={fuelRef} onChange={(e) => setFuelRef(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">Selecione...</option>
                {fuels.map((f) => (
                  <option key={f.ref_no} value={f.ref_no}>
                    {f.name_pt} ({f.unit}){f.is_biofuel ? " — biocombustível" : ""}
                  </option>
                ))}
              </select>

              <label htmlFor="cm-fleet-type">Tipo de veículo (opcional, refina CH₄/N₂O)</label>
              <select id="cm-fleet-type" value={fleetType} onChange={(e) => setFleetType(e.target.value)}>
                <option value="">Nenhum</option>
                {ctx.fleetTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {fleetType && (
                <>
                  <label htmlFor="cm-fleet-year">Ano da frota (opcional)</label>
                  <input id="cm-fleet-year" type="number" value={fleetYear} onChange={(e) => setFleetYear(e.target.value)} />
                </>
              )}

              <label htmlFor="cm-qty">Combustível consumido no ano{fuelRef !== "" ? ` (${ctx.fuels.get(Number(fuelRef))?.unit})` : ""}</label>
              <input id="cm-qty" type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </>
          )}

          <PeriodField idPrefix="cm" value={periodMonth} onChange={setPeriodMonth} />

          {preview?.ok && (
            <p className="auth-success">
              Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e
              {preview.computed.biogenic_co2_t > 0 ? ` (+ ${fmt(preview.computed.biogenic_co2_t, 4)} t CO₂ biogênico)` : ""}
            </p>
          )}
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
          {
            header: "Modal / combustível",
            render: (e) =>
              e.activity_data.method === "private_vehicle"
                ? ctx.fuels.get(e.activity_data.fuel_ref_no as number)?.name_pt ?? "—"
                : ctx.generic.get(`commuting:${e.activity_data.factor_key}`)?.description ?? "—",
          },
          {
            header: "Quantidade",
            render: (e) =>
              e.activity_data.method === "private_vehicle"
                ? fmt(Number(e.activity_data.quantity), 2)
                : `${e.activity_data.passengers} pax × ${fmt(Number(e.activity_data.distance_km), 1)} km`,
          },
        ]}
      />
    </section>
  );
}

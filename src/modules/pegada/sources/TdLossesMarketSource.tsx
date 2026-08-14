import { useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import { GENERATION_TYPES, RENEWABLE_GENERATION_TYPES, type GenerationType } from "../engine/types";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

// Mesma derivação de fator que ElectricityMarketSource — ver ali.
export function TdLossesMarketSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const fuels = [...ctx.fuels.values()].sort((a, b) => a.name_pt.localeCompare(b.name_pt, "pt-BR"));
  const [mwh, setMwh] = useState("");
  const [hasOwnFactor, setHasOwnFactor] = useState(true);
  const [co2Factor, setCo2Factor] = useState("");
  const [generationType, setGenerationType] = useState<GenerationType>("Eólica");
  const [fuelRef, setFuelRef] = useState<number | "">("");
  const [efficiency, setEfficiency] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isThermal = generationType === "Termoelétrica";

  function buildData() {
    if (hasOwnFactor) {
      return { source_category: "td_losses_market", mwh: Number(mwh), co2_t_mwh: Number(co2Factor) } as const;
    }
    return {
      source_category: "td_losses_market",
      mwh: Number(mwh),
      generation_type: generationType,
      ...(isThermal
        ? { fuel_ref_no: fuelRef === "" ? undefined : Number(fuelRef), plant_efficiency: efficiency ? Number(efficiency) : undefined }
        : {}),
    } as const;
  }

  const canPreview =
    Number(mwh) > 0 && (hasOwnFactor ? co2Factor !== "" : !isThermal || (fuelRef !== "" && Number(efficiency) > 0));
  const preview = canPreview ? calculate(buildData(), ctx) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canPreview) {
      setError(
        hasOwnFactor
          ? "Informe a eletricidade perdida e o fator de emissão do instrumento contratual."
          : "Informe a eletricidade perdida, o tipo de geração e, se termoelétrica, o combustível e a eficiência.",
      );
      return;
    }
    const result = calculate(buildData(), ctx);
    if (!result.ok) {
      setError(`Erro no cálculo: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(inventoryId, buildData(), result.computed, { sourceRef, description });
    setSubmitting(false);
    if (err) setError(err);
    else {
      setMwh("");
      setCo2Factor("");
      setFuelRef("");
      setEfficiency("");
      setSourceRef("");
      setDescription("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Perdas T&D — abordagem por escolha de compra</h2>
      <p>
        Emissões indiretas pelas perdas de transmissão e distribuição de eletricidade com instrumento contratual
        (só para empresas transmissoras/distribuidoras). Se tiver o fator do gerador, informe-o direto; senão,
        informe o tipo de fonte de geração para o app derivar o fator.
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="tdm-ref">Registro da fonte</label>
          <input id="tdm-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
          <label htmlFor="tdm-desc">Descrição</label>
          <input id="tdm-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex.: I-REC eólica" />
          <label htmlFor="tdm-mwh">Eletricidade perdida em T&D (MWh)</label>
          <input id="tdm-mwh" type="number" step="0.001" min="0" value={mwh} onChange={(e) => setMwh(e.target.value)} />

          <label htmlFor="tdm-has-factor">Você possui o fator de emissão do gerador?</label>
          <select id="tdm-has-factor" value={hasOwnFactor ? "sim" : "nao"} onChange={(e) => setHasOwnFactor(e.target.value === "sim")}>
            <option value="sim">Sim</option>
            <option value="nao">Não — derivar pelo tipo de geração</option>
          </select>

          {hasOwnFactor ? (
            <>
              <label htmlFor="tdm-factor">Fator de emissão do instrumento (tCO₂/MWh)</label>
              <input id="tdm-factor" type="number" step="0.000001" min="0" value={co2Factor} onChange={(e) => setCo2Factor(e.target.value)} />
            </>
          ) : (
            <>
              <label htmlFor="tdm-gen">Tipo de fonte de geração</label>
              <select id="tdm-gen" value={generationType} onChange={(e) => setGenerationType(e.target.value as GenerationType)}>
                {GENERATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                    {RENEWABLE_GENERATION_TYPES.includes(t) ? " (fator zero)" : ""}
                  </option>
                ))}
              </select>

              {isThermal && (
                <>
                  <label htmlFor="tdm-fuel">Combustível</label>
                  <select id="tdm-fuel" value={fuelRef} onChange={(e) => setFuelRef(e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">Selecione...</option>
                    {fuels.map((f) => (
                      <option key={f.ref_no} value={f.ref_no}>
                        {f.name_pt} ({f.unit}){f.is_biofuel ? " — biocombustível" : ""}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="tdm-eff">Eficiência da planta geradora (0-1)</label>
                  <input id="tdm-eff" type="number" step="0.01" min="0" max="1" value={efficiency} onChange={(e) => setEfficiency(e.target.value)} placeholder="ex.: 0,32" />
                </>
              )}
            </>
          )}

          {preview?.ok && (
            <p className="auth-success">
              Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e
              {preview.computed.biogenic_co2_t > 0 ? ` (+ ${fmt(preview.computed.biogenic_co2_t, 4)} t CO₂ biogênico)` : ""}
            </p>
          )}
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Lançando..." : "Lançar perda"}
          </button>
        </form>
      )}

      <EntryTable
        entries={entries}
        reload={reload}
        readOnly={readOnly}
        columns={[
          { header: "MWh perdidos", render: (e) => fmt(Number(e.activity_data.mwh), 2) },
          {
            header: "Origem do fator",
            render: (e) =>
              e.activity_data.co2_t_mwh != null
                ? "Fornecido pelo usuário"
                : String(e.activity_data.generation_type ?? "—"),
          },
        ]}
      />
    </section>
  );
}

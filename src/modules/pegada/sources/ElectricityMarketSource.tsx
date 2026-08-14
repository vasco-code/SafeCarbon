import { useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import { GENERATION_TYPES, RENEWABLE_GENERATION_TYPES, type GenerationType } from "../engine/types";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

// Escolha de compra: o usuário informa o fator do instrumento contratual
// diretamente, OU (se não tiver) o tipo de fonte de geração — renovável entra
// com fator zero, termoelétrica deriva do combustível e da eficiência da
// planta (ver deriveMarketFactor no registry, aba "En. elétrica (escolha de
// compra)" colunas Y..AB da planilha).
export function ElectricityMarketSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
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
      return { source_category: "electricity_market", mwh: Number(mwh), co2_t_mwh: Number(co2Factor) } as const;
    }
    return {
      source_category: "electricity_market",
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
          ? "Informe a energia comprada e o fator de emissão do instrumento contratual."
          : "Informe a energia comprada, o tipo de geração e, se termoelétrica, o combustível e a eficiência.",
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
      <h2>Energia elétrica — abordagem por escolha de compra</h2>
      <p>
        Energia com instrumento contratual (I-REC, certificado, gerador específico). Se você tiver o fator de
        emissão do gerador, informe-o direto; senão, informe o tipo de fonte de geração — o app deriva o fator
        (renovável: zero; termoelétrica: pelo combustível e a eficiência da planta).
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="em-ref">Registro da fonte</label>
          <input id="em-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
          <label htmlFor="em-desc">Descrição</label>
          <input id="em-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex.: I-REC eólica" />
          <label htmlFor="em-mwh">Energia comprada (MWh)</label>
          <input id="em-mwh" type="number" step="0.001" min="0" value={mwh} onChange={(e) => setMwh(e.target.value)} />

          <label htmlFor="em-has-factor">Você possui o fator de emissão do gerador?</label>
          <select id="em-has-factor" value={hasOwnFactor ? "sim" : "nao"} onChange={(e) => setHasOwnFactor(e.target.value === "sim")}>
            <option value="sim">Sim</option>
            <option value="nao">Não — derivar pelo tipo de geração</option>
          </select>

          {hasOwnFactor ? (
            <>
              <label htmlFor="em-factor">Fator de emissão do instrumento (tCO₂/MWh)</label>
              <input id="em-factor" type="number" step="0.000001" min="0" value={co2Factor} onChange={(e) => setCo2Factor(e.target.value)} />
            </>
          ) : (
            <>
              <label htmlFor="em-gen">Tipo de fonte de geração</label>
              <select id="em-gen" value={generationType} onChange={(e) => setGenerationType(e.target.value as GenerationType)}>
                {GENERATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                    {RENEWABLE_GENERATION_TYPES.includes(t) ? " (fator zero)" : ""}
                  </option>
                ))}
              </select>

              {isThermal && (
                <>
                  <label htmlFor="em-fuel">Combustível</label>
                  <select id="em-fuel" value={fuelRef} onChange={(e) => setFuelRef(e.target.value === "" ? "" : Number(e.target.value))}>
                    <option value="">Selecione...</option>
                    {fuels.map((f) => (
                      <option key={f.ref_no} value={f.ref_no}>
                        {f.name_pt} ({f.unit}){f.is_biofuel ? " — biocombustível" : ""}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="em-eff">Eficiência da planta geradora (0-1)</label>
                  <input id="em-eff" type="number" step="0.01" min="0" max="1" value={efficiency} onChange={(e) => setEfficiency(e.target.value)} placeholder="ex.: 0,32" />
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
            {submitting ? "Lançando..." : "Lançar consumo"}
          </button>
        </form>
      )}

      <EntryTable
        entries={entries}
        reload={reload}
        readOnly={readOnly}
        columns={[
          { header: "MWh", render: (e) => fmt(Number(e.activity_data.mwh), 2) },
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

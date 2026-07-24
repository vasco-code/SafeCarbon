import { useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

export function ElectricityMarketSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const [mwh, setMwh] = useState("");
  const [co2Factor, setCo2Factor] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const preview =
    Number(mwh) > 0 && co2Factor !== ""
      ? calculate({ source_category: "electricity_market", mwh: Number(mwh), co2_t_mwh: Number(co2Factor) }, ctx)
      : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!(Number(mwh) > 0) || co2Factor === "") {
      setError("Informe a energia comprada e o fator de emissão do instrumento contratual.");
      return;
    }
    const result = calculate({ source_category: "electricity_market", mwh: Number(mwh), co2_t_mwh: Number(co2Factor) }, ctx);
    if (!result.ok) {
      setError(`Erro no cálculo: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(
      inventoryId,
      { source_category: "electricity_market", mwh: Number(mwh), co2_t_mwh: Number(co2Factor) },
      result.computed,
      { sourceRef, description },
    );
    setSubmitting(false);
    if (err) setError(err);
    else {
      setMwh("");
      setCo2Factor("");
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
        Energia com instrumento contratual (I-REC, certificado, gerador específico). Informe o fator de emissão do
        instrumento em tCO₂/MWh (0 para energia 100% renovável certificada).
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="em-ref">Registro da fonte</label>
          <input id="em-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
          <label htmlFor="em-desc">Descrição</label>
          <input id="em-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex.: I-REC eólica" />
          <label htmlFor="em-mwh">Energia comprada (MWh)</label>
          <input id="em-mwh" type="number" step="0.001" min="0" value={mwh} onChange={(e) => setMwh(e.target.value)} />
          <label htmlFor="em-factor">Fator de emissão do instrumento (tCO₂/MWh)</label>
          <input id="em-factor" type="number" step="0.000001" min="0" value={co2Factor} onChange={(e) => setCo2Factor(e.target.value)} />
          {preview?.ok && <p className="auth-success">Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e</p>}
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
          { header: "Fator (tCO₂/MWh)", render: (e) => fmt(Number(e.activity_data.co2_t_mwh), 6) },
        ]}
      />
    </section>
  );
}

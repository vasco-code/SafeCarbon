import { useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

export function TdLossesMarketSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const [mwh, setMwh] = useState("");
  const [co2Factor, setCo2Factor] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const preview =
    Number(mwh) > 0 && co2Factor !== ""
      ? calculate({ source_category: "td_losses_market", mwh: Number(mwh), co2_t_mwh: Number(co2Factor) }, ctx)
      : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!(Number(mwh) > 0) || co2Factor === "") {
      setError("Informe a eletricidade perdida e o fator de emissão do instrumento contratual.");
      return;
    }
    const result = calculate({ source_category: "td_losses_market", mwh: Number(mwh), co2_t_mwh: Number(co2Factor) }, ctx);
    if (!result.ok) {
      setError(`Erro no cálculo: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(
      inventoryId,
      { source_category: "td_losses_market", mwh: Number(mwh), co2_t_mwh: Number(co2Factor) },
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
      <h2>Perdas T&D — abordagem por escolha de compra</h2>
      <p>
        Emissões indiretas pelas perdas de transmissão e distribuição de eletricidade com instrumento contratual
        (só para empresas transmissoras/distribuidoras). Informe o fator de emissão do instrumento em tCO₂/MWh.
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="tdm-ref">Registro da fonte</label>
          <input id="tdm-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
          <label htmlFor="tdm-desc">Descrição</label>
          <input id="tdm-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex.: I-REC eólica" />
          <label htmlFor="tdm-mwh">Eletricidade perdida em T&D (MWh)</label>
          <input id="tdm-mwh" type="number" step="0.001" min="0" value={mwh} onChange={(e) => setMwh(e.target.value)} />
          <label htmlFor="tdm-factor">Fator de emissão do instrumento (tCO₂/MWh)</label>
          <input id="tdm-factor" type="number" step="0.000001" min="0" value={co2Factor} onChange={(e) => setCo2Factor(e.target.value)} />
          {preview?.ok && <p className="auth-success">Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e</p>}
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
          { header: "Fator (tCO₂/MWh)", render: (e) => fmt(Number(e.activity_data.co2_t_mwh), 6) },
        ]}
      />
    </section>
  );
}

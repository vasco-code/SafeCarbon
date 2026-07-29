import { useState, type FormEvent } from "react";
import { calculate } from "../engine/registry";
import { getGrid } from "../engine/factors";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

export function TdLossesLocationSource({
  inventoryId,
  ctx,
  entries,
  reload,
  readOnly,
  defaultYear,
}: SourceProps & { defaultYear: number }) {
  const [year, setYear] = useState(String(defaultYear));
  const [mwh, setMwh] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const grid = getGrid(ctx, Number(year));
  const preview =
    Number(mwh) > 0 ? calculate({ source_category: "td_losses_location", mwh: Number(mwh), year: Number(year) }, ctx) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!(Number(mwh) > 0)) {
      setError("Informe a eletricidade perdida (MWh).");
      return;
    }
    const result = calculate({ source_category: "td_losses_location", mwh: Number(mwh), year: Number(year) }, ctx);
    if (!result.ok) {
      setError(`Fator não encontrado: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(
      inventoryId,
      { source_category: "td_losses_location", mwh: Number(mwh), year: Number(year) },
      result.computed,
      { sourceRef, description },
    );
    setSubmitting(false);
    if (err) setError(err);
    else {
      setMwh("");
      setSourceRef("");
      setDescription("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Perdas T&D — abordagem por localização</h2>
      <p>
        Emissões indiretas pelas perdas de transmissão e distribuição da eletricidade comprada da rede
        (só para empresas transmissoras/distribuidoras), com o fator médio do SIN do ano.
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="tdl-ref">Registro da fonte</label>
          <input id="tdl-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="ex.: Linha Matriz" />
          <label htmlFor="tdl-desc">Descrição</label>
          <input id="tdl-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label htmlFor="tdl-year">Ano (fator do SIN)</label>
          <input id="tdl-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          {!grid && <p className="auth-error">Sem fator do SIN cadastrado para {year}.</p>}
          {grid && (
            <p style={{ fontSize: "0.8125rem", color: "var(--sc-muted)" }}>
              Fator do SIN {year}: {fmt(grid.co2_t_mwh, 5)} tCO₂/MWh
            </p>
          )}
          <label htmlFor="tdl-mwh">Eletricidade perdida em T&D (MWh)</label>
          <input id="tdl-mwh" type="number" step="0.001" min="0" value={mwh} onChange={(e) => setMwh(e.target.value)} />
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
          { header: "Ano", render: (e) => String(e.activity_data.year) },
          { header: "MWh perdidos", render: (e) => fmt(Number(e.activity_data.mwh), 2) },
        ]}
      />
    </section>
  );
}

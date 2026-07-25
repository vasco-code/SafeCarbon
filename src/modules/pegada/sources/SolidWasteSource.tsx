import { useState, type FormEvent } from "react";
import { LANDFILL_QUALITIES } from "../engine/factors";
import { calculate } from "../engine/registry";
import type { SolidWasteMethod } from "../engine/types";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

// Resíduos sólidos (Escopo 1): aterro (modelo FOD, com série histórica de
// deposição), compostagem, incineração e relato direto. Ver calcSolidWaste.

const METHOD_LABELS: Record<SolidWasteMethod, string> = {
  landfill: "Aterro (modelo FOD)",
  composting: "Compostagem",
  incineration: "Incineração",
  direct: "Relato direto de CO₂/CH₄/N₂O",
};

export function SolidWasteSource({
  inventoryId,
  ctx,
  entries,
  reload,
  readOnly,
  inventoryYear,
}: SourceProps & { inventoryYear: number }) {
  // Categorias A-K (a última, "Outros", recebe a fração restante no cálculo).
  const namedCategories = ctx.incineration.slice(0, Math.max(0, ctx.incineration.length - 1));

  const [method, setMethod] = useState<SolidWasteMethod>("landfill");
  // aterro (FOD)
  const [landfillComp, setLandfillComp] = useState<Record<string, string>>({});
  const [landfillYears, setLandfillYears] = useState<
    { year: string; waste_t: string; quality: string; ch4_recovered_t: string }[]
  >([{ year: String(inventoryYear), waste_t: "", quality: "A", ch4_recovered_t: "" }]);
  // compostagem
  const [massT, setMassT] = useState("");
  const [efCh4Kg, setEfCh4Kg] = useState("");
  const [efN2oKg, setEfN2oKg] = useState("");
  const [ch4Recovered, setCh4Recovered] = useState("");
  const [biogasFlared, setBiogasFlared] = useState(false);
  // incineração
  const [incineratedT, setIncineratedT] = useState("");
  const [composition, setComposition] = useState<Record<string, string>>({});
  const [efCh4T, setEfCh4T] = useState("");
  const [efN2oT, setEfN2oT] = useState("");
  // direto
  const [co2, setCo2] = useState("");
  const [ch4, setCh4] = useState("");
  const [n2o, setN2o] = useState("");
  const [bioCo2, setBioCo2] = useState("");

  const [sourceRef, setSourceRef] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const compositionSum = namedCategories.reduce((s, f) => s + (Number(composition[f.category]) || 0), 0);

  function buildData() {
    if (method === "landfill") {
      const comp: Record<string, number> = {};
      for (const f of ctx.landfill) {
        const v = Number(landfillComp[f.category]);
        if (v > 0) comp[f.category] = v;
      }
      return {
        source_category: "solid_waste",
        method: "landfill",
        inventory_year: inventoryYear,
        landfill_composition: comp,
        years: landfillYears
          .filter((y) => y.year !== "" && Number(y.waste_t) >= 0)
          .map((y) => ({
            year: Number(y.year),
            waste_t: Number(y.waste_t) || 0,
            quality: y.quality,
            ch4_recovered_t: y.ch4_recovered_t ? Number(y.ch4_recovered_t) : undefined,
          })),
        biogas_flared: biogasFlared,
      } as const;
    }
    if (method === "composting") {
      return {
        source_category: "solid_waste",
        method: "composting",
        mass_t: massT ? Number(massT) : undefined,
        ef_ch4_g_kg: efCh4Kg ? Number(efCh4Kg) : undefined,
        ef_n2o_g_kg: efN2oKg ? Number(efN2oKg) : undefined,
        ch4_recovered_t: ch4Recovered ? Number(ch4Recovered) : undefined,
        biogas_flared: biogasFlared,
      } as const;
    }
    if (method === "incineration") {
      const comp: Record<string, number> = {};
      for (const f of namedCategories) {
        const v = Number(composition[f.category]);
        if (v > 0) comp[f.category] = v;
      }
      return {
        source_category: "solid_waste",
        method: "incineration",
        incinerated_t: incineratedT ? Number(incineratedT) : undefined,
        composition: comp,
        ef_ch4_g_t: efCh4T ? Number(efCh4T) : undefined,
        ef_n2o_g_t: efN2oT ? Number(efN2oT) : undefined,
      } as const;
    }
    return {
      source_category: "solid_waste",
      method: "direct",
      co2_t: co2 ? Number(co2) : undefined,
      ch4_t: ch4 ? Number(ch4) : undefined,
      n2o_t: n2o ? Number(n2o) : undefined,
      biogenic_co2_t: bioCo2 ? Number(bioCo2) : undefined,
    } as const;
  }

  const landfillCompSum = ctx.landfill.reduce((s, f) => s + (Number(landfillComp[f.category]) || 0), 0);
  const canPreview =
    method === "landfill"
      ? landfillYears.some((y) => Number(y.waste_t) > 0) && landfillCompSum > 0
      : method === "composting"
        ? Number(massT) > 0
        : method === "incineration"
          ? Number(incineratedT) > 0
          : Boolean(co2 || ch4 || n2o);
  const preview = canPreview ? calculate(buildData(), ctx) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canPreview) {
      setError("Preencha os dados necessários para o cálculo.");
      return;
    }
    const result = calculate(buildData(), ctx);
    if (!result.ok) {
      setError(`Erro no cálculo: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(inventoryId, buildData(), result.computed, { sourceRef, description: desc });
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setLandfillComp({});
      setLandfillYears([{ year: String(inventoryYear), waste_t: "", quality: "A", ch4_recovered_t: "" }]);
      setMassT("");
      setEfCh4Kg("");
      setEfN2oKg("");
      setCh4Recovered("");
      setBiogasFlared(false);
      setIncineratedT("");
      setComposition({});
      setEfCh4T("");
      setEfN2oT("");
      setCo2("");
      setCh4("");
      setN2o("");
      setBioCo2("");
      setSourceRef("");
      setDesc("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Resíduos sólidos</h2>
      <p>
        Emissões do tratamento de resíduos sólidos (Escopo 1): aterro, compostagem, incineração e
        relato direto. O aterro usa o modelo FOD do IPCC — o CH₄ do ano inventariado vem da
        decomposição de tudo que foi aterrado nos anos anteriores.
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="sw-ref">Registro da fonte</label>
          <input id="sw-ref" type="text" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="ex.: Pátio de compostagem" />

          <label htmlFor="sw-desc">Descrição</label>
          <input id="sw-desc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} />

          <label htmlFor="sw-method">Método de tratamento</label>
          <select id="sw-method" value={method} onChange={(e) => setMethod(e.target.value as SolidWasteMethod)}>
            {(Object.keys(METHOD_LABELS) as SolidWasteMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>

          {method === "landfill" && (
            <>
              <p style={{ fontSize: "0.8rem", color: "var(--sc-muted)", margin: "0.75rem 0 0.25rem" }}>
                O resíduo aterrado gera CH₄ por décadas, então a emissão de {inventoryYear} depende da
                série histórica de deposição. Informe um ano por linha (o ideal é cobrir os últimos 30
                anos); anos sem linha contam como deposição zero.
              </p>

              <table>
                <thead>
                  <tr>
                    <th>Ano</th>
                    <th>Resíduo aterrado (t)</th>
                    <th>Qualidade do local</th>
                    <th>CH₄ recuperado (t)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {landfillYears.map((row, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          type="number" step="1" value={row.year}
                          onChange={(e) => setLandfillYears((rs) => rs.map((r, j) => (j === i ? { ...r, year: e.target.value } : r)))}
                        />
                      </td>
                      <td>
                        <input
                          type="number" step="0.01" min="0" value={row.waste_t}
                          onChange={(e) => setLandfillYears((rs) => rs.map((r, j) => (j === i ? { ...r, waste_t: e.target.value } : r)))}
                        />
                      </td>
                      <td>
                        <select
                          value={row.quality}
                          onChange={(e) => setLandfillYears((rs) => rs.map((r, j) => (j === i ? { ...r, quality: e.target.value } : r)))}
                        >
                          {LANDFILL_QUALITIES.map((q) => (
                            <option key={q.key} value={q.key}>{q.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number" step="0.0001" min="0" value={row.ch4_recovered_t}
                          onChange={(e) => setLandfillYears((rs) => rs.map((r, j) => (j === i ? { ...r, ch4_recovered_t: e.target.value } : r)))}
                        />
                      </td>
                      <td className="row-actions">
                        <button
                          type="button" className="btn-icon-danger"
                          onClick={() => setLandfillYears((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                onClick={() =>
                  setLandfillYears((rs) => {
                    const last = Number(rs[rs.length - 1]?.year) || inventoryYear;
                    return [...rs, { year: String(last - 1), waste_t: "", quality: rs[rs.length - 1]?.quality ?? "A", ch4_recovered_t: "" }];
                  })
                }
              >
                + Adicionar ano
              </button>

              <p style={{ fontSize: "0.8rem", color: "var(--sc-muted)", margin: "1rem 0 0.25rem" }}>
                Composição do resíduo aterrado (% de cada categoria), aplicada a toda a série. Soma
                atual: {fmt(landfillCompSum, 1)}%.
              </p>
              {ctx.landfill.map((f) => (
                <div key={f.category}>
                  <label htmlFor={`sw-lf-${f.position}`}>{f.category} (%)</label>
                  <input
                    id={`sw-lf-${f.position}`}
                    type="number" step="0.1" min="0" max="100"
                    value={landfillComp[f.category] ?? ""}
                    onChange={(e) => setLandfillComp((c) => ({ ...c, [f.category]: e.target.value }))}
                  />
                </div>
              ))}

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
                <input type="checkbox" checked={biogasFlared} onChange={(e) => setBiogasFlared(e.target.checked)} style={{ width: "auto" }} />
                Biogás recuperado é queimado em flare (gera CO₂ biogênico)
              </label>
            </>
          )}

          {method === "composting" && (
            <>
              <label htmlFor="sw-mass">Massa de resíduo compostada (t/ano)</label>
              <input id="sw-mass" type="number" step="0.01" min="0" value={massT} onChange={(e) => setMassT(e.target.value)} />

              <label htmlFor="sw-efch4">Fator de emissão de CH₄ (gCH₄/kg, opcional — padrão 4)</label>
              <input id="sw-efch4" type="number" step="0.0001" min="0" value={efCh4Kg} onChange={(e) => setEfCh4Kg(e.target.value)} />

              <label htmlFor="sw-efn2o">Fator de emissão de N₂O (gN₂O/kg, opcional — padrão 0,24)</label>
              <input id="sw-efn2o" type="number" step="0.0001" min="0" value={efN2oKg} onChange={(e) => setEfN2oKg(e.target.value)} />

              <label htmlFor="sw-rec">CH₄ recuperado (tCH₄/ano, opcional)</label>
              <input id="sw-rec" type="number" step="0.0001" min="0" value={ch4Recovered} onChange={(e) => setCh4Recovered(e.target.value)} />

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
                <input type="checkbox" checked={biogasFlared} onChange={(e) => setBiogasFlared(e.target.checked)} style={{ width: "auto" }} />
                Biogás recuperado é queimado em flare (gera CO₂ biogênico)
              </label>
            </>
          )}

          {method === "incineration" && (
            <>
              <label htmlFor="sw-incin">Massa de resíduo incinerada (t/ano, base úmida)</label>
              <input id="sw-incin" type="number" step="0.01" min="0" value={incineratedT} onChange={(e) => setIncineratedT(e.target.value)} />

              <p style={{ fontSize: "0.8rem", color: "var(--sc-muted)", margin: "0.75rem 0 0.25rem" }}>
                Composição do resíduo (% de cada categoria). O restante para fechar 100% é tratado como
                "Outros" (inerte). Soma atual: {fmt(compositionSum, 1)}%.
              </p>
              {namedCategories.map((f) => (
                <div key={f.category}>
                  <label htmlFor={`sw-comp-${f.position}`}>{f.category} (%)</label>
                  <input
                    id={`sw-comp-${f.position}`}
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={composition[f.category] ?? ""}
                    onChange={(e) => setComposition((c) => ({ ...c, [f.category]: e.target.value }))}
                  />
                </div>
              ))}

              <label htmlFor="sw-iefch4">FE de CH₄ do processo (gCH₄/t, opcional — padrão 0)</label>
              <input id="sw-iefch4" type="number" step="0.0001" min="0" value={efCh4T} onChange={(e) => setEfCh4T(e.target.value)} />

              <label htmlFor="sw-iefn2o">FE de N₂O do processo (gN₂O/t, opcional — padrão 100)</label>
              <input id="sw-iefn2o" type="number" step="0.0001" min="0" value={efN2oT} onChange={(e) => setEfN2oT(e.target.value)} />
            </>
          )}

          {method === "direct" && (
            <>
              <label htmlFor="sw-co2">Emissões de CO₂ (t)</label>
              <input id="sw-co2" type="number" step="0.0001" min="0" value={co2} onChange={(e) => setCo2(e.target.value)} />
              <label htmlFor="sw-ch4">Emissões de CH₄ (t)</label>
              <input id="sw-ch4" type="number" step="0.0001" min="0" value={ch4} onChange={(e) => setCh4(e.target.value)} />
              <label htmlFor="sw-n2o">Emissões de N₂O (t)</label>
              <input id="sw-n2o" type="number" step="0.0001" min="0" value={n2o} onChange={(e) => setN2o(e.target.value)} />
              <label htmlFor="sw-bio">CO₂ biogênico (t, opcional)</label>
              <input id="sw-bio" type="number" step="0.0001" min="0" value={bioCo2} onChange={(e) => setBioCo2(e.target.value)} />
            </>
          )}

          {preview?.ok && (
            <p className="auth-success">
              Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e
              {preview.computed.biogenic_co2_t > 0 ? ` (CO₂ biogênico: ${fmt(preview.computed.biogenic_co2_t, 4)} t)` : ""}
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
          { header: "Tratamento", render: (e) => METHOD_LABELS[e.activity_data.method as SolidWasteMethod] ?? String(e.activity_data.method) },
          { header: "CO₂ fóssil (t)", render: (e) => fmt(Number(e.computed?.co2_t ?? 0), 4) },
          { header: "CH₄ (t)", render: (e) => fmt(Number(e.computed?.ch4_t ?? 0), 4) },
        ]}
      />
    </section>
  );
}

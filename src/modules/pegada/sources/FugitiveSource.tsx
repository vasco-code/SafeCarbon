import { useState, type FormEvent } from "react";
import { GAS_LABELS } from "../engine/gwp";
import { calculate } from "../engine/registry";
import type { FugitiveMethod } from "../engine/types";
import { addEntry } from "../entryActions";
import { EntryTable, fmt, type SourceProps } from "./common";

// Emissões fugitivas (Escopo 1) — RAC (refrigeração/ar-condicionado),
// extintores e SF6/NF3. Três métodos, todos reduzindo a uma massa líquida de
// gás × GWP (ver calcFugitive no registry). Gases puros nesta fase; compostos
// (R-410A etc.) e a triagem por fator ficam para uma fase seguinte.

const METHOD_LABELS: Record<FugitiveMethod, string> = {
  lifecycle: "Estágio do ciclo de vida (Opção 1)",
  mass_balance: "Balanço de massa (Opção 2 / SF6-NF3)",
  direct: "Massa liberada informada direto",
};

const METHOD_HINTS: Record<FugitiveMethod, string> = {
  lifecycle:
    "E = carga (novas) − capacidade (novas) + recarga (existentes) + capacidade (dispensadas) − recuperada.",
  mass_balance:
    "E = (estoque inicial − estoque final) + transferido − mudança de capacidade. Para SF6/NF3, deixe a mudança de capacidade em 0.",
  direct: "Informe a massa de gás liberada no ano (ex.: estimativa de triagem ou de outra ferramenta).",
};

// Campos (kg) exibidos por método, na ordem da planilha.
const METHOD_FIELDS: Record<FugitiveMethod, { key: string; label: string }[]> = {
  lifecycle: [
    { key: "charge_new_kg", label: "Carga — unidades novas (kg)" },
    { key: "capacity_new_kg", label: "Capacidade — unidades novas (kg)" },
    { key: "recharge_existing_kg", label: "Recarga — unidades existentes (kg)" },
    { key: "capacity_disposed_kg", label: "Capacidade — unidades dispensadas (kg)" },
    { key: "recovered_kg", label: "Recuperada — unidades dispensadas (kg)" },
  ],
  mass_balance: [
    { key: "stock_initial_kg", label: "Estoque de gás no início do ano (kg)" },
    { key: "stock_final_kg", label: "Estoque de gás no final do ano (kg)" },
    { key: "transferred_kg", label: "Transferido — comprado − vendido/dispensado (kg)" },
    { key: "capacity_change_kg", label: "Mudança de capacidade (kg)" },
  ],
  direct: [{ key: "released_kg", label: "Massa de gás liberada (kg)" }],
};

export function FugitiveSource({ inventoryId, ctx, entries, reload, readOnly }: SourceProps) {
  const gasOptions = [...ctx.gwp.keys()].sort((a, b) => {
    // Nas fugitivas os gases mais usados são HFCs/SF6; ainda assim mantemos os
    // básicos primeiro para consistência com Processos/Agricultura.
    const order = ["HFC-134a", "HFC-125", "HFC-32", "SF6", "NF3", "CO2", "CH4", "N2O"];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });

  const [gas, setGas] = useState("HFC-134a");
  const [method, setMethod] = useState<FugitiveMethod>("lifecycle");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sourceRef, setSourceRef] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeFields = METHOD_FIELDS[method];

  function setField(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function buildData() {
    const numeric: Record<string, number> = {};
    for (const { key } of activeFields) {
      if (fields[key] !== undefined && fields[key] !== "") numeric[key] = Number(fields[key]);
    }
    return { source_category: "fugitive", gas, method, ...numeric } as const;
  }

  const anyFilled = activeFields.some(({ key }) => fields[key] !== undefined && fields[key] !== "");
  const preview = anyFilled ? calculate(buildData(), ctx) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!anyFilled) {
      setError("Preencha ao menos um dos campos do método selecionado.");
      return;
    }
    const result = calculate(buildData(), ctx);
    if (!result.ok) {
      setError(`Erro no cálculo: ${result.missingFactor}`);
      return;
    }
    setSubmitting(true);
    const { error: err } = await addEntry(inventoryId, buildData(), result.computed, {
      sourceRef,
      description: desc,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setFields({});
      setSourceRef("");
      setDesc("");
      setError(null);
      reload();
    }
  }

  return (
    <section>
      <h2>Emissões fugitivas</h2>
      <p>
        Vazamentos de gases de refrigeração/ar-condicionado, extintores e SF6/NF3 (Escopo 1). A massa
        líquida de gás é convertida a CO₂e pelo GWP do próprio gás.
      </p>

      {!readOnly && (
        <form onSubmit={handleSubmit}>
          <label htmlFor="fg-ref">Registro da fonte</label>
          <input
            id="fg-ref"
            type="text"
            value={sourceRef}
            onChange={(e) => setSourceRef(e.target.value)}
            placeholder="ex.: Ar-condicionado escritório"
          />

          <label htmlFor="fg-desc">Descrição</label>
          <input id="fg-desc" type="text" value={desc} onChange={(e) => setDesc(e.target.value)} />

          <label htmlFor="fg-gas">Gás ou composto</label>
          <select id="fg-gas" value={gas} onChange={(e) => setGas(e.target.value)}>
            {gasOptions.map((g) => (
              <option key={g} value={g}>
                {GAS_LABELS[g] ?? g} — GWP {fmt(ctx.gwp.get(g) ?? 0, 0)}
              </option>
            ))}
          </select>

          <label htmlFor="fg-method">Método de cálculo</label>
          <select id="fg-method" value={method} onChange={(e) => setMethod(e.target.value as FugitiveMethod)}>
            {(Object.keys(METHOD_LABELS) as FugitiveMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <p style={{ fontSize: "0.8rem", color: "var(--sc-muted)", margin: "0.25rem 0 0" }}>
            {METHOD_HINTS[method]}
          </p>

          {activeFields.map(({ key, label }) => (
            <div key={key}>
              <label htmlFor={`fg-${key}`}>{label}</label>
              <input
                id={`fg-${key}`}
                type="number"
                step="0.0001"
                value={fields[key] ?? ""}
                onChange={(e) => setField(key, e.target.value)}
              />
            </div>
          ))}

          {preview?.ok && (
            <p className="auth-success">Prévia: {fmt(preview.computed.co2e_t, 4)} tCO₂e</p>
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
          { header: "Gás", render: (e) => GAS_LABELS[String(e.activity_data.gas)] ?? String(e.activity_data.gas) },
          {
            header: "Método",
            render: (e) => METHOD_LABELS[e.activity_data.method as FugitiveMethod] ?? String(e.activity_data.method),
          },
        ]}
      />
    </section>
  );
}

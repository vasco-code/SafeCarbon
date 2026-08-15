import type { FactorContext } from "../engine/factors";
import type { Entry } from "../entryActions";
import { deleteEntry } from "../entryActions";

export interface SourceProps {
  inventoryId: string;
  ctx: FactorContext;
  entries: Entry[];
  reload: () => void;
  readOnly: boolean;
}

export function fmt(n: number, digits = 3): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

export const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Seletor de mês opcional para o lançamento, usado por quase todas as fontes
// (exceto o método "landfill" de Resíduos sólidos, cuja série já cobre vários
// anos por lançamento). `value` é o mês (1-12) ou "" para "ano inteiro".
export function PeriodField({
  value,
  onChange,
  idPrefix,
}: {
  value: string;
  onChange: (value: string) => void;
  idPrefix: string;
}) {
  return (
    <>
      <label htmlFor={`${idPrefix}-period`}>Período</label>
      <select id={`${idPrefix}-period`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Ano inteiro</option>
        {MONTH_LABELS.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>
    </>
  );
}

// Tabela padrão de lançamentos de uma fonte: descrição + colunas de gases +
// CO2e, com ação de excluir. `columns` descreve os campos de atividade a
// mostrar antes das colunas de emissão.
export function EntryTable({
  entries,
  columns,
  reload,
  readOnly,
}: {
  entries: Entry[];
  columns: { header: string; render: (e: Entry) => string }[];
  reload: () => void;
  readOnly: boolean;
}) {
  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    await deleteEntry(id);
    reload();
  }

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <p>Nenhum lançamento ainda nesta fonte.</p>
      </div>
    );
  }

  const total = entries.reduce((s, e) => s + (e.computed?.co2e_t ?? 0), 0);

  return (
    <table>
      <thead>
        <tr>
          <th>Registro</th>
          <th>Descrição</th>
          {columns.map((c) => (
            <th key={c.header}>{c.header}</th>
          ))}
          <th>Período</th>
          <th>CO₂e (t)</th>
          {!readOnly && <th></th>}
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td>{e.source_ref ?? "—"}</td>
            <td>{e.description ?? "—"}</td>
            {columns.map((c) => (
              <td key={c.header}>{c.render(e)}</td>
            ))}
            <td>{e.period_month ? MONTH_LABELS[e.period_month - 1] : "Ano inteiro"}</td>
            <td>{fmt(e.computed?.co2e_t ?? 0, 4)}</td>
            {!readOnly && (
              <td className="row-actions">
                <button type="button" className="btn-icon-danger" onClick={() => handleDelete(e.id)}>
                  Excluir
                </button>
              </td>
            )}
          </tr>
        ))}
        <tr>
          <td colSpan={3 + columns.length}>
            <strong>Total</strong>
          </td>
          <td>
            <strong>{fmt(total, 4)}</strong>
          </td>
          {!readOnly && <td></td>}
        </tr>
      </tbody>
    </table>
  );
}

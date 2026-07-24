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
          <td colSpan={2 + columns.length}>
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

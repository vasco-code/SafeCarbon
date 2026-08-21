import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Cloud } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface EmissionFactor {
  id: string;
  category: string;
  value: number;
}

interface InventoryEntry {
  id: string;
  period_year: number;
  source_type: string;
  activity_quantity: number;
  activity_unit: string;
  calculated_tco2e: number;
  justification: string | null;
  site_id: string | null;
}

interface ProjectSite {
  id: string;
  label: string;
}

const NO_SITE_LABEL = "Projeto (sem local específico)";

type SourceType = "biomass_combustion" | "diesel_transport" | "electricity";

const SOURCE_LABELS: Record<SourceType, string> = {
  biomass_combustion: "Combustão de biomassa (lenha)",
  diesel_transport: "Combustível fóssil (diesel)",
  electricity: "Energia elétrica",
};

export function InventarioPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
  const [sourceType, setSourceType] = useState<SourceType>("biomass_combustion");
  const [siteId, setSiteId] = useState("");
  const [activityQuantity, setActivityQuantity] = useState("");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    if (!projectId) return;
    const [factorsResult, entriesResult, sitesResult] = await Promise.all([
      supabase.from("emission_factors").select("id, category, value"),
      supabase
        .from("emission_inventory_entries")
        .select("id, period_year, source_type, activity_quantity, activity_unit, calculated_tco2e, justification, site_id")
        .eq("project_id", projectId)
        .order("period_year", { ascending: false }),
      supabase.from("project_sites").select("id, label").eq("project_id", projectId).order("label"),
    ]);
    setFactors(factorsResult.data ?? []);
    setEntries(entriesResult.data ?? []);
    setSites(sitesResult.data ?? []);
  }

  useEffect(() => {
    loadData();
  }, [projectId]);

  function factorValue(category: string) {
    return factors.find((f) => f.category === category)?.value ?? null;
  }

  function factorId(category: string) {
    return factors.find((f) => f.category === category)?.id ?? null;
  }

  // Calcula tCO2e a partir da quantidade de atividade e dos fatores vigentes —
  // nunca digitado à mão. Biomassa: kg -> Gg -> TJ -> kg CH4/N2O -> tCO2e via GWP.
  function calculatePreview(): { tco2e: number; factorIds: string[] } | null {
    const quantity = Number(activityQuantity);
    if (!quantity || quantity <= 0) return null;

    if (sourceType === "biomass_combustion") {
      const ch4 = factorValue("biomass_ch4");
      const n2o = factorValue("biomass_n2o");
      const ncv = factorValue("biomass_ncv");
      const gwpCh4 = factorValue("gwp_ch4");
      const gwpN2o = factorValue("gwp_n2o");
      if (ch4 == null || n2o == null || ncv == null || gwpCh4 == null || gwpN2o == null) return null;

      const energyTJ = (quantity / 1_000_000) * ncv;
      const ch4Tco2e = ((energyTJ * ch4) / 1000) * gwpCh4;
      const n2oTco2e = ((energyTJ * n2o) / 1000) * gwpN2o;
      return {
        tco2e: ch4Tco2e + n2oTco2e,
        factorIds: [
          factorId("biomass_ch4"),
          factorId("biomass_n2o"),
          factorId("biomass_ncv"),
          factorId("gwp_ch4"),
          factorId("gwp_n2o"),
        ].filter((id): id is string => id !== null),
      };
    }

    if (sourceType === "diesel_transport") {
      const dieselFactor = factorValue("diesel_co2e");
      if (dieselFactor == null) return null;
      return {
        tco2e: (quantity * dieselFactor) / 1000,
        factorIds: [factorId("diesel_co2e")].filter((id): id is string => id !== null),
      };
    }

    return null;
  }

  const isElectricity = sourceType === "electricity";
  const preview = isElectricity ? null : calculatePreview();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    setError(null);

    if (isElectricity) {
      if (!justification.trim()) {
        setError("Ao excluir uma fonte (ex.: energia renovável), a justificativa é obrigatória.");
        return;
      }
      setSubmitting(true);
      const { error } = await supabase.from("emission_inventory_entries").insert({
        project_id: projectId,
        period_year: Number(periodYear),
        source_type: sourceType,
        activity_quantity: Number(activityQuantity) || 0,
        activity_unit: "kWh",
        emission_factor_ids: [],
        calculated_tco2e: 0,
        justification,
        site_id: siteId || null,
      });
      setSubmitting(false);
      if (error) {
        setError(error.message);
      } else {
        setActivityQuantity("");
        setJustification("");
        loadData();
      }
      return;
    }

    if (!preview) {
      setError("Não foi possível calcular — verifique a quantidade e se os fatores de emissão estão cadastrados.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("emission_inventory_entries").insert({
      project_id: projectId,
      period_year: Number(periodYear),
      source_type: sourceType,
      activity_quantity: Number(activityQuantity),
      activity_unit: sourceType === "biomass_combustion" ? "kg" : "L",
      emission_factor_ids: preview.factorIds,
      calculated_tco2e: preview.tco2e,
      justification: justification || null,
      site_id: siteId || null,
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      setActivityQuantity("");
      setJustification("");
      loadData();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento de inventário? Essa ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("emission_inventory_entries").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      loadData();
    }
  }

  const totalTco2e = entries.reduce((sum, e) => sum + e.calculated_tco2e, 0);

  function siteLabel(id: string | null) {
    if (!id) return NO_SITE_LABEL;
    return sites.find((s) => s.id === id)?.label ?? NO_SITE_LABEL;
  }

  const totalsBySite = (() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const key = siteLabel(e.site_id);
      map.set(key, (map.get(key) ?? 0) + e.calculated_tco2e);
    }
    return [...map.entries()].sort((a, b) => {
      if (a[0] === NO_SITE_LABEL) return 1;
      if (b[0] === NO_SITE_LABEL) return -1;
      return a[0].localeCompare(b[0], "pt-BR");
    });
  })();

  return (
    <section>
      <h2 className="module-heading">
        <Cloud size={20} /> Inventário de Emissões
      </h2>
      <p>Lançamento de fontes de emissão e cálculo automático em tCO₂e.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="inv-year">Ano</label>
        <input id="inv-year" type="number" value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} required />

        <label htmlFor="inv-source">Fonte de emissão</label>
        <select id="inv-source" value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
          {Object.entries(SOURCE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="inv-site">Local</label>
        <select id="inv-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">{NO_SITE_LABEL}</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        <label htmlFor="inv-quantity">
          Quantidade ({sourceType === "biomass_combustion" ? "kg" : sourceType === "diesel_transport" ? "L" : "kWh"})
        </label>
        <input
          id="inv-quantity"
          type="number"
          step="0.001"
          min="0"
          value={activityQuantity}
          onChange={(e) => setActivityQuantity(e.target.value)}
        />

        <label htmlFor="inv-justification">
          Justificativa {isElectricity ? "(obrigatória para exclusão desta fonte)" : "(opcional)"}
        </label>
        <input
          id="inv-justification"
          type="text"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />

        {preview && (
          <p className="auth-success">Prévia do cálculo: {preview.tco2e.toFixed(4)} tCO₂e</p>
        )}

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Lançar fonte de emissão"}
        </button>
      </form>

      <h2>Lançamentos — total {totalTco2e.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e</h2>
      {entries.length === 0 && (
        <div className="empty-state">
          <p>Nenhuma fonte de emissão lançada ainda. Use o formulário acima para registrar a primeira.</p>
        </div>
      )}
      {entries.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Ano</th>
              <th>Fonte</th>
              <th>Local</th>
              <th>Quantidade</th>
              <th>tCO₂e</th>
              <th>Justificativa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.period_year}</td>
                <td>{SOURCE_LABELS[e.source_type as SourceType] ?? e.source_type}</td>
                <td>{siteLabel(e.site_id)}</td>
                <td>
                  {e.activity_quantity.toLocaleString("pt-BR")} {e.activity_unit}
                </td>
                <td>{e.calculated_tco2e.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</td>
                <td>{e.justification ?? "—"}</td>
                <td className="row-actions">
                  <button type="button" className="btn-icon-danger" onClick={() => handleDelete(e.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalsBySite.length > 0 && (
        <>
          <h2>Total por local</h2>
          <table>
            <thead>
              <tr>
                <th>Local</th>
                <th>tCO₂e</th>
              </tr>
            </thead>
            <tbody>
              {totalsBySite.map(([label, total]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{total.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

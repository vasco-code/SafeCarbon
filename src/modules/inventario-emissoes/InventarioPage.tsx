import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Cloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProjectRole } from "@/hooks/useProjectRole";
import { DIRECT_SOURCES, SOURCE_LABELS, sourceLabel, type SourceType } from "./sourceLabels";

interface EmissionFactor {
  id: string;
  category: string;
  value: number;
  valid_from: string;
  valid_to: string | null;
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
  allocation_pct: number;
}

interface ProjectSite {
  id: string;
  label: string;
}

const NO_SITE_LABEL = "Projeto (sem local específico)";

const ACTIVITY_UNITS: Record<SourceType, string> = {
  biomass_combustion: "kg",
  diesel_transport: "L",
  electricity: "kWh",
  waste: "tCO₂e",
  upstream_inputs: "tCO₂e",
};

export function InventarioPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { accessLevel, canWrite } = useProjectRole(projectId);
  const canDelete = accessLevel === "full" && canWrite;
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
  const [sourceType, setSourceType] = useState<SourceType>("biomass_combustion");
  const [siteId, setSiteId] = useState("");
  const [activityQuantity, setActivityQuantity] = useState("");
  const [allocationPct, setAllocationPct] = useState("100");
  const [excludeSource, setExcludeSource] = useState(false);
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    if (!projectId) return;
    const [factorsResult, entriesResult, sitesResult] = await Promise.all([
      supabase.from("emission_factors").select("id, category, value, valid_from, valid_to"),
      supabase
        .from("emission_inventory_entries")
        .select("id, period_year, source_type, activity_quantity, activity_unit, calculated_tco2e, justification, site_id, allocation_pct")
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

  // Fator vigente no ano do lançamento: valid_from <= 31/12 e (valid_to nulo
  // ou >= 01/01), o mais recente primeiro. Antes pegava o primeiro registro
  // da categoria, o que quebra assim que existirem dois fatores do mesmo tipo.
  function currentFactor(category: string) {
    const year = Number(periodYear);
    return factors
      .filter(
        (f) =>
          f.category === category &&
          f.valid_from <= `${year}-12-31` &&
          (f.valid_to === null || f.valid_to >= `${year}-01-01`),
      )
      .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
  }

  function factorValue(category: string) {
    return currentFactor(category)?.value ?? null;
  }

  function factorId(category: string) {
    return currentFactor(category)?.id ?? null;
  }

  // Calcula tCO2e BRUTO a partir da quantidade de atividade e dos fatores
  // vigentes — nunca digitado à mão, exceto nas fontes diretas (resíduos e
  // insumos), que vêm de cálculo próprio documentado no DCP.
  // Biomassa: kg -> Gg -> TJ -> kg CH4/N2O -> tCO2e via GWP.
  function calculatePreview(): { tco2e: number; factorIds: string[] } | null {
    const quantity = Number(activityQuantity);
    if (!quantity || quantity <= 0) return null;

    if (DIRECT_SOURCES.includes(sourceType)) {
      return { tco2e: quantity, factorIds: [] };
    }

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

    // Energia elétrica (escopo 2, localização): kWh -> MWh × fator médio do SIN.
    if (sourceType === "electricity") {
      const gridFactor = factorValue("electricity_grid");
      if (gridFactor == null) return null;
      return {
        tco2e: (quantity / 1000) * gridFactor,
        factorIds: [factorId("electricity_grid")].filter((id): id is string => id !== null),
      };
    }

    return null;
  }

  const isElectricity = sourceType === "electricity";
  const isDirect = DIRECT_SOURCES.includes(sourceType);
  const allocation = Number(allocationPct);
  const allocationValid = allocation > 0 && allocation <= 100;
  const preview = isElectricity && excludeSource ? null : calculatePreview();
  const allocatedPreview = preview && allocationValid ? (preview.tco2e * allocation) / 100 : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    setError(null);

    if (!allocationValid) {
      setError("A chave de alocação deve ser maior que 0 e no máximo 100 (%).");
      return;
    }

    // Exclusão explícita de uma fonte (ex.: energia renovável comprovada) e
    // fontes diretas exigem justificativa.
    const needsJustification = (isElectricity && excludeSource) || isDirect;
    if (needsJustification && !justification.trim()) {
      setError(
        isDirect
          ? "Resíduos e insumos são lançados direto em tCO₂e — a justificativa (origem do cálculo, referência ao DCP) é obrigatória."
          : "Ao excluir uma fonte (ex.: energia renovável), a justificativa é obrigatória.",
      );
      return;
    }

    if (isElectricity && excludeSource) {
      setSubmitting(true);
      const { error } = await supabase.from("emission_inventory_entries").insert({
        project_id: projectId,
        period_year: Number(periodYear),
        source_type: sourceType,
        activity_quantity: Number(activityQuantity) || 0,
        activity_unit: "kWh",
        emission_factor_ids: [],
        calculated_tco2e: 0,
        gross_tco2e: 0,
        allocation_pct: allocation,
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

    if (!preview || allocatedPreview === null) {
      setError("Não foi possível calcular — verifique a quantidade e se os fatores de emissão estão cadastrados.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("emission_inventory_entries").insert({
      project_id: projectId,
      period_year: Number(periodYear),
      source_type: sourceType,
      activity_quantity: Number(activityQuantity),
      activity_unit: ACTIVITY_UNITS[sourceType],
      emission_factor_ids: preview.factorIds,
      gross_tco2e: preview.tco2e,
      allocation_pct: allocation,
      calculated_tco2e: allocatedPreview,
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

      {canWrite && (
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
          {isDirect ? "Emissão calculada (tCO₂e, antes da alocação)" : `Quantidade (${ACTIVITY_UNITS[sourceType]})`}
        </label>
        <input
          id="inv-quantity"
          type="number"
          step="0.001"
          min="0"
          value={activityQuantity}
          onChange={(e) => setActivityQuantity(e.target.value)}
        />

        {isElectricity && (
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={excludeSource} onChange={(e) => setExcludeSource(e.target.checked)} />
            Excluir esta fonte do inventário (ex.: energia renovável comprovada)
          </label>
        )}

        <label htmlFor="inv-allocation">Chave de alocação ao projeto (%)</label>
        <input
          id="inv-allocation"
          type="number"
          step="0.00001"
          min="0.00001"
          max="100"
          value={allocationPct}
          onChange={(e) => setAllocationPct(e.target.value)}
        />

        <label htmlFor="inv-justification">
          Justificativa {isDirect || (isElectricity && excludeSource) ? "(obrigatória para esta fonte)" : "(opcional)"}
        </label>
        <input
          id="inv-justification"
          type="text"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />

        {preview && (
          <p className="auth-success">
            Prévia do cálculo: {preview.tco2e.toFixed(4)} tCO₂e
            {allocatedPreview !== null && allocation !== 100 && ` → ${allocatedPreview.toFixed(4)} tCO₂e após alocação de ${allocation}%`}
          </p>
        )}

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : "Lançar fonte de emissão"}
        </button>
      </form>
      )}

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
              {canDelete && <th></th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.period_year}</td>
                <td>
                  {sourceLabel(e.source_type)}
                  {Number(e.allocation_pct) !== 100 && ` (alocação ${Number(e.allocation_pct)}%)`}
                </td>
                <td>{siteLabel(e.site_id)}</td>
                <td>
                  {e.activity_quantity.toLocaleString("pt-BR")} {e.activity_unit}
                </td>
                <td>{e.calculated_tco2e.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</td>
                <td>{e.justification ?? "—"}</td>
                {canDelete && (
                  <td className="row-actions">
                    <button type="button" className="btn-icon-danger" onClick={() => handleDelete(e.id)}>
                      Excluir
                    </button>
                  </td>
                )}
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

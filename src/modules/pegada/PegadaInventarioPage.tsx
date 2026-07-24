import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Leaf, Factory, Fuel, Zap, Plug, Plane, Bus, Lock, FlaskConical, Wheat, Droplets, Wind } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { loadFactorContext, type FactorContext } from "./engine/factors";
import { aggregate, type InventoryEntry } from "./engine/aggregate";
import type { SourceCategory } from "./engine/types";
import { SOURCES, SCOPE_LABELS } from "./sources";
import type { Entry } from "./entryActions";
import { StationaryCombustionSource } from "./sources/StationaryCombustionSource";
import { MobileCombustionSource } from "./sources/MobileCombustionSource";
import { ElectricityLocationSource } from "./sources/ElectricityLocationSource";
import { ElectricityMarketSource } from "./sources/ElectricityMarketSource";
import { BusinessTravelSource } from "./sources/BusinessTravelSource";
import { CommutingSource } from "./sources/CommutingSource";
import { IndustrialProcessesSource } from "./sources/IndustrialProcessesSource";
import { AgricultureSource } from "./sources/AgricultureSource";
import { FugitiveSource } from "./sources/FugitiveSource";
import { FuelEnergyUpstreamSource } from "./sources/FuelEnergyUpstreamSource";
import { ImportPlanilhaPanel } from "./ImportPlanilhaPanel";

interface InventoryHeader {
  id: string;
  inventory_year: number;
  name: string | null;
  status: "draft" | "final";
}

const SOURCE_ICONS: Record<string, typeof Factory> = {
  stationary_combustion: Factory,
  mobile_combustion: Fuel,
  fugitive: Wind,
  electricity_location: Zap,
  electricity_market: Plug,
  business_travel: Plane,
  commuting: Bus,
  industrial_processes: FlaskConical,
  agriculture: Wheat,
  fuel_energy_upstream: Droplets,
};

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card report-kpi-card">
      <div>
        <p className="report-kpi-label">{label}</p>
        <p className="metric">{value}</p>
        {sub && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--sc-muted)" }}>{sub}</p>}
      </div>
    </div>
  );
}

export function PegadaInventarioPage() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const [header, setHeader] = useState<InventoryHeader | null>(null);
  const [ctx, setCtx] = useState<FactorContext | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<SourceCategory>("stationary_combustion");
  const [loading, setLoading] = useState(true);

  async function loadEntries() {
    if (!inventoryId) return;
    const { data } = await supabase
      .from("ghg_activity_entries")
      .select("id, source_category, source_ref, description, activity_data, computed")
      .eq("inventory_id", inventoryId)
      .order("created_at", { ascending: true });
    setEntries((data as unknown as Entry[]) ?? []);
  }

  useEffect(() => {
    if (!inventoryId) return;
    const id = inventoryId;
    async function load() {
      const [invRes, factorCtx] = await Promise.all([
        supabase.from("ghg_inventories").select("id, inventory_year, name, status").eq("id", id).maybeSingle(),
        loadFactorContext(),
      ]);
      setHeader(invRes.data as InventoryHeader | null);
      setCtx(factorCtx);
      await loadEntries();
      setLoading(false);
    }
    load();
  }, [inventoryId]);

  const totals = useMemo(() => aggregate(entries as unknown as InventoryEntry[]), [entries]);

  if (loading) return <p>Carregando...</p>;
  if (!header) {
    return (
      <section>
        <h1>Inventário</h1>
        <p>Inventário não encontrado, ou você não tem acesso a ele.</p>
      </section>
    );
  }
  if (!ctx) return null;

  const readOnly = header.status === "final";
  const entriesOf = (cat: SourceCategory) => entries.filter((e) => e.source_category === cat);
  const commonProps = { inventoryId: inventoryId!, ctx, reload: loadEntries, readOnly };

  return (
    <section className="project-shell">
      <Link to="/pegada" className="project-back-link">
        <ArrowLeft size={14} /> Pegada de Carbono
      </Link>

      <div className="project-header">
        <h1>
          <Leaf size={20} style={{ verticalAlign: "-3px", marginRight: "0.4rem" }} />
          Inventário {header.inventory_year}
          {header.name ? ` — ${header.name}` : ""}
        </h1>
        <span className={`badge ${header.status === "final" ? "badge-success" : "badge-neutral"}`}>
          {header.status === "final" ? "Finalizado" : "Rascunho"}
        </span>
      </div>

      <div className="report-kpi-grid" style={{ marginBottom: "1.5rem" }}>
        <KpiCard label="Escopo 1" value={`${totals.byScope[1].toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`} />
        <KpiCard label="Escopo 2" value={`${totals.byScope[2].toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`} />
        <KpiCard label="Escopo 3" value={`${totals.byScope[3].toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`} />
        <KpiCard
          label="Total"
          value={`${totals.total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tCO₂e`}
          sub={`CO₂ biogênico à parte: +${totals.biogenicCo2.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} / -${totals.biogenicCo2Removals.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} t`}
        />
      </div>

      {!readOnly && (
        <ImportPlanilhaPanel
          inventoryId={inventoryId!}
          inventoryYear={header.inventory_year}
          ctx={ctx}
          reload={loadEntries}
        />
      )}

      {[1, 2, 3].map((scope) => (
        <div key={scope} style={{ marginBottom: "0.5rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--sc-muted)", margin: "0.5rem 0 0.25rem" }}>
            {SCOPE_LABELS[scope as 1 | 2 | 3]}
          </p>
          <nav className="project-tabs" aria-label={`Fontes do escopo ${scope}`}>
            {SOURCES.filter((s) => s.scope === scope).map((s) => {
              const Icon = SOURCE_ICONS[s.category] ?? Factory;
              const count = s.implemented ? entriesOf(s.category as SourceCategory).length : 0;
              return (
                <button
                  key={s.category}
                  type="button"
                  disabled={!s.implemented}
                  onClick={() => s.implemented && setActive(s.category as SourceCategory)}
                  className={`project-tab${active === s.category ? " active" : ""}`}
                  style={!s.implemented ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                  title={s.implemented ? undefined : "Em breve"}
                >
                  {s.implemented ? <Icon size={15} /> : <Lock size={13} />}
                  {s.label}
                  {count > 0 ? ` (${count})` : ""}
                </button>
              );
            })}
          </nav>
        </div>
      ))}

      <div className="project-tab-content">
        {active === "stationary_combustion" && <StationaryCombustionSource {...commonProps} entries={entriesOf("stationary_combustion")} />}
        {active === "mobile_combustion" && <MobileCombustionSource {...commonProps} entries={entriesOf("mobile_combustion")} />}
        {active === "fugitive" && <FugitiveSource {...commonProps} entries={entriesOf("fugitive")} />}
        {active === "electricity_location" && <ElectricityLocationSource {...commonProps} entries={entriesOf("electricity_location")} defaultYear={header.inventory_year} />}
        {active === "electricity_market" && <ElectricityMarketSource {...commonProps} entries={entriesOf("electricity_market")} />}
        {active === "business_travel" && <BusinessTravelSource {...commonProps} entries={entriesOf("business_travel")} />}
        {active === "commuting" && <CommutingSource {...commonProps} entries={entriesOf("commuting")} />}
        {active === "industrial_processes" && <IndustrialProcessesSource {...commonProps} entries={entriesOf("industrial_processes")} />}
        {active === "agriculture" && <AgricultureSource {...commonProps} entries={entriesOf("agriculture")} />}
        {active === "fuel_energy_upstream" && <FuelEnergyUpstreamSource {...commonProps} entries={entriesOf("fuel_energy_upstream")} />}
      </div>
    </section>
  );
}

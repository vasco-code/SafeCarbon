import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Leaf, Factory, Fuel, Zap, Plug, Plane, Bus, Lock, FlaskConical, Wheat, Droplets,
  Wind, Waves, Trash2, Package, Building2, Truck, Recycle, Warehouse, Cog, ShoppingCart, Store,
  TrendingUp, PackageOpen, FileDown, TreePine, Cable, Flame,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { loadFactorContext, type FactorContext } from "./engine/factors";
import { aggregate, type InventoryEntry } from "./engine/aggregate";
import type { Scope3GasEntryCategory, SourceCategory } from "./engine/types";
import { SCOPE3_GAS_ENTRY_CATEGORIES } from "./engine/types";
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
import { DirectGasEmissionSource } from "./sources/DirectGasEmissionSource";
import { LandUseSource } from "./sources/LandUseSource";
import { EffluentSource } from "./sources/EffluentSource";
import { SolidWasteSource } from "./sources/SolidWasteSource";
import { FuelEnergyUpstreamSource } from "./sources/FuelEnergyUpstreamSource";
import { TdLossesLocationSource } from "./sources/TdLossesLocationSource";
import { TdLossesMarketSource } from "./sources/TdLossesMarketSource";
import { ThermalEnergyPurchasedSource } from "./sources/ThermalEnergyPurchasedSource";
import { ImportPlanilhaPanel } from "./ImportPlanilhaPanel";
import { downloadInventoryReport } from "./inventoryReport";

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
  td_losses_location: Cable,
  td_losses_market: Cable,
  thermal_energy_purchased: Flame,
  business_travel: Plane,
  commuting: Bus,
  industrial_processes: FlaskConical,
  agriculture: Wheat,
  effluents: Waves,
  solid_waste: Trash2,
  land_use: TreePine,
  purchased_goods: Package,
  capital_goods: Building2,
  fuel_energy_upstream: Droplets,
  transport_distribution_upstream: Truck,
  waste_generated_operations: Recycle,
  leased_assets_upstream: Warehouse,
  transport_distribution_downstream: Truck,
  processing_sold_products: Cog,
  use_sold_products: ShoppingCart,
  end_of_life_sold_products: PackageOpen,
  leased_assets_downstream: Warehouse,
  franchises: Store,
  investments: TrendingUp,
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
  const [activeScope, setActiveScope] = useState<1 | 2 | 3>(1);
  const [active, setActive] = useState<SourceCategory>("stationary_combustion");
  const [loading, setLoading] = useState(true);

  function selectScope(scope: 1 | 2 | 3) {
    setActiveScope(scope);
    const firstOfScope = SOURCES.find((s) => s.scope === scope);
    if (firstOfScope) setActive(firstOfScope.category as SourceCategory);
  }

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
        <button
          type="button"
          onClick={() => downloadInventoryReport(header, entries as unknown as InventoryEntry[])}
          disabled={entries.length === 0}
          title={entries.length === 0 ? "Lance ao menos uma fonte para gerar o relatório" : undefined}
        >
          <FileDown size={15} />
          Exportar relatório (.doc)
        </button>
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
        <div style={{ marginBottom: "1.5rem" }}>
          <ImportPlanilhaPanel
            inventoryId={inventoryId!}
            inventoryYear={header.inventory_year}
            ctx={ctx}
            reload={loadEntries}
          />
        </div>
      )}

      <p style={{ fontSize: "0.8125rem", color: "var(--sc-muted)", marginTop: 0, marginBottom: "0.75rem" }}>
        Escolha o escopo e depois a fonte de emissão para lançar os dados — cada fonte tem seu próprio formulário. O
        número entre parênteses mostra quantos lançamentos já existem naquela fonte; abas com <Lock size={11} style={{ verticalAlign: "-1px" }} /> ainda
        não estão disponíveis nesta fase.
      </p>

      <nav className="project-tabs" aria-label="Escopo" style={{ marginBottom: "0.75rem" }}>
        {([1, 2, 3] as const).map((scope) => (
          <button
            key={scope}
            type="button"
            onClick={() => selectScope(scope)}
            className={`project-tab${activeScope === scope ? " active" : ""}`}
          >
            {SCOPE_LABELS[scope]}
          </button>
        ))}
      </nav>

      <nav className="project-tabs" aria-label={`Fontes do escopo ${activeScope}`} style={{ marginBottom: "0.5rem" }}>
        {SOURCES.filter((s) => s.scope === activeScope).map((s) => {
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

      <div className="project-tab-content">
        {active === "stationary_combustion" && <StationaryCombustionSource {...commonProps} entries={entriesOf("stationary_combustion")} />}
        {active === "mobile_combustion" && <MobileCombustionSource {...commonProps} entries={entriesOf("mobile_combustion")} />}
        {active === "fugitive" && <FugitiveSource {...commonProps} entries={entriesOf("fugitive")} />}
        {active === "electricity_location" && <ElectricityLocationSource {...commonProps} entries={entriesOf("electricity_location")} defaultYear={header.inventory_year} />}
        {active === "electricity_market" && <ElectricityMarketSource {...commonProps} entries={entriesOf("electricity_market")} />}
        {active === "td_losses_location" && <TdLossesLocationSource {...commonProps} entries={entriesOf("td_losses_location")} defaultYear={header.inventory_year} />}
        {active === "td_losses_market" && <TdLossesMarketSource {...commonProps} entries={entriesOf("td_losses_market")} />}
        {active === "thermal_energy_purchased" && <ThermalEnergyPurchasedSource {...commonProps} entries={entriesOf("thermal_energy_purchased")} />}
        {active === "business_travel" && <BusinessTravelSource {...commonProps} entries={entriesOf("business_travel")} />}
        {active === "commuting" && <CommutingSource {...commonProps} entries={entriesOf("commuting")} />}
        {active === "industrial_processes" && <IndustrialProcessesSource {...commonProps} entries={entriesOf("industrial_processes")} />}
        {active === "agriculture" && <AgricultureSource {...commonProps} entries={entriesOf("agriculture")} />}
        {active === "effluents" && <EffluentSource {...commonProps} entries={entriesOf("effluents")} />}
        {active === "land_use" && <LandUseSource {...commonProps} entries={entriesOf("land_use")} />}
        {active === "solid_waste" && <SolidWasteSource {...commonProps} entries={entriesOf("solid_waste")} inventoryYear={header.inventory_year} />}
        {active === "fuel_energy_upstream" && <FuelEnergyUpstreamSource {...commonProps} entries={entriesOf("fuel_energy_upstream")} />}
        {SCOPE3_GAS_ENTRY_CATEGORIES.includes(active as Scope3GasEntryCategory) && (
          <DirectGasEmissionSource
            {...commonProps}
            key={active}
            category={active as Scope3GasEntryCategory}
            entries={entriesOf(active)}
            title={SOURCES.find((s) => s.category === active)?.label ?? "Escopo 3"}
            description="Relate a massa emitida de cada gás desta categoria (a planilha usa o mesmo modelo na aba “Categorias de Escopo 3”). O CO₂e é calculado pelo GWP do próprio gás."
            sourceRefLabel="Registro da fonte"
            sourceRefPlaceholder="ex.: Fornecedor A"
            descriptionFieldLabel="Descrição"
          />
        )}
      </div>
    </section>
  );
}

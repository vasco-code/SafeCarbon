import type { SourceCategory, Scope } from "./engine/types";

// Metadados de apresentação das fontes: rótulo, escopo, e se já está
// implementada na Fase 1. Fontes futuras aparecem como abas "em breve"
// desabilitadas — adicionar aqui + no engine, sem migração.
export interface SourceMeta {
  category: SourceCategory | string;
  label: string;
  scope: Scope;
  implemented: boolean;
}

export const SOURCES: SourceMeta[] = [
  // Escopo 1
  { category: "stationary_combustion", label: "Combustão estacionária", scope: 1, implemented: true },
  { category: "mobile_combustion", label: "Combustão móvel", scope: 1, implemented: true },
  { category: "fugitive", label: "Emissões fugitivas", scope: 1, implemented: false },
  { category: "industrial_processes", label: "Processos industriais", scope: 1, implemented: true },
  { category: "agriculture", label: "Atividades de agricultura", scope: 1, implemented: true },
  { category: "land_use", label: "Mudança no uso do solo", scope: 1, implemented: false },
  { category: "solid_waste", label: "Resíduos sólidos", scope: 1, implemented: false },
  { category: "effluents", label: "Efluentes", scope: 1, implemented: false },
  // Escopo 2
  { category: "electricity_location", label: "Energia elétrica (localização)", scope: 2, implemented: true },
  { category: "electricity_market", label: "Energia elétrica (escolha de compra)", scope: 2, implemented: true },
  // Escopo 3
  { category: "purchased_goods", label: "Bens e serviços comprados", scope: 3, implemented: false },
  { category: "capital_goods", label: "Bens de capital", scope: 3, implemented: false },
  { category: "fuel_energy_upstream", label: "Atividades relacionadas a combustível e energia", scope: 3, implemented: true },
  { category: "transport_distribution_upstream", label: "Transporte e distribuição (upstream)", scope: 3, implemented: false },
  { category: "waste_generated_operations", label: "Resíduos gerados nas operações", scope: 3, implemented: false },
  { category: "business_travel", label: "Viagens a negócios", scope: 3, implemented: true },
  { category: "commuting", label: "Emissões casa-trabalho", scope: 3, implemented: true },
  { category: "transport_distribution_downstream", label: "Transporte e distribuição (downstream)", scope: 3, implemented: false },
];

export const SCOPE_LABELS: Record<Scope, string> = {
  1: "Escopo 1 — Emissões diretas",
  2: "Escopo 2 — Energia adquirida",
  3: "Escopo 3 — Outras emissões indiretas",
};

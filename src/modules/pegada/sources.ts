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
  { category: "fugitive", label: "Emissões fugitivas", scope: 1, implemented: true },
  { category: "industrial_processes", label: "Processos industriais", scope: 1, implemented: true },
  { category: "agriculture", label: "Atividades de agricultura", scope: 1, implemented: true },
  { category: "land_use", label: "Mudança no uso do solo", scope: 1, implemented: true },
  { category: "solid_waste", label: "Resíduos sólidos", scope: 1, implemented: true },
  { category: "effluents", label: "Efluentes", scope: 1, implemented: true },
  // Escopo 2 — as 5 abordagens da planilha (Resumo, linha 128)
  { category: "electricity_location", label: "Energia elétrica (localização)", scope: 2, implemented: true },
  { category: "td_losses_location", label: "Perdas T&D (localização)", scope: 2, implemented: true },
  { category: "electricity_market", label: "Energia elétrica (escolha de compra)", scope: 2, implemented: true },
  { category: "td_losses_market", label: "Perdas T&D (escolha de compra)", scope: 2, implemented: true },
  { category: "thermal_energy_purchased", label: "Compra de energia térmica", scope: 2, implemented: true },
  // Escopo 3 — as 15 categorias do GHG Protocol, na ordem oficial.
  { category: "purchased_goods", label: "1. Bens e serviços comprados", scope: 3, implemented: true },
  { category: "capital_goods", label: "2. Bens de capital", scope: 3, implemented: true },
  { category: "fuel_energy_upstream", label: "3. Atividades relacionadas a combustível e energia", scope: 3, implemented: true },
  { category: "transport_distribution_upstream", label: "4. Transporte e distribuição (upstream)", scope: 3, implemented: true },
  { category: "waste_generated_operations", label: "5. Resíduos gerados nas operações", scope: 3, implemented: true },
  { category: "business_travel", label: "6. Viagens a negócios", scope: 3, implemented: true },
  { category: "commuting", label: "7. Emissões casa-trabalho", scope: 3, implemented: true },
  { category: "leased_assets_upstream", label: "8. Bens arrendados (organização arrendatária)", scope: 3, implemented: true },
  { category: "transport_distribution_downstream", label: "9. Transporte e distribuição (downstream)", scope: 3, implemented: true },
  { category: "processing_sold_products", label: "10. Processamento de produtos vendidos", scope: 3, implemented: true },
  { category: "use_sold_products", label: "11. Uso de bens e serviços vendidos", scope: 3, implemented: true },
  { category: "end_of_life_sold_products", label: "12. Tratamento de fim de vida dos produtos vendidos", scope: 3, implemented: true },
  { category: "leased_assets_downstream", label: "13. Bens arrendados (organização arrendadora)", scope: 3, implemented: true },
  { category: "franchises", label: "14. Franquias", scope: 3, implemented: true },
  { category: "investments", label: "15. Investimentos", scope: 3, implemented: true },
];

export const SCOPE_LABELS: Record<Scope, string> = {
  1: "Escopo 1 — Emissões diretas",
  2: "Escopo 2 — Energia adquirida",
  3: "Escopo 3 — Outras emissões indiretas",
};

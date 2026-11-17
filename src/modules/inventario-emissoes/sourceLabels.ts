// Rótulos das fontes de emissão do inventário do projeto (emission_inventory_entries.source_type
// é texto livre no banco). Compartilhado entre o Inventário, o Anexo I do DCP e o relatório de
// monitoramento — antes cada um imprimia o código cru (ex.: "diesel_transport").
export type SourceType =
  | "biomass_combustion"
  | "diesel_transport"
  | "electricity"
  | "waste"
  | "upstream_inputs";

export const SOURCE_LABELS: Record<SourceType, string> = {
  biomass_combustion: "Combustão de biomassa (lenha)",
  diesel_transport: "Combustível fóssil (diesel)",
  electricity: "Energia elétrica",
  waste: "Resíduos",
  upstream_inputs: "Insumos do aditivo, a montante",
};

// Fontes lançadas direto em tCO2e (sem fator de emissão): resíduos e insumos
// vêm de cálculo próprio documentado no DCP, então a justificativa é obrigatória.
export const DIRECT_SOURCES: SourceType[] = ["waste", "upstream_inputs"];

export function sourceLabel(sourceType: string): string {
  return SOURCE_LABELS[sourceType as SourceType] ?? sourceType;
}

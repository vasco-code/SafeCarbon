// Potencial de Aquecimento Global (GWP) — a ferramenta GHG Protocol v2026.0.1
// usa os valores do IPCC AR5 (IPCC 2013), Tabela 23. O banco (ghg_gwp) é a
// fonte de verdade em runtime; estas constantes são o fallback/documentação e
// alimentam os testes de paridade. Divergência de GWP é a causa nº 1 de o
// total não bater com a planilha, então a versão fica explícita.

export const AR_VERSION = "AR5";

// Rótulos em português dos gases mais comuns (Processos industriais/
// Agricultura). Famílias HFC/PFC já são razoavelmente legíveis como chave.
export const GAS_LABELS: Record<string, string> = {
  CO2: "Dióxido de carbono (CO2)",
  CH4: "Metano (CH4)",
  N2O: "Óxido nitroso (N2O)",
  SF6: "Hexafluoreto de enxofre (SF6)",
  NF3: "Trifluoreto de nitrogênio (NF3)",
};

export const GWP_AR5: Record<string, number> = {
  CO2: 1,
  CH4: 28,
  N2O: 265,
  SF6: 23500,
  NF3: 16100,
  "HFC-23": 12400,
  "HFC-32": 677,
  "HFC-41": 116,
  "HFC-125": 3170,
  "HFC-134": 1120,
  "HFC-134a": 1300,
  "HFC-143": 328,
  "HFC-143a": 4800,
  "HFC-152": 16,
  "HFC-152a": 138,
  "HFC-161": 4,
  "HFC-227ea": 3350,
  "HFC-236cb": 1210,
  "HFC-236ea": 1330,
  "HFC-236fa": 8060,
  "HFC-245ca": 716,
  "HFC-245fa": 858,
  "HFC-365mfc": 804,
  "HFC-43-10mee": 1650,
  "PFC-14": 6630,
  "PFC-116": 11100,
  "PFC-218": 8900,
  "PFC-318": 9540,
  "PFC-3-1-10": 9200,
  "PFC-4-1-12": 8550,
  "PFC-5-1-14": 7910,
  "PFC-9-1-18": 7190,
};

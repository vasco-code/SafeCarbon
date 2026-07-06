import * as XLSX from "xlsx";
import shp from "shpjs";

export interface ImportedSite {
  label: string;
  latitude: number;
  longitude: number;
}

const LAT_KEYS = ["latitude", "lat", "y"];
const LNG_KEYS = ["longitude", "long", "lng", "lon", "x"];
const LABEL_KEYS = ["label", "nome", "name", "local", "ponto", "site", "descricao", "identificacao"];

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const index = normalized.findIndex((h) => h === candidate || h.includes(candidate));
    if (index !== -1) return index;
  }
  return -1;
}

// Aceita CSV ou XLSX/XLS — a biblioteca `xlsx` (SheetJS) lê os três formatos
// pela mesma API. Detecta colunas de label/latitude/longitude por nome
// (tolerante a variações comuns em português/inglês); se não encontrar
// latitude/longitude, não há como importar.
export async function parseSpreadsheetToSites(file: File): Promise<ImportedSite[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, blankrows: false });

  if (rows.length < 2) {
    throw new Error("A planilha precisa de uma linha de cabeçalho e ao menos uma linha de dados.");
  }

  const headers = (rows[0] as unknown[]).map((h) => String(h ?? ""));
  const latIndex = findColumn(headers, LAT_KEYS);
  const lngIndex = findColumn(headers, LNG_KEYS);
  const labelIndex = findColumn(headers, LABEL_KEYS);

  if (latIndex === -1 || lngIndex === -1) {
    throw new Error(
      `Não encontrei colunas de latitude/longitude no cabeçalho (${headers.join(", ")}). Renomeie as colunas para algo como "latitude"/"longitude".`,
    );
  }

  const sites: ImportedSite[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const latitude = Number(row[latIndex]);
    const longitude = Number(row[lngIndex]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const label = labelIndex !== -1 ? String(row[labelIndex] ?? "").trim() : "";
    sites.push({ label: label || `Ponto ${i}`, latitude, longitude });
  }
  return sites;
}

function centroidOfRing(ring: number[][]): [number, number] {
  const [sumLng, sumLat] = ring.reduce(
    ([accLng, accLat], [lng, lat]) => [accLng + lng, accLat + lat],
    [0, 0],
  );
  return [sumLng / ring.length, sumLat / ring.length];
}

// shpjs devolve GeoJSON — pontos usam a coordenada direta; polígonos usam uma
// aproximação simples (centróide da primeira ring), suficiente para marcar
// "onde fica" a área no mapa sem precisar de uma lib de geometria completa.
function geometryToLngLat(geometry: GeoJSON.Geometry | null): [number, number] | null {
  if (!geometry) return null;
  switch (geometry.type) {
    case "Point":
      return geometry.coordinates as [number, number];
    case "MultiPoint":
      return (geometry.coordinates[0] as [number, number]) ?? null;
    case "Polygon":
      return centroidOfRing(geometry.coordinates[0]);
    case "MultiPolygon":
      return centroidOfRing(geometry.coordinates[0][0]);
    case "LineString":
      return centroidOfRing(geometry.coordinates as number[][]);
    default:
      return null;
  }
}

function pickLabel(properties: GeoJSON.GeoJsonProperties, index: number): string {
  if (!properties) return `Ponto ${index}`;
  for (const key of Object.keys(properties)) {
    if (LABEL_KEYS.includes(key.toLowerCase())) {
      const value = properties[key];
      if (value) return String(value);
    }
  }
  return `Ponto ${index}`;
}

// Shapefile é sempre um conjunto de arquivos (.shp/.dbf/.shx/...) — o jeito
// prático de fazer upload de um único arquivo é zipar tudo junto; shpjs lê
// esse .zip diretamente.
export async function parseShapefileToSites(file: File): Promise<ImportedSite[]> {
  const buffer = await file.arrayBuffer();
  const result = await shp(buffer);
  const collection = Array.isArray(result) ? result[0] : result;
  if (!collection) {
    throw new Error("Não foi possível ler nenhuma camada do shapefile.");
  }

  const sites: ImportedSite[] = [];
  collection.features.forEach((feature, index) => {
    const lngLat = geometryToLngLat(feature.geometry);
    if (!lngLat) return;
    sites.push({
      label: pickLabel(feature.properties, index + 1),
      longitude: lngLat[0],
      latitude: lngLat[1],
    });
  });

  if (sites.length === 0) {
    throw new Error("Nenhum ponto/área com geometria reconhecível foi encontrado no shapefile.");
  }
  return sites;
}

export async function parseGeoFile(file: File): Promise<ImportedSite[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) {
    return parseShapefileToSites(file);
  }
  if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseSpreadsheetToSites(file);
  }
  throw new Error("Formato não suportado — use .csv, .xlsx, .xls ou um shapefile .zip.");
}

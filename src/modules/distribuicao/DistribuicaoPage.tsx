import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPinned, FileWarning, FileCheck2 } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { parseGeoFile, type ImportedSite } from "@/lib/geoImport";
import { supabase } from "@/lib/supabase";

interface ProjectSite {
  id: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  safegistrace_analysis_id: string | null;
}

// Basemap de satélite (Esri World Imagery) + camada de rótulos (Esri World
// Boundaries and Places) — ambos serviços públicos do ArcGIS Online, sem
// chave/custo. Trocar por um estilo próprio da Safe Trace se/quando existir.
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
    "esri-labels": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: "esri-satellite", type: "raster", source: "esri-satellite" },
    { id: "esri-labels", type: "raster", source: "esri-labels" },
  ],
};

export function DistribuicaoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importRows, setImportRows] = useState<ImportedSite[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  async function loadSites() {
    if (!projectId) return;
    const { data } = await supabase
      .from("project_sites")
      .select("id, label, latitude, longitude, safegistrace_analysis_id")
      .eq("project_id", projectId)
      .order("label");
    setSites(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadSites();
  }, [projectId]);

  // Cria o mapa uma vez só, independente de já haver pontos.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [-49, -17],
      zoom: 4,
    });
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Redesenha os marcadores sempre que a lista de pontos muda.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new maplibregl.LngLatBounds();
    for (const site of sites) {
      if (site.latitude == null || site.longitude == null) continue;
      const lngLat: [number, number] = [site.longitude, site.latitude];
      const marker = new maplibregl.Marker({ color: "#4c56ad" })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup().setText(site.label))
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend(lngLat);
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 7 });
    }
  }, [sites]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.from("project_sites").insert({
      project_id: projectId,
      label,
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
    } else {
      setLabel("");
      setLatitude("");
      setLongitude("");
      loadSites();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este ponto de distribuição?")) return;
    const { error } = await supabase.from("project_sites").delete().eq("id", id);
    if (error) {
      setError(error.message);
    } else {
      loadSites();
    }
  }

  async function handleImportFiles(files: File[]) {
    setImportError(null);
    const file = files[0];
    try {
      const rows = await parseGeoFile(file);
      setImportRows(rows);
    } catch (err) {
      setImportRows([]);
      setImportError(err instanceof Error ? err.message : "Erro ao ler o arquivo.");
    }
  }

  async function handleConfirmImport() {
    if (!projectId || importRows.length === 0) return;
    setImporting(true);
    setImportError(null);
    const { error } = await supabase.from("project_sites").insert(
      importRows.map((row) => ({
        project_id: projectId,
        label: row.label,
        latitude: row.latitude,
        longitude: row.longitude,
      })),
    );
    setImporting(false);
    if (error) {
      setImportError(error.message);
    } else {
      setImportRows([]);
      loadSites();
    }
  }

  return (
    <section>
      <h2 className="module-heading">
        <MapPinned size={20} /> Distribuição Geográfica
      </h2>
      <p>Pontos de distribuição do Fator P (equivalente à Figura 5 do DCP).</p>

      <form onSubmit={handleCreate}>
        <label htmlFor="site-label">Local</label>
        <input id="site-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} required />

        <label htmlFor="site-lat">Latitude</label>
        <input
          id="site-lat"
          type="number"
          step="0.000001"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          required
        />

        <label htmlFor="site-lng">Longitude</label>
        <input
          id="site-lng"
          type="number"
          step="0.000001"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          required
        />

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Adicionando..." : "Adicionar ponto"}
        </button>
      </form>

      <h3 style={{ marginTop: "2rem" }}>Importar em massa</h3>
      <p style={{ marginBottom: "0.75rem" }}>
        Envie uma planilha (CSV/XLSX, com colunas de latitude/longitude) ou um shapefile zipado
        (.zip com .shp/.dbf/.shx) para cadastrar vários pontos de uma vez.
      </p>
      <FileDropzone
        accept=".csv,.xlsx,.xls,.zip"
        onFiles={handleImportFiles}
        label="Arraste a planilha ou o shapefile (.zip) aqui"
        hint="CSV, XLSX, XLS ou ZIP contendo shapefile"
      />

      {importError && <p className="auth-error">{importError}</p>}

      {importRows.length > 0 && (
        <div className="nfe-preview" style={{ maxWidth: "none" }}>
          <p>{importRows.length} ponto(s) reconhecido(s), prontos para importar:</p>
          <ul className="file-batch-list" style={{ listStyle: "none", paddingLeft: 0, maxHeight: "220px", overflowY: "auto" }}>
            {importRows.slice(0, 50).map((row, i) => (
              <li key={`${row.label}-${i}`} className="file-batch-item">
                <FileCheck2 size={16} color="var(--sc-success)" />
                <span className="file-batch-name">
                  {row.label} — {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                </span>
              </li>
            ))}
            {importRows.length > 50 && (
              <li className="file-batch-item">
                <FileWarning size={16} />
                <span className="file-batch-name">…e mais {importRows.length - 50} ponto(s).</span>
              </li>
            )}
          </ul>
          <button type="button" onClick={handleConfirmImport} disabled={importing}>
            {importing ? "Importando..." : `Importar ${importRows.length} ponto(s)`}
          </button>
        </div>
      )}

      {loading && <p>Carregando...</p>}

      <div ref={mapContainerRef} style={{ width: "100%", height: "480px", borderRadius: "10px", marginTop: "1.5rem" }} />

      {!loading && sites.length === 0 && (
        <div className="empty-state">
          <p>Nenhum ponto de distribuição cadastrado ainda. Use o formulário acima para adicionar o primeiro.</p>
        </div>
      )}

      {sites.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Local</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Análise SafeGisTrace</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td>{s.latitude}</td>
                <td>{s.longitude}</td>
                <td>{s.safegistrace_analysis_id ?? "—"}</td>
                <td className="row-actions">
                  <button type="button" className="btn-icon-danger" onClick={() => handleDelete(s.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

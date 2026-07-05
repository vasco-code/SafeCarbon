import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "@/lib/supabase";

interface ProjectSite {
  id: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  safegistrace_analysis_id: string | null;
}

// Estilo de demonstração público do MapLibre — sem chave/custo, suficiente
// para o mapa de distribuição (DCP Figura 5). Trocar por um estilo próprio da
// Safe Trace se/quando existir.
const MAP_STYLE = "https://demotiles.maplibre.org/style.json";

export function DistribuicaoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

  return (
    <section>
      <h1>Distribuição Geográfica</h1>
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

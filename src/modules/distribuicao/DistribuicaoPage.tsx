import { useEffect, useRef, useState } from "react";
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("project_sites")
      .select("id, label, latitude, longitude, safegistrace_analysis_id")
      .eq("project_id", projectId)
      .then(({ data }) => {
        setSites(data ?? []);
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    if (!mapContainerRef.current || sites.length === 0 || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [-49, -17],
      zoom: 4,
    });
    mapRef.current = map;

    const bounds = new maplibregl.LngLatBounds();
    for (const site of sites) {
      if (site.latitude == null || site.longitude == null) continue;
      const lngLat: [number, number] = [site.longitude, site.latitude];
      new maplibregl.Marker({ color: "#34d399" })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup().setText(site.label))
        .addTo(map);
      bounds.extend(lngLat);
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 7 });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [sites]);

  return (
    <section>
      <h1>Distribuição Geográfica</h1>
      <p>Pontos de distribuição do Fator P (equivalente à Figura 5 do DCP).</p>

      {loading && <p>Carregando...</p>}
      {!loading && sites.length === 0 && <p>Nenhum ponto de distribuição cadastrado.</p>}

      <div ref={mapContainerRef} style={{ width: "100%", height: "480px", borderRadius: "10px" }} />

      {sites.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Local</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Análise SafeGisTrace</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td>{s.latitude}</td>
                <td>{s.longitude}</td>
                <td>{s.safegistrace_analysis_id ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

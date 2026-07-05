import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface MethodologyVersionRow {
  id: string;
  version_label: string;
  status: string;
  published_at: string | null;
  methodologies: { name: string; sector: string } | null;
}

export function MetodologiaListPage() {
  const [versions, setVersions] = useState<MethodologyVersionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("methodology_versions")
      .select("id, version_label, status, published_at, methodologies(name, sector)")
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setVersions((data ?? []) as unknown as MethodologyVersionRow[]);
        setLoading(false);
      });
  }, []);

  return (
    <section>
      <h1>Metodologias</h1>
      <p>Biblioteca de metodologias disponíveis para consulta pública.</p>

      {loading && <p>Carregando...</p>}

      {!loading && versions.length === 0 && <p>Nenhuma metodologia publicada ainda.</p>}

      {!loading && versions.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Metodologia</th>
              <th>Setor</th>
              <th>Versão</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td>{v.methodologies?.name}</td>
                <td>{v.methodologies?.sector}</td>
                <td>{v.version_label}</td>
                <td>{v.status}</td>
                <td>
                  <Link to={`/metodologias/${v.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

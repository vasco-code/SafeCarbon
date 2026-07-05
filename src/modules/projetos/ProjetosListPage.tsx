import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ProjectRow {
  id: string;
  name: string;
  status: string;
}

export function ProjetosListPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("carbon_projects")
      .select("id, name, status")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setProjects(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <section>
      <h1>Projetos de Carbono</h1>
      <p>Lista de projetos ativos, em validação e encerrados.</p>

      {loading && <p>Carregando...</p>}
      {!loading && projects.length === 0 && <p>Nenhum projeto disponível para sua organização.</p>}

      {!loading && projects.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Projeto</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.status}</td>
                <td>
                  <Link to={`/projetos/${p.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

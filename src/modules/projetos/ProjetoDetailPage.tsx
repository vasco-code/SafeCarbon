import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ProjectDetail {
  id: string;
  name: string;
  status: string;
  registry_standard: string;
  methodology_versions: {
    version_label: string;
    methodologies: { name: string } | null;
  } | null;
}

export function ProjetoDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("carbon_projects")
      .select("id, name, status, registry_standard, methodology_versions(version_label, methodologies(name))")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => {
        setProject(data as unknown as ProjectDetail | null);
        setLoading(false);
      });
  }, [projectId]);

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (!project) {
    return (
      <section>
        <h1>Projeto</h1>
        <p>Projeto não encontrado, ou você não tem acesso a ele.</p>
      </section>
    );
  }

  return (
    <section>
      <h1>{project.name}</h1>
      <p>
        Status: {project.status}
        {project.methodology_versions && (
          <>
            {" "}
            · Metodologia: {project.methodology_versions.methodologies?.name} v
            {project.methodology_versions.version_label}
          </>
        )}
      </p>

      <ul className="project-nav-list">
        <li>
          <Link to={`/projetos/${project.id}/producao`}>Produção</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/comercializacao`}>Comercialização</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/inventario`}>Inventário de emissões</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/vazamentos`}>Avaliação de vazamentos</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/ciclos/${new Date().getFullYear()}`}>Ciclo de créditos</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/verificacao`}>Verificação</Link>
        </li>
        <li>
          <Link to={`/projetos/${project.id}/dcp`}>DCP</Link>
        </li>
      </ul>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useParams, Link } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, FileText, FolderOpen, Calculator, ShieldCheck, Coins } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProjectRole } from "@/hooks/useProjectRole";

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

const STATUS_LABELS: Record<string, string> = {
  design: "Em design",
  validation: "Em validação",
  active: "Ativo",
  suspended: "Suspenso",
  closed: "Encerrado",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  design: "badge-neutral",
  validation: "badge-info",
  active: "badge-success",
  suspended: "badge-warning",
  closed: "badge-neutral",
};

export function ProjetoLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const tabsRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const { accessLevel, loading: roleLoading } = useProjectRole(projectId);

  useEffect(() => {
    const active = tabsRef.current?.querySelector(".project-tab.active");
    active?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [location.pathname]);

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

  if (loading || roleLoading) {
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

  const base = `/projetos/${project.id}`;

  // Navegação simplificada por perfil de acesso: Premix (proponent) e VVB
  // (verifier) só veem Visão Geral + Descritivo; Verificação é exclusiva de
  // VVB (só a área de upload) e de developer/admin/platform_admin (ciclo
  // completo); Documentos/Cálculo/Comercialização de Créditos são só de
  // developer/admin/platform_admin ('full').
  const tabs = [
    { to: base, end: true, icon: LayoutDashboard, label: "Visão Geral", show: true },
    { to: `${base}/descritivo`, icon: FileText, label: "Descritivo do projeto", show: true },
    { to: `${base}/documentos`, icon: FolderOpen, label: "Documentos", show: accessLevel === "full" },
    { to: `${base}/calculo`, icon: Calculator, label: "Cálculo das emissões e remoções", show: accessLevel === "full" },
    { to: `${base}/verificacao`, icon: ShieldCheck, label: "Verificação", show: accessLevel === "full" || accessLevel === "verifier" },
    { to: `${base}/comercializacao-creditos`, icon: Coins, label: "Comercialização de créditos", show: accessLevel === "full" },
  ].filter((tab) => tab.show);

  return (
    <section className="project-shell">
      <Link to="/projetos" className="project-back-link">
        <ArrowLeft size={14} /> Projetos
      </Link>

      <div className="project-header">
        <h1>{project.name}</h1>
        <span className={`badge ${STATUS_BADGE_CLASS[project.status] ?? "badge-neutral"}`}>
          {STATUS_LABELS[project.status] ?? project.status}
        </span>
      </div>
      {project.methodology_versions && (
        <p className="project-subtitle">
          {project.methodology_versions.methodologies?.name} v{project.methodology_versions.version_label}
        </p>
      )}

      <nav className="project-tabs" aria-label="Módulos do projeto" ref={tabsRef}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `project-tab${isActive ? " active" : ""}`}
          >
            <tab.icon size={15} />
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="project-tab-content">
        <Outlet />
      </div>
    </section>
  );
}

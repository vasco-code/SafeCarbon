import { supabase } from "@/lib/supabase";

export interface ProjectOption {
  id: string;
  name: string;
}

// Projetos de que a organização participa como proponente ou desenvolvedora —
// os candidatos a vínculo de um inventário da Pegada.
export async function loadOrgProjects(orgId: string): Promise<ProjectOption[]> {
  const { data } = await supabase
    .from("project_roles")
    .select("carbon_projects(id, name)")
    .eq("org_id", orgId)
    .in("role", ["proponent", "developer"]);
  const rows = (data ?? []) as unknown as { carbon_projects: ProjectOption | null }[];
  const unique = new Map(rows.filter((r) => r.carbon_projects).map((r) => [r.carbon_projects!.id, r.carbon_projects!]));
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

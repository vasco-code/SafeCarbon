import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export type ProjectAccessLevel = "full" | "proponent" | "verifier" | null;

// 'full' cobre developer/admin de projeto OU platform admin — quem tem
// acesso total à navegação nova (Documentos, Cálculo, Comercialização de
// Créditos, Verificação completa). 'proponent'/'verifier' são os dois
// perfis restritos (Premix/VVB) definidos na reestruturação de acesso.
// `orgId` é a organização do usuário que sustenta esse papel — útil para
// metadados de escrita (uploaded_by_org_id etc.); platform_admin sem
// vínculo direto de project_roles devolve `orgId: null`.
export function useProjectRole(projectId: string | undefined) {
  const { memberships, isPlatformAdmin } = useAuth();
  const [accessLevel, setAccessLevel] = useState<ProjectAccessLevel>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!projectId) {
        setAccessLevel(null);
        setOrgId(null);
        setLoading(false);
        return;
      }

      const orgIds = memberships.map((m) => m.orgId);
      if (orgIds.length === 0) {
        setAccessLevel(isPlatformAdmin ? "full" : null);
        setOrgId(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("project_roles")
        .select("role, org_id")
        .eq("project_id", projectId)
        .in("org_id", orgIds);

      if (cancelled) return;

      const rows = data ?? [];
      const fullRow = rows.find((r) => r.role === "developer" || r.role === "admin");
      const proponentRow = rows.find((r) => r.role === "proponent");
      const verifierRow = rows.find((r) => r.role === "verifier");

      if (fullRow) {
        setAccessLevel("full");
        setOrgId(fullRow.org_id);
      } else if (isPlatformAdmin) {
        setAccessLevel("full");
        setOrgId(null);
      } else if (proponentRow) {
        setAccessLevel("proponent");
        setOrgId(proponentRow.org_id);
      } else if (verifierRow) {
        setAccessLevel("verifier");
        setOrgId(verifierRow.org_id);
      } else {
        setAccessLevel(null);
        setOrgId(null);
      }
      setLoading(false);
    }

    setLoading(true);
    resolve();

    return () => {
      cancelled = true;
    };
  }, [projectId, isPlatformAdmin, memberships]);

  return { accessLevel, orgId, loading };
}

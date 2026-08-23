import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Calculator } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ProducaoPage } from "@/modules/producao-comercializacao/ProducaoPage";
import { ComercializacaoPage } from "@/modules/producao-comercializacao/ComercializacaoPage";
import { InventarioPage } from "@/modules/inventario-emissoes/InventarioPage";
import { VazamentosPage } from "@/modules/inventario-emissoes/VazamentosPage";
import { CicloCalculoPage } from "@/modules/creditos/CicloCalculoPage";

// Composição das 4 páginas que antes eram abas separadas (Produção,
// Comercialização, Inventário, Vazamentos, Ciclo de Créditos) — cada
// componente já busca `projectId` via useParams, então funciona sem
// alteração como seção desta página única. CicloCalculoPage foi ajustada
// para ter seletor de ano próprio, sem depender do segmento de rota
// /ciclos/:year.
export function CalculoEmissoesRemocoesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [hideComercializacao, setHideComercializacao] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from("carbon_projects")
      .select("hide_commercialization_section")
      .eq("id", projectId)
      .maybeSingle()
      .then(({ data }) => setHideComercializacao(data?.hide_commercialization_section ?? false));
  }, [projectId]);

  return (
    <section>
      <h2 className="module-heading">
        <Calculator size={20} /> Cálculo das Emissões e Remoções
      </h2>
      <p>Produção, comercialização do produto, inventário de emissões, vazamentos e ciclo de créditos do projeto.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
        <div style={{ borderTop: "1px solid var(--sc-border)", paddingTop: "1.5rem" }}>
          <ProducaoPage />
        </div>
        {!hideComercializacao && (
          <div style={{ borderTop: "1px solid var(--sc-border)", paddingTop: "1.5rem" }}>
            <ComercializacaoPage />
          </div>
        )}
        <div style={{ borderTop: "1px solid var(--sc-border)", paddingTop: "1.5rem" }}>
          <InventarioPage />
        </div>
        <div style={{ borderTop: "1px solid var(--sc-border)", paddingTop: "1.5rem" }}>
          <VazamentosPage />
        </div>
        <div style={{ borderTop: "1px solid var(--sc-border)", paddingTop: "1.5rem" }}>
          <CicloCalculoPage />
        </div>
      </div>
    </section>
  );
}

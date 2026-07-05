import { Navigate, Route, Routes } from "react-router-dom";
import { MetodologiaListPage } from "@/modules/metodologia/MetodologiaListPage";
import { MetodologiaDetailPage } from "@/modules/metodologia/MetodologiaDetailPage";
import { ProjetosListPage } from "@/modules/projetos/ProjetosListPage";
import { ProjetoDetailPage } from "@/modules/projetos/ProjetoDetailPage";
import { DcpEditorPage } from "@/modules/projetos/DcpEditorPage";
import { ProducaoPage } from "@/modules/producao-comercializacao/ProducaoPage";
import { ComercializacaoPage } from "@/modules/producao-comercializacao/ComercializacaoPage";
import { InventarioPage } from "@/modules/inventario-emissoes/InventarioPage";
import { VazamentosPage } from "@/modules/inventario-emissoes/VazamentosPage";
import { CicloCalculoPage } from "@/modules/creditos/CicloCalculoPage";
import { VerificacaoPage } from "@/modules/creditos/VerificacaoPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projetos" replace />} />

      <Route path="/metodologias" element={<MetodologiaListPage />} />
      <Route path="/metodologias/:versionId" element={<MetodologiaDetailPage />} />

      <Route path="/projetos" element={<ProjetosListPage />} />
      <Route path="/projetos/:projectId" element={<ProjetoDetailPage />} />
      <Route path="/projetos/:projectId/dcp" element={<DcpEditorPage />} />
      <Route path="/projetos/:projectId/producao" element={<ProducaoPage />} />
      <Route
        path="/projetos/:projectId/comercializacao"
        element={<ComercializacaoPage />}
      />
      <Route path="/projetos/:projectId/inventario" element={<InventarioPage />} />
      <Route path="/projetos/:projectId/vazamentos" element={<VazamentosPage />} />
      <Route
        path="/projetos/:projectId/ciclos/:year"
        element={<CicloCalculoPage />}
      />
      <Route
        path="/projetos/:projectId/verificacao"
        element={<VerificacaoPage />}
      />
    </Routes>
  );
}

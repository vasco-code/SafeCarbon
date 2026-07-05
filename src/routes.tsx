import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/modules/auth/LoginPage";
import { ForgotPasswordPage } from "@/modules/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/modules/auth/ResetPasswordPage";
import { ContaPage } from "@/modules/conta/ContaPage";
import { UsuariosPage } from "@/modules/admin/UsuariosPage";
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
import { DistribuicaoPage } from "@/modules/distribuicao/DistribuicaoPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/projetos" replace />} />

        <Route path="/conta" element={<ContaPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />

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
        <Route
          path="/projetos/:projectId/distribuicao"
          element={<DistribuicaoPage />}
        />
      </Route>
    </Routes>
  );
}

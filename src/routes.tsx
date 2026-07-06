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
import { ProjetoLayout } from "@/modules/projetos/ProjetoLayout";
import { ProjetoOverviewPage } from "@/modules/projetos/ProjetoOverviewPage";
import { DcpEditorPage } from "@/modules/projetos/DcpEditorPage";
import { ProducaoPage } from "@/modules/producao-comercializacao/ProducaoPage";
import { ComercializacaoPage } from "@/modules/producao-comercializacao/ComercializacaoPage";
import { InventarioPage } from "@/modules/inventario-emissoes/InventarioPage";
import { VazamentosPage } from "@/modules/inventario-emissoes/VazamentosPage";
import { RelatorioEmissoesPage } from "@/modules/inventario-emissoes/RelatorioEmissoesPage";
import { CicloCalculoPage } from "@/modules/creditos/CicloCalculoPage";
import { VerificacaoPage } from "@/modules/creditos/VerificacaoPage";
import { DistribuicaoPage } from "@/modules/distribuicao/DistribuicaoPage";
import { VerificarTokenPage } from "@/modules/verificacao-publica/VerificarTokenPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/verificar/:tokenId" element={<VerificarTokenPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/projetos" replace />} />

        <Route path="/conta" element={<ContaPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />

        <Route path="/metodologias" element={<MetodologiaListPage />} />
        <Route path="/metodologias/:versionId" element={<MetodologiaDetailPage />} />

        <Route path="/projetos" element={<ProjetosListPage />} />
        <Route path="/projetos/:projectId" element={<ProjetoLayout />}>
          <Route index element={<ProjetoOverviewPage />} />
          <Route path="dcp" element={<DcpEditorPage />} />
          <Route path="producao" element={<ProducaoPage />} />
          <Route path="comercializacao" element={<ComercializacaoPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="vazamentos" element={<VazamentosPage />} />
          <Route path="relatorio-emissoes" element={<RelatorioEmissoesPage />} />
          <Route path="ciclos/:year" element={<CicloCalculoPage />} />
          <Route path="verificacao" element={<VerificacaoPage />} />
          <Route path="distribuicao" element={<DistribuicaoPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

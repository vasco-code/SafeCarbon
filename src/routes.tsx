import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/modules/auth/LoginPage";
import { ForgotPasswordPage } from "@/modules/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/modules/auth/ResetPasswordPage";
import { ContaPage } from "@/modules/conta/ContaPage";
import { UsuariosPage } from "@/modules/admin/UsuariosPage";
import { OrganizacoesPage } from "@/modules/admin/OrganizacoesPage";
import { BrandingAdminPage } from "@/modules/admin/BrandingAdminPage";
import { AuditoriaPage } from "@/modules/auditoria/AuditoriaPage";
import { MetodologiaListPage } from "@/modules/metodologia/MetodologiaListPage";
import { MetodologiaDetailPage } from "@/modules/metodologia/MetodologiaDetailPage";
import { ProjetosListPage } from "@/modules/projetos/ProjetosListPage";
import { ProjetoLayout } from "@/modules/projetos/ProjetoLayout";
import { ProjetoOverviewPage } from "@/modules/projetos/ProjetoOverviewPage";
import { DescritivoProjetoPage } from "@/modules/projetos/DescritivoProjetoPage";
import { DocumentosPage } from "@/modules/projetos/DocumentosPage";
import { CalculoEmissoesRemocoesPage } from "@/modules/projetos/CalculoEmissoesRemocoesPage";
import { ComercializacaoCreditosPage } from "@/modules/projetos/ComercializacaoCreditosPage";
import { DcpEditorPage } from "@/modules/projetos/DcpEditorPage";
import { ProducaoPage } from "@/modules/producao-comercializacao/ProducaoPage";
import { ComercializacaoPage } from "@/modules/producao-comercializacao/ComercializacaoPage";
import { InventarioPage } from "@/modules/inventario-emissoes/InventarioPage";
import { VazamentosPage } from "@/modules/inventario-emissoes/VazamentosPage";
import { RelatorioEmissoesPage } from "@/modules/inventario-emissoes/RelatorioEmissoesPage";
import { CicloCalculoPage } from "@/modules/creditos/CicloCalculoPage";
import { VerificacaoPage } from "@/modules/creditos/VerificacaoPage";
import { DistribuicaoPage } from "@/modules/distribuicao/DistribuicaoPage";
import { CarteiraAtivosPage } from "@/modules/carteira/CarteiraAtivosPage";
import { VerificarTokenPage } from "@/modules/verificacao-publica/VerificarTokenPage";
import Index from "@/pages/Index";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/verificar/:tokenId" element={<VerificarTokenPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/projetos" replace />} />

        <Route path="/conta" element={<ContaPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/admin/organizacoes" element={<OrganizacoesPage />} />
        <Route path="/admin/branding" element={<BrandingAdminPage />} />
        <Route path="/auditoria" element={<AuditoriaPage />} />
        <Route path="/carteira" element={<CarteiraAtivosPage />} />

        <Route path="/metodologias" element={<MetodologiaListPage />} />
        <Route path="/metodologias/:versionId" element={<MetodologiaDetailPage />} />

        <Route path="/projetos" element={<ProjetosListPage />} />
        <Route path="/projetos/:projectId" element={<ProjetoLayout />}>
          <Route index element={<ProjetoOverviewPage />} />
          <Route path="descritivo" element={<DescritivoProjetoPage />} />
          <Route path="documentos" element={<DocumentosPage />} />
          <Route path="calculo" element={<CalculoEmissoesRemocoesPage />} />
          <Route path="verificacao" element={<VerificacaoPage />} />
          <Route path="comercializacao-creditos" element={<ComercializacaoCreditosPage />} />

          {/* Rotas antigas — mantidas por compatibilidade (links diretos,
              DCP export) até a migration de afunilamento de RLS (etapa
              final) ser aplicada; não aparecem mais como abas em
              ProjetoLayout, o conteúdo delas passou a viver como seções de
              CalculoEmissoesRemocoesPage/DescritivoProjetoPage. */}
          <Route path="dcp" element={<DcpEditorPage />} />
          <Route path="producao" element={<ProducaoPage />} />
          <Route path="comercializacao" element={<ComercializacaoPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="vazamentos" element={<VazamentosPage />} />
          <Route path="relatorio-emissoes" element={<RelatorioEmissoesPage />} />
          <Route path="ciclos/:year" element={<CicloCalculoPage />} />
          <Route path="distribuicao" element={<DistribuicaoPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

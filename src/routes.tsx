import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/modules/auth/LoginPage";
import { ForgotPasswordPage } from "@/modules/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/modules/auth/ResetPasswordPage";
import { BrandingAdminPage } from "@/modules/admin/BrandingAdminPage";
import Index from "@/pages/Index";

// Lazy load admin and less frequently accessed pages
const ContaPage = lazy(() => import("@/modules/conta/ContaPage").then(m => ({ default: m.ContaPage })));
const UsuariosPage = lazy(() => import("@/modules/admin/UsuariosPage").then(m => ({ default: m.UsuariosPage })));
const OrganizacoesPage = lazy(() => import("@/modules/admin/OrganizacoesPage").then(m => ({ default: m.OrganizacoesPage })));
const AuditoriaPage = lazy(() => import("@/modules/auditoria/AuditoriaPage").then(m => ({ default: m.AuditoriaPage })));

// Lazy load methodology pages
const MetodologiaListPage = lazy(() => import("@/modules/metodologia/MetodologiaListPage").then(m => ({ default: m.MetodologiaListPage })));
const MetodologiaDetailPage = lazy(() => import("@/modules/metodologia/MetodologiaDetailPage").then(m => ({ default: m.MetodologiaDetailPage })));

// Lazy load projeto-related pages
const ProjetosListPage = lazy(() => import("@/modules/projetos/ProjetosListPage").then(m => ({ default: m.ProjetosListPage })));
const ProjetoLayout = lazy(() => import("@/modules/projetos/ProjetoLayout").then(m => ({ default: m.ProjetoLayout })));
const ProjetoOverviewPage = lazy(() => import("@/modules/projetos/ProjetoOverviewPage").then(m => ({ default: m.ProjetoOverviewPage })));
const DcpEditorPage = lazy(() => import("@/modules/projetos/DcpEditorPage").then(m => ({ default: m.DcpEditorPage })));

// Lazy load producao-comercializacao pages
const ProducaoPage = lazy(() => import("@/modules/producao-comercializacao/ProducaoPage").then(m => ({ default: m.ProducaoPage })));
const ComercializacaoPage = lazy(() => import("@/modules/producao-comercializacao/ComercializacaoPage").then(m => ({ default: m.ComercializacaoPage })));

// Lazy load inventario pages
const InventarioPage = lazy(() => import("@/modules/inventario-emissoes/InventarioPage").then(m => ({ default: m.InventarioPage })));
const VazamentosPage = lazy(() => import("@/modules/inventario-emissoes/VazamentosPage").then(m => ({ default: m.VazamentosPage })));
const RelatorioEmissoesPage = lazy(() => import("@/modules/inventario-emissoes/RelatorioEmissoesPage").then(m => ({ default: m.RelatorioEmissoesPage })));

// Lazy load creditos pages
const CicloCalculoPage = lazy(() => import("@/modules/creditos/CicloCalculoPage").then(m => ({ default: m.CicloCalculoPage })));
const VerificacaoPage = lazy(() => import("@/modules/creditos/VerificacaoPage").then(m => ({ default: m.VerificacaoPage })));

// Lazy load distribuicao and public pages
const DistribuicaoPage = lazy(() => import("@/modules/distribuicao/DistribuicaoPage").then(m => ({ default: m.DistribuicaoPage })));
const VerificarTokenPage = lazy(() => import("@/modules/verificacao-publica/VerificarTokenPage").then(m => ({ default: m.VerificarTokenPage })));

const LoadingFallback = () => <div style={{ padding: "2rem", textAlign: "center" }}>Carregando...</div>;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      <Route path="/verificar/:tokenId" element={<Suspense fallback={<LoadingFallback />}><VerificarTokenPage /></Suspense>} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/projetos" replace />} />

        <Route path="/conta" element={<Suspense fallback={<LoadingFallback />}><ContaPage /></Suspense>} />
        <Route path="/usuarios" element={<Suspense fallback={<LoadingFallback />}><UsuariosPage /></Suspense>} />
        <Route path="/admin/organizacoes" element={<Suspense fallback={<LoadingFallback />}><OrganizacoesPage /></Suspense>} />
        <Route path="/admin/branding" element={<Suspense fallback={<LoadingFallback />}><BrandingAdminPage /></Suspense>} />
        <Route path="/auditoria" element={<Suspense fallback={<LoadingFallback />}><AuditoriaPage /></Suspense>} />

        <Route path="/metodologias" element={<Suspense fallback={<LoadingFallback />}><MetodologiaListPage /></Suspense>} />
        <Route path="/metodologias/:versionId" element={<Suspense fallback={<LoadingFallback />}><MetodologiaDetailPage /></Suspense>} />

        <Route path="/projetos" element={<Suspense fallback={<LoadingFallback />}><ProjetosListPage /></Suspense>} />
        <Route path="/projetos/:projectId" element={<Suspense fallback={<LoadingFallback />}><ProjetoLayout /></Suspense>}>
          <Route index element={<Suspense fallback={<LoadingFallback />}><ProjetoOverviewPage /></Suspense>} />
          <Route path="dcp" element={<Suspense fallback={<LoadingFallback />}><DcpEditorPage /></Suspense>} />
          <Route path="producao" element={<Suspense fallback={<LoadingFallback />}><ProducaoPage /></Suspense>} />
          <Route path="comercializacao" element={<Suspense fallback={<LoadingFallback />}><ComercializacaoPage /></Suspense>} />
          <Route path="inventario" element={<Suspense fallback={<LoadingFallback />}><InventarioPage /></Suspense>} />
          <Route path="vazamentos" element={<Suspense fallback={<LoadingFallback />}><VazamentosPage /></Suspense>} />
          <Route path="relatorio-emissoes" element={<Suspense fallback={<LoadingFallback />}><RelatorioEmissoesPage /></Suspense>} />
          <Route path="ciclos/:year" element={<Suspense fallback={<LoadingFallback />}><CicloCalculoPage /></Suspense>} />
          <Route path="verificacao" element={<Suspense fallback={<LoadingFallback />}><VerificacaoPage /></Suspense>} />
          <Route path="distribuicao" element={<Suspense fallback={<LoadingFallback />}><DistribuicaoPage /></Suspense>} />
        </Route>
      </Route>
    </Routes>
  );
}
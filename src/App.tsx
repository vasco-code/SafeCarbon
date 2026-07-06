import { BrowserRouter, Link, NavLink, useLocation } from "react-router-dom";
import { Leaf } from "lucide-react";
import { AppRoutes } from "@/routes";
import { useAuth } from "@/contexts/AuthContext";

function Header() {
  const { session, user, canManageUsers, signOut } = useAuth();

  return (
    <header className="app-header">
      <Link to="/projetos" className="app-logo">
        <span className="app-logo-mark">
          <Leaf size={15} strokeWidth={2.25} />
        </span>
        <strong>SafeCarbon</strong>
      </Link>
      {session && (
        <>
          <nav>
            <NavLink to="/projetos" className={({ isActive }) => (isActive ? "active" : "")}>
              Projetos
            </NavLink>
            <NavLink to="/metodologias" className={({ isActive }) => (isActive ? "active" : "")}>
              Metodologias
            </NavLink>
            {canManageUsers && (
              <NavLink to="/usuarios" className={({ isActive }) => (isActive ? "active" : "")}>
                Usuários
              </NavLink>
            )}
          </nav>
          <div className="app-header-user">
            <Link to="/conta">{user?.email}</Link>
            <button type="button" onClick={signOut}>
              Sair
            </button>
          </div>
        </>
      )}
    </header>
  );
}

// Páginas públicas de verificação (QR code) são "brand-lite" e full-bleed —
// não usam o chrome do app interno (header/nav), mesmo que o visitante tenha
// uma sessão autenticada aberta em outra aba.
function AppShell() {
  const { pathname } = useLocation();
  const isPublicVerificationPage = pathname.startsWith("/verificar/");

  if (isPublicVerificationPage) {
    return <AppRoutes />;
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <AppRoutes />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

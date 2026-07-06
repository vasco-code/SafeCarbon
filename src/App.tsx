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

const FULL_BLEED_PREFIXES = ["/verificar/", "/login", "/esqueci-senha", "/redefinir-senha"];

// Páginas públicas de verificação (QR code) e as telas de autenticação são
// "brand-lite" e full-bleed — não usam o chrome do app interno (header/nav).
// Sem isso, a tela de login herdava o header do app (com só o logo, sem
// nada mais, já que não há sessão) sobre uma página em branco — a
// composição toda lia como "genérica" mesmo com o resto do design tokenizado.
function AppShell() {
  const { pathname } = useLocation();
  const isFullBleed = FULL_BLEED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isFullBleed) {
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

import { BrowserRouter, Link, NavLink } from "react-router-dom";
import { AppRoutes } from "@/routes";
import { useAuth } from "@/contexts/AuthContext";

function Header() {
  const { session, user, canManageUsers, signOut } = useAuth();

  return (
    <header className="app-header">
      <strong>SafeCarbon</strong>
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

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Header />
        <main className="app-main">
          <AppRoutes />
        </main>
      </div>
    </BrowserRouter>
  );
}

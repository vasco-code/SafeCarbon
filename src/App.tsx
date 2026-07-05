import { BrowserRouter, Link } from "react-router-dom";
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
            <Link to="/projetos">Projetos</Link>
            <Link to="/metodologias">Metodologias</Link>
            {canManageUsers && <Link to="/usuarios">Usuários</Link>}
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

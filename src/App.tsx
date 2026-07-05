import { BrowserRouter, Link } from "react-router-dom";
import { AppRoutes } from "@/routes";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <strong>SafeCarbon</strong>
          <nav>
            <Link to="/projetos">Projetos</Link>
            <Link to="/metodologias">Metodologias</Link>
          </nav>
        </header>
        <main className="app-main">
          <AppRoutes />
        </main>
      </div>
    </BrowserRouter>
  );
}

import { Wallet } from "lucide-react";
import { WalletView } from "@/components/WalletView";

export function CarteiraAtivosPage() {
  return (
    <section>
      <h1 className="module-heading">
        <Wallet size={22} /> Carteira de Ativos
      </h1>
      <p>Créditos de carbono de todos os projetos em que sua organização participa.</p>

      <WalletView />
    </section>
  );
}

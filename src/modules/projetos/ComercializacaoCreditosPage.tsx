import { useParams } from "react-router-dom";
import { Coins } from "lucide-react";
import { WalletView } from "@/components/WalletView";

export function ComercializacaoCreditosPage() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return null;

  return (
    <section>
      <h2 className="module-heading">
        <Coins size={20} /> Comercialização de Créditos
      </h2>
      <p>Créditos emitidos deste projeto, disponíveis para transferência a um comprador.</p>

      <WalletView projectId={projectId} />
    </section>
  );
}

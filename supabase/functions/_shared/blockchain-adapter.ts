// Adaptador de blockchain — interface isolada conforme
// docs/04-arquitetura-tecnica-integracoes.md §3, para que o SafeCarbon nunca
// acople sua lógica de negócio aos detalhes da chain escolhida pela Safe Trace.
//
// A Safe Trace ainda não confirmou o contrato real dessa camada ("Ponto de
// decisão em aberto" no mesmo documento: qual chain/ledger, formato de
// tx_hash, etc.). Esta é uma implementação SIMULADA — gera identificadores
// plausíveis e bem formados, mas não fala com nenhuma chain real. Quando o
// contrato real for confirmado, troca-se só este arquivo; nada em
// issue-credit-batch/retire-credit precisa mudar, graças à interface.

export interface CarbonBlockchainAdapter {
  issueBatch(input: {
    creditIssuanceId: string;
    projectId: string;
    tco2eAmount: number;
    vintageYear: number;
    metadata: Record<string, unknown>;
  }): Promise<{ tokenId: string; txHash: string; ledgerRef: string }>;

  retire(input: { tokenId: string; reason: string }): Promise<{ txHash: string; retiredAt: string }>;

  getStatus(tokenId: string): Promise<{ status: "active" | "transferred" | "retired"; owner: string }>;

  verifyTx(txHash: string): Promise<boolean>;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

class SimulatedBlockchainAdapter implements CarbonBlockchainAdapter {
  async issueBatch(input: Parameters<CarbonBlockchainAdapter["issueBatch"]>[0]) {
    return {
      tokenId: `SIM-TOKEN-${input.creditIssuanceId}`,
      txHash: `0xsim${randomHex(32)}`,
      ledgerRef: `simledger://safecarbon/${input.projectId}/${input.vintageYear}`,
    };
  }

  async retire(input: Parameters<CarbonBlockchainAdapter["retire"]>[0]) {
    void input;
    return { txHash: `0xsim${randomHex(32)}`, retiredAt: new Date().toISOString() };
  }

  async getStatus(tokenId: string) {
    void tokenId;
    return { status: "active" as const, owner: "simulated" };
  }

  async verifyTx(txHash: string) {
    return txHash.startsWith("0xsim");
  }
}

export const blockchainAdapter: CarbonBlockchainAdapter = new SimulatedBlockchainAdapter();

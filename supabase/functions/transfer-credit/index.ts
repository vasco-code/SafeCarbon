// Transfere a titularidade (holder_org_id) de um token já emitido — Carteira
// de Ativos. Mesmo esqueleto de retire-credit: roda com o token do próprio
// chamador (nunca service role), sem confiar só na RLS pra decidir permissão
// (docs/04-arquitetura-tecnica-integracoes.md §3 — checagem explícita antes
// de chamar a chain, importante porque um transfer() prematuro pode ter
// efeito/custo irreversível ainda que a escrita no Postgres falhe depois).
import { createClient } from "npm:@supabase/supabase-js@2";
import { blockchainAdapter } from "../_shared/blockchain-adapter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autenticado." }, 401);
    }

    const { blockchainTokenId, toOrgId, note } = await req.json();
    if (!blockchainTokenId || !toOrgId) {
      return json({ error: "blockchainTokenId e toOrgId são obrigatórios." }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Não autenticado." }, 401);
    }

    const { data: token, error: tokenError } = await supabase
      .from("blockchain_tokens")
      .select(
        "id, token_id, status, holder_org_id, credit_issuances(credit_batches(credit_calculation_cycles(project_id)))",
      )
      .eq("id", blockchainTokenId)
      .maybeSingle();
    if (tokenError || !token) {
      return json({ error: "Token não encontrado (ou sem permissão de leitura)." }, 404);
    }
    if (token.status !== "active") {
      return json({ error: `Token está em '${token.status}' — só é possível transferir tokens ativos.` }, 400);
    }
    if (token.holder_org_id === toOrgId) {
      return json({ error: "O token já pertence a esta organização." }, 400);
    }

    // deno-lint-ignore no-explicit-any
    const projectId = (token as any).credit_issuances?.credit_batches?.credit_calculation_cycles?.project_id;
    if (!projectId) {
      return json({ error: "Não foi possível resolver o projeto deste token." }, 400);
    }

    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    const { data: hasRole } = await supabase.rpc("has_project_role", {
      p_project_id: projectId,
      p_roles: ["developer", "admin"],
    });
    const { data: memberships } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", userData.user.id);
    const isCurrentHolder = (memberships ?? []).some((m) => m.org_id === token.holder_org_id);

    if (!isAdmin && !hasRole && !isCurrentHolder) {
      return json({ error: "Sem permissão para transferir este crédito." }, 403);
    }

    const { data: toOrg } = await supabase.from("organizations").select("id, name").eq("id", toOrgId).maybeSingle();
    if (!toOrg) {
      return json({ error: "Organização de destino não encontrada." }, 404);
    }

    const chainResult = await blockchainAdapter.transfer({
      tokenId: token.token_id,
      fromOrgReference: token.holder_org_id ?? "",
      toOrgReference: toOrgId,
    });

    const { error: updateError } = await supabase
      .from("blockchain_tokens")
      .update({ holder_org_id: toOrgId })
      .eq("id", blockchainTokenId);
    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    const { error: transferError } = await supabase.from("token_transfers").insert({
      blockchain_token_id: blockchainTokenId,
      from_org_id: token.holder_org_id,
      to_org_id: toOrgId,
      tx_hash: chainResult.txHash,
      note: note ?? null,
    });
    if (transferError) {
      return json({ error: transferError.message }, 400);
    }

    return json({ txHash: chainResult.txHash, transferredAt: chainResult.transferredAt }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});

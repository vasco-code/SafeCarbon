// Aposenta (retire) um token já emitido — ação irreversível e distinta da
// emissão (docs/04-arquitetura-tecnica-integracoes.md §3). Roda com o token
// do próprio chamador (developer/admin do projeto).
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

    const { blockchainTokenId, reason } = await req.json();
    if (!blockchainTokenId || !reason) {
      return json({ error: "blockchainTokenId e reason são obrigatórios." }, 400);
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
        "id, token_id, status, credit_issuances(credit_batches(credit_calculation_cycles(project_id)))",
      )
      .eq("id", blockchainTokenId)
      .maybeSingle();
    if (tokenError || !token) {
      return json({ error: "Token não encontrado (ou sem permissão de leitura)." }, 404);
    }
    if (token.status === "retired") {
      return json({ error: "Token já está aposentado." }, 400);
    }

    // deno-lint-ignore no-explicit-any
    const projectId = (token as any).credit_issuances?.credit_batches?.credit_calculation_cycles?.project_id;
    if (!projectId) {
      return json({ error: "Não foi possível resolver o projeto deste token." }, 400);
    }

    // Checagem explícita de permissão antes de chamar a chain — importante
    // porque, quando o adaptador simulado for substituído pelo real, uma
    // chamada de retire() prematura pode ter efeito/custo irreversível ainda
    // que a escrita no Postgres falhe depois por RLS.
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    const { data: hasRole } = await supabase.rpc("has_project_role", {
      p_project_id: projectId,
      p_roles: ["developer", "admin"],
    });
    if (!isAdmin && !hasRole) {
      return json({ error: "Sem permissão para aposentar créditos deste projeto." }, 403);
    }

    const chainResult = await blockchainAdapter.retire({ tokenId: token.token_id, reason });

    const { error: updateError } = await supabase
      .from("blockchain_tokens")
      .update({ status: "retired", retired_at: chainResult.retiredAt, retired_reason: reason })
      .eq("id", blockchainTokenId);
    if (updateError) {
      return json({ error: updateError.message }, 400);
    }

    return json({ txHash: chainResult.txHash, retiredAt: chainResult.retiredAt }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});

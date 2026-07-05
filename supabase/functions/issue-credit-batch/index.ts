// Emite o token de um credit_batch já aprovado. Roda com o token do próprio
// chamador (developer/admin do projeto) — sem service role. Idempotente: se
// já existe credit_issuances para este batch, retorna o token já emitido em
// vez de tokenizar de novo (docs/04-arquitetura-tecnica-integracoes.md §3).
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

    const { creditBatchId } = await req.json();
    if (!creditBatchId) {
      return json({ error: "creditBatchId é obrigatório." }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Não autenticado." }, 401);
    }

    const { data: batch, error: batchError } = await supabase
      .from("credit_batches")
      .select("id, cycle_id, tco2e_amount, status")
      .eq("id", creditBatchId)
      .maybeSingle();
    if (batchError || !batch) {
      return json({ error: "Lote de créditos não encontrado (ou sem permissão de leitura)." }, 404);
    }
    if (batch.status !== "approved" && batch.status !== "issued") {
      return json({ error: `Lote está em '${batch.status}' — só pode ser emitido após aprovação do verificador.` }, 400);
    }

    const { data: cycle } = await supabase
      .from("credit_calculation_cycles")
      .select("project_id, period_year")
      .eq("id", batch.cycle_id)
      .maybeSingle();
    if (!cycle) {
      return json({ error: "Ciclo de cálculo não encontrado." }, 404);
    }

    // Checagem explícita de permissão — não depender de qual policy de leitura
    // deixa passar, para nunca dar "sucesso" (mesmo que só devolvendo dados já
    // públicos ao papel) numa ação que devia exigir developer/admin.
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    const { data: hasRole } = await supabase.rpc("has_project_role", {
      p_project_id: cycle.project_id,
      p_roles: ["developer", "admin"],
    });
    if (!isAdmin && !hasRole) {
      return json({ error: "Sem permissão para emitir créditos deste projeto." }, 403);
    }

    // Idempotência: já existe emissão para este lote?
    const { data: existingIssuance } = await supabase
      .from("credit_issuances")
      .select("id")
      .eq("credit_batch_id", creditBatchId)
      .maybeSingle();

    if (existingIssuance) {
      const { data: existingToken } = await supabase
        .from("blockchain_tokens")
        .select("token_id, tx_hash, ledger_ref, status")
        .eq("credit_issuance_id", existingIssuance.id)
        .maybeSingle();
      return json({ issuanceId: existingIssuance.id, token: existingToken, alreadyIssued: true }, 200);
    }

    const { data: verificationCycle } = await supabase
      .from("verification_cycles")
      .select("id")
      .eq("project_id", cycle.project_id)
      .lte("period_start_year", cycle.period_year)
      .gte("period_end_year", cycle.period_year)
      .maybeSingle();

    const serialEnd = Math.max(1, Math.floor(batch.tco2e_amount));

    const { data: issuance, error: issuanceError } = await supabase
      .from("credit_issuances")
      .insert({
        credit_batch_id: creditBatchId,
        verification_cycle_id: verificationCycle?.id ?? null,
        issued_amount_tco2e: batch.tco2e_amount,
        serial_number_start: "1",
        serial_number_end: String(serialEnd),
      })
      .select("id")
      .single();
    if (issuanceError || !issuance) {
      return json({ error: issuanceError?.message ?? "Erro ao registrar a emissão." }, 400);
    }

    const chainResult = await blockchainAdapter.issueBatch({
      creditIssuanceId: issuance.id,
      projectId: cycle.project_id,
      tco2eAmount: batch.tco2e_amount,
      vintageYear: cycle.period_year,
      metadata: { creditBatchId, cycleId: batch.cycle_id },
    });

    const { error: tokenError } = await supabase.from("blockchain_tokens").insert({
      credit_issuance_id: issuance.id,
      token_id: chainResult.tokenId,
      tx_hash: chainResult.txHash,
      ledger_ref: chainResult.ledgerRef,
      status: "active",
    });
    if (tokenError) {
      return json({ error: tokenError.message }, 400);
    }

    await supabase.from("credit_batches").update({ status: "issued" }).eq("id", creditBatchId);

    return json({ issuanceId: issuance.id, token: chainResult, alreadyIssued: false }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});

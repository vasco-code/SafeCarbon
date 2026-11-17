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
      .select("project_id, period_year, issuance_hold, issuance_hold_reason, carbon_projects(proponent_org_id, credit_split)")
      .eq("id", batch.cycle_id)
      .maybeSingle();
    if (!cycle) {
      return json({ error: "Ciclo de cálculo não encontrado." }, 404);
    }
    // deno-lint-ignore no-explicit-any
    const projectRow = (cycle as any).carbon_projects;
    const proponentOrgId: string | null = projectRow?.proponent_org_id ?? null;
    const creditSplit: Record<string, number> | null = projectRow?.credit_split ?? null;

    // Checagem explícita de permissão — não depender de qual policy de leitura
    // deixa passar, para nunca dar "sucesso" (mesmo que só devolvendo dados já
    // públicos ao papel) numa ação que devia exigir developer/admin.
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    const { data: canWrite } = await supabase.rpc("has_project_write_role", {
      p_project_id: cycle.project_id,
      p_roles: ["developer", "admin"],
    });
    if (!isAdmin && !canWrite) {
      return json({ error: "Sem permissão para emitir créditos deste projeto." }, 403);
    }

    // Emissões já feitas para este lote. Tokens cancelados não contam como
    // emissão vigente (ficam como histórico), mas seus seriais nunca são
    // reaproveitados.
    const { data: issuances } = await supabase
      .from("credit_issuances")
      .select("id, serial_number_end, blockchain_tokens(token_id, tx_hash, ledger_ref, status, holder_org_id)")
      .eq("credit_batch_id", creditBatchId);

    // deno-lint-ignore no-explicit-any
    const tokenOf = (i: any) => (Array.isArray(i.blockchain_tokens) ? i.blockchain_tokens[0] : i.blockchain_tokens);
    const liveIssuances = (issuances ?? []).filter((i) => tokenOf(i)?.status !== "cancelled");

    // Idempotência: já existe emissão vigente para este lote?
    if (liveIssuances.length > 0) {
      return json(
        { issuances: liveIssuances.map((i) => ({ issuanceId: i.id, token: tokenOf(i) })), alreadyIssued: true },
        200,
      );
    }

    // Bloqueio de emissão (ex.: retificação de vintage, regras da registradora
    // ainda não publicadas) — vale mesmo para platform admin.
    if (cycle.issuance_hold) {
      return json(
        { error: `Emissão bloqueada para este ciclo: ${cycle.issuance_hold_reason ?? "bloqueio ativo"}` },
        409,
      );
    }

    // Só unidades inteiras: nunca se emite fração de tCO2e.
    const totalUnits = Math.floor(Number(batch.tco2e_amount));
    if (totalUnits < 1) {
      return json({ error: "O lote tem menos de 1 tCO2e — não há unidade inteira a emitir." }, 400);
    }

    // Divisão contratual: as demais partes recebem floor(pct%) e o proponente
    // fica com o restante, para a soma fechar exatamente em totalUnits.
    let shares: { orgId: string | null; units: number }[];
    if (creditSplit && Object.keys(creditSplit).length > 0) {
      const pctSum = Object.values(creditSplit).reduce((sum, pct) => sum + Number(pct), 0);
      if (Math.abs(pctSum - 100) > 1e-9) {
        return json({ error: "A divisão contratual dos créditos (credit_split) deve somar 100%." }, 400);
      }
      const others = Object.entries(creditSplit)
        .filter(([orgId]) => orgId !== proponentOrgId)
        .map(([orgId, pct]) => ({ orgId, units: Math.floor((totalUnits * Number(pct)) / 100) }));
      const othersTotal = others.reduce((sum, o) => sum + o.units, 0);
      shares = [{ orgId: proponentOrgId, units: totalUnits - othersTotal }, ...others];
    } else {
      shares = [{ orgId: proponentOrgId, units: totalUnits }];
    }
    shares = shares.filter((share) => share.units > 0);

    const { data: verificationCycle } = await supabase
      .from("verification_cycles")
      .select("id")
      .eq("project_id", cycle.project_id)
      .lte("period_start_year", cycle.period_year)
      .gte("period_end_year", cycle.period_year)
      .maybeSingle();

    let nextSerial = Math.max(0, ...(issuances ?? []).map((i) => Number(i.serial_number_end) || 0)) + 1;
    const issued: { issuanceId: string; orgId: string | null; units: number; token: unknown }[] = [];

    for (const share of shares) {
      const serialStart = nextSerial;
      const serialEnd = nextSerial + share.units - 1;
      nextSerial = serialEnd + 1;

      const { data: issuance, error: issuanceError } = await supabase
        .from("credit_issuances")
        .insert({
          credit_batch_id: creditBatchId,
          verification_cycle_id: verificationCycle?.id ?? null,
          issued_amount_tco2e: share.units,
          serial_number_start: String(serialStart),
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
        tco2eAmount: share.units,
        vintageYear: cycle.period_year,
        metadata: { creditBatchId, cycleId: batch.cycle_id },
      });

      const { error: tokenError } = await supabase.from("blockchain_tokens").insert({
        credit_issuance_id: issuance.id,
        token_id: chainResult.tokenId,
        tx_hash: chainResult.txHash,
        ledger_ref: chainResult.ledgerRef,
        status: "active",
        // Cada parte recebe no próprio nome, conforme a divisão contratual
        // (sem divisão cadastrada, tudo nasce no nome do proponente).
        holder_org_id: share.orgId,
      });
      if (tokenError) {
        return json({ error: tokenError.message }, 400);
      }
      issued.push({ issuanceId: issuance.id, orgId: share.orgId, units: share.units, token: chainResult });
    }

    await supabase.from("credit_batches").update({ status: "issued" }).eq("id", creditBatchId);

    return json({ issuances: issued, alreadyIssued: false }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});

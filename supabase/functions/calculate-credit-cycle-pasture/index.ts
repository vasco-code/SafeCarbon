// Motor de cálculo do SEGUNDO projeto (Sprint 9 — hardening multi-projeto):
// sequestro de carbono via manejo rotacionado de pastagem, um domínio
// genuinamente diferente do Fator P (remoção de solo vs. emissão evitada).
//
// Deliberadamente uma Edge Function separada de calculate-credit-cycle, em
// vez de um branch dentro dela — prova que múltiplos motores de cálculo,
// cada um com sua própria forma de etapas, convivem escrevendo nas mesmas
// tabelas genéricas (credit_calculation_cycles/steps/batches) sem qualquer
// migration nova. `production_records.quantity_kg` é reaproveitada para
// guardar hectares manejados (não kg) — ver comentário no seed.
import { createClient } from "npm:@supabase/supabase-js@2";

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

interface StepRow {
  step_number: number;
  step_key: string;
  input_values: Record<string, unknown>;
  output_value: number;
  unit: string;
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

    const { projectId, periodYear } = await req.json();
    if (!projectId || !periodYear) {
      return json({ error: "projectId e periodYear são obrigatórios." }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Não autenticado." }, 401);
    }

    const { data: project, error: projectError } = await supabase
      .from("carbon_projects")
      .select("id, methodology_version_id")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError || !project) {
      return json({ error: "Projeto não encontrado." }, 404);
    }
    if (!project.methodology_version_id) {
      return json({ error: "Projeto sem metodologia vinculada." }, 400);
    }

    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    const { data: hasRole } = await supabase.rpc("has_project_role", {
      p_project_id: projectId,
      p_roles: ["developer", "admin"],
    });
    if (!isAdmin && !hasRole) {
      return json({ error: "Sem permissão para calcular o ciclo de créditos deste projeto." }, 403);
    }

    const { data: methodologyVersion } = await supabase
      .from("methodology_versions")
      .select("status")
      .eq("id", project.methodology_version_id)
      .maybeSingle();
    if (!methodologyVersion || methodologyVersion.status !== "published") {
      return json({ error: "A metodologia vinculada ao projeto não está publicada." }, 400);
    }

    const { data: paramRows } = await supabase
      .from("methodology_parameters")
      .select("param_key, value")
      .eq("methodology_version_id", project.methodology_version_id)
      .lte("valid_from", `${periodYear}-12-31`)
      .order("valid_from", { ascending: false });

    const params = new Map<string, number>();
    for (const row of paramRows ?? []) {
      if (!params.has(row.param_key)) params.set(row.param_key, Number(row.value));
    }
    for (const key of ["sequestration_rate_tco2e_per_ha_year", "uncertainty_discount_pct", "integrity_buffer_pct"]) {
      if (!params.has(key)) {
        return json({ error: `Parâmetro de metodologia ausente: ${key}.` }, 400);
      }
    }

    const { data: productionRows } = await supabase
      .from("production_records")
      .select("quantity_kg")
      .eq("project_id", projectId)
      .eq("period_year", periodYear);
    const areaHa = (productionRows ?? []).reduce((sum, r) => sum + Number(r.quantity_kg), 0);
    if (areaHa <= 0) {
      return json({ error: "Sem área manejada lançada para este período." }, 400);
    }

    const { data: inventoryRows } = await supabase
      .from("emission_inventory_entries")
      .select("calculated_tco2e")
      .eq("project_id", projectId)
      .eq("period_year", periodYear);
    if (!inventoryRows || inventoryRows.length === 0) {
      return json({ error: "Nenhum lançamento de inventário de emissões para este período." }, 400);
    }
    const eOperacionais = inventoryRows.reduce((sum, r) => sum + Number(r.calculated_tco2e), 0);

    const { data: leakageRows } = await supabase
      .from("leakage_assessments")
      .select("id")
      .eq("project_id", projectId)
      .eq("period_year", periodYear);
    if (!leakageRows || leakageRows.length === 0) {
      return json({ error: "Nenhuma avaliação de vazamento registrada para este período." }, 400);
    }

    const rate = params.get("sequestration_rate_tco2e_per_ha_year")!;
    const uncertaintyDiscount = params.get("uncertainty_discount_pct")! / 100;
    const integrityBuffer = params.get("integrity_buffer_pct")! / 100;

    const steps: StepRow[] = [];

    steps.push({
      step_number: 1,
      step_key: "area_manejada_ha",
      input_values: { total_area_ha: areaHa },
      output_value: areaHa,
      unit: "ha",
    });

    const sequestroBruto = areaHa * rate;
    steps.push({
      step_number: 2,
      step_key: "sequestro_bruto",
      input_values: { areaHa, sequestration_rate_tco2e_per_ha_year: rate },
      output_value: sequestroBruto,
      unit: "tCO2e",
    });

    const liquidoPreliminar = sequestroBruto - eOperacionais;
    steps.push({
      step_number: 3,
      step_key: "deducao_emissoes_operacionais_pastagem",
      input_values: { sequestroBruto, eOperacionais },
      output_value: liquidoPreliminar,
      unit: "tCO2e",
    });

    const ajustado = liquidoPreliminar * (1 - uncertaintyDiscount);
    steps.push({
      step_number: 4,
      step_key: "desconto_incerteza",
      input_values: { liquidoPreliminar, uncertainty_discount_pct: uncertaintyDiscount * 100 },
      output_value: ajustado,
      unit: "tCO2e",
    });

    const final = ajustado * (1 - integrityBuffer);
    steps.push({
      step_number: 5,
      step_key: "buffer_permanencia",
      input_values: { ajustado, integrity_buffer_pct: integrityBuffer * 100 },
      output_value: final,
      unit: "tCO2e",
    });

    const { data: existingCycle } = await supabase
      .from("credit_calculation_cycles")
      .select("id, status")
      .eq("project_id", projectId)
      .eq("period_year", periodYear)
      .maybeSingle();

    if (existingCycle && !["draft", "calculated"].includes(existingCycle.status)) {
      return json(
        { error: `Ciclo já está em '${existingCycle.status}' — não é possível recalcular após início da verificação.` },
        409,
      );
    }
    if (existingCycle) {
      await supabase.from("credit_calculation_cycles").delete().eq("id", existingCycle.id);
    }

    const { data: newCycle, error: cycleError } = await supabase
      .from("credit_calculation_cycles")
      .insert({
        project_id: projectId,
        period_year: periodYear,
        methodology_version_id: project.methodology_version_id,
        status: "calculated",
        calculated_at: new Date().toISOString(),
        calculated_by: userData.user.id,
      })
      .select("id")
      .single();
    if (cycleError || !newCycle) {
      return json({ error: cycleError?.message ?? "Erro ao criar o ciclo." }, 400);
    }

    const { error: stepsError } = await supabase
      .from("credit_calculation_steps")
      .insert(steps.map((s) => ({ cycle_id: newCycle.id, ...s })));
    if (stepsError) {
      return json({ error: stepsError.message }, 400);
    }

    const { error: batchError } = await supabase.from("credit_batches").insert({
      cycle_id: newCycle.id,
      tco2e_amount: final,
      commercialization_factor: null,
      eligibility_factor: 1,
    });
    if (batchError) {
      return json({ error: batchError.message }, 400);
    }

    return json({ cycleId: newCycle.id, tco2eFinal: final, steps }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});

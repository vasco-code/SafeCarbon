// Motor de cálculo de créditos — as 9 etapas descritas em docs/05-motor-de-calculo.md,
// generalizadas (lê parâmetros de methodology_parameters, nunca hardcoded para a Premix).
//
// Roda com o token do próprio chamador (não service role) — quem pode rodar já tem
// permissão de escrita em credit_calculation_cycles/steps/batches via RLS
// (developer/admin do projeto). O motor só reproduz, em código, as mesmas checagens
// que a RLS já exige, para dar um erro de negócio claro em vez de um erro de RLS cru.
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

    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    const { data: hasRole } = await supabase.rpc("has_project_role", {
      p_project_id: projectId,
      p_roles: ["developer", "admin"],
    });
    if (!isAdmin && !hasRole) {
      return json({ error: "Sem permissão para calcular o ciclo de créditos deste projeto." }, 403);
    }

    // ---- 1. Carrega o projeto e a metodologia vigente -----------------------------
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

    const { data: methodologyVersion } = await supabase
      .from("methodology_versions")
      .select("id, status")
      .eq("id", project.methodology_version_id)
      .maybeSingle();
    if (!methodologyVersion || methodologyVersion.status !== "published") {
      return json({ error: "A metodologia vinculada ao projeto não está publicada." }, 400);
    }

    // ---- 2. Parâmetros vigentes da metodologia -------------------------------------
    const referenceDate = `${periodYear}-12-31`;
    const { data: paramRows } = await supabase
      .from("methodology_parameters")
      .select("param_key, value, source_citation, valid_from")
      .eq("methodology_version_id", project.methodology_version_id)
      .lte("valid_from", referenceDate)
      .order("valid_from", { ascending: false });

    const params = new Map<string, { value: number; source: string | null }>();
    for (const row of paramRows ?? []) {
      if (!params.has(row.param_key)) {
        params.set(row.param_key, { value: Number(row.value), source: row.source_citation });
      }
    }

    const required = [
      "mitigation_factor_pct",
      "baseline_ef_ch4_kg_per_animal_year",
      "gwp_ch4",
      "avg_consumption_kg_per_animal_year",
      "uncertainty_discount_pct",
      "integrity_buffer_pct",
    ];
    for (const key of required) {
      if (!params.has(key)) {
        return json({ error: `Parâmetro de metodologia ausente: ${key}.` }, 400);
      }
    }

    const R = params.get("mitigation_factor_pct")!.value / 100;
    const EF_ch4 = params.get("baseline_ef_ch4_kg_per_animal_year")!.value;
    const GWP_ch4 = params.get("gwp_ch4")!.value;
    const GWP_ch4_source = params.get("gwp_ch4")!.source;
    const C_uso = params.get("avg_consumption_kg_per_animal_year")!.value;
    const uncertaintyDiscount = params.get("uncertainty_discount_pct")!.value / 100;
    const integrityBuffer = params.get("integrity_buffer_pct")!.value / 100;

    // ---- 3. Produção e comercialização (Etapas 1-2) --------------------------------
    const { data: summary } = await supabase
      .from("production_period_summary")
      .select("total_produced_kg, total_commercialized_kg, commercialization_factor")
      .eq("project_id", projectId)
      .eq("period_year", periodYear)
      .maybeSingle();

    if (!summary || summary.total_produced_kg <= 0) {
      return json({ error: "Sem produção lançada para este período." }, 400);
    }
    if (summary.total_commercialized_kg > summary.total_produced_kg) {
      return json({ error: "Tc não pode ser maior que Pfp — verifique produção/comercialização do período." }, 400);
    }

    const Pfp_kg = summary.total_produced_kg;
    const Tc_kg = summary.total_commercialized_kg;
    const Fc = summary.commercialization_factor ?? 0;

    // ---- 4. Inventário de emissões operacionais (Etapa 8, validação obrigatória) --
    const { data: inventoryEntries } = await supabase
      .from("emission_inventory_entries")
      .select("calculated_tco2e")
      .eq("project_id", projectId)
      .eq("period_year", periodYear);
    if (!inventoryEntries || inventoryEntries.length === 0) {
      return json({ error: "Nenhum lançamento de inventário de emissões para este período." }, 400);
    }
    const E_operacionais = inventoryEntries.reduce((sum, e) => sum + Number(e.calculated_tco2e), 0);

    // ---- 5. Avaliação de vazamentos (validação obrigatória) ------------------------
    const { data: leakageRows } = await supabase
      .from("leakage_assessments")
      .select("leakage_factor_pct")
      .eq("project_id", projectId)
      .eq("period_year", periodYear);
    if (!leakageRows || leakageRows.length === 0) {
      return json({ error: "Nenhuma avaliação de vazamento registrada para este período." }, 400);
    }
    const LF = leakageRows.reduce((sum, r) => sum + Number(r.leakage_factor_pct), 0) / 100;

    // ---- 6. Reconciliação (Fe) — volume já creditado em ciclos anteriores ----------
    const { data: alreadyCreditedDocs } = await supabase
      .from("commercialization_documents")
      .select("quantity_kg")
      .eq("project_id", projectId)
      .eq("already_credited", true);
    const jaCreditadoKg = (alreadyCreditedDocs ?? []).reduce((sum, d) => sum + Number(d.quantity_kg), 0);
    const Fe = Tc_kg > 0 ? Math.max(0, (Tc_kg - jaCreditadoKg) / Tc_kg) : 1;

    // ---- As 9 etapas ----------------------------------------------------------------
    const steps: StepRow[] = [];

    const Pfp_t = Pfp_kg / 1000;
    steps.push({
      step_number: 1,
      step_key: "producao_anual",
      input_values: { total_produced_kg: Pfp_kg },
      output_value: Pfp_t,
      unit: "t",
    });

    const Tc_t = Tc_kg / 1000;
    steps.push({
      step_number: 2,
      step_key: "comercializacao",
      input_values: { total_commercialized_kg: Tc_kg, Pfp_t },
      output_value: Fc,
      unit: "adimensional",
    });

    const N_animais = C_uso > 0 ? Tc_kg / C_uso : 0;
    steps.push({
      step_number: 3,
      step_key: "estimativa_cobertura_animal",
      input_values: { Tc_kg, avg_consumption_kg_per_animal_year: C_uso },
      output_value: N_animais,
      unit: "animais (estimativa intermediária, não creditável)",
    });

    const E_base = N_animais * EF_ch4;
    steps.push({
      step_number: 4,
      step_key: "emissoes_linha_base",
      input_values: { N_animais, baseline_ef_ch4_kg_per_animal_year: EF_ch4 },
      output_value: E_base,
      unit: "kg CH4",
    });

    const E_projeto = E_base * (1 - R);
    steps.push({
      step_number: 5,
      step_key: "emissoes_cenario_projeto",
      input_values: { E_base, mitigation_factor_pct: R * 100 },
      output_value: E_projeto,
      unit: "kg CH4",
    });

    const Red_CH4 = E_base - E_projeto;
    steps.push({
      step_number: 6,
      step_key: "reducao_bruta_metano",
      input_values: { E_base, E_projeto },
      output_value: Red_CH4,
      unit: "kg CH4",
    });

    const Red_CO2e_bruta = (Red_CH4 / 1000) * GWP_ch4;
    steps.push({
      step_number: 7,
      step_key: "conversao_co2e",
      input_values: { Red_CH4, gwp_ch4: GWP_ch4, gwp_ch4_source: GWP_ch4_source },
      output_value: Red_CO2e_bruta,
      unit: "tCO2e",
    });

    const Red_CO2e_preliminar = Red_CO2e_bruta - E_operacionais;
    steps.push({
      step_number: 8,
      step_key: "subtracao_emissoes_operacionais",
      input_values: { Red_CO2e_bruta, E_operacionais },
      output_value: Red_CO2e_preliminar,
      unit: "tCO2e",
    });

    let Red_pos_LF = Red_CO2e_preliminar;
    let nextStepNumber = 9;
    if (LF > 0) {
      Red_pos_LF = Red_CO2e_preliminar * (1 - LF);
      steps.push({
        step_number: nextStepNumber,
        step_key: "ajuste_vazamento",
        input_values: { Red_CO2e_preliminar, leakage_factor_pct: LF * 100 },
        output_value: Red_pos_LF,
        unit: "tCO2e",
      });
      nextStepNumber += 1;
    }

    const Red_ajustada = Red_pos_LF * (1 - uncertaintyDiscount);
    const Red_final = Red_ajustada * (1 - integrityBuffer);
    steps.push({
      step_number: nextStepNumber,
      step_key: "fatores_integridade",
      input_values: {
        Red_pos_LF,
        uncertainty_discount_pct: uncertaintyDiscount * 100,
        integrity_buffer_pct: integrityBuffer * 100,
        Red_ajustada,
      },
      output_value: Red_final,
      unit: "tCO2e",
    });

    const tco2eFinal = Red_final * Fe;

    // ---- Persistência: cycle -> steps -> batch (idempotente por project+ano) ------
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

    const { error: stepsError } = await supabase.from("credit_calculation_steps").insert(
      steps.map((s) => ({ cycle_id: newCycle.id, ...s })),
    );
    if (stepsError) {
      return json({ error: stepsError.message }, 400);
    }

    const { error: batchError } = await supabase.from("credit_batches").insert({
      cycle_id: newCycle.id,
      tco2e_amount: tco2eFinal,
      commercialization_factor: Fc,
      eligibility_factor: Fe,
    });
    if (batchError) {
      return json({ error: batchError.message }, 400);
    }

    return json({ cycleId: newCycle.id, tco2eFinal, steps }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});

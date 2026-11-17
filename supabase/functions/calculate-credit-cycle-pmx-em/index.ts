// Motor de cálculo da Metodologia E2Carbon PMX-EM v2.0 — as etapas E1 a E15 da
// Memória de Cálculo v2.0 (Eqs. 1 a 12 da Metodologia). Parâmetros lidos de
// methodology_parameters da versão vinculada ao projeto; insumos anuais
// (volumes, estoques) de project_period_inputs; nada hardcoded para a Premix.
//
// Roda com o token do próprio chamador (sem service role). A escrita passa por
// persist_credit_cycle (security definer, transacional), que atualiza ciclo e
// lote no lugar — o recálculo não apaga o histórico de emissões/tokens.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ENGINE_VERSION = "pmx-em-2.0";

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

// ---- Distribuição t de Student (equivalente ao TINV do Excel) -----------------
function lnGamma(x: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];
  let y = x;
  let t = x + 5.5;
  t -= (x + 0.5) * Math.log(t);
  let s = 1.000000000190015;
  for (const k of c) s += k / ++y;
  return -t + Math.log((2.5066282746310005 * s) / x);
}

function betaContinuedFraction(x: number, a: number, b: number): number {
  const tiny = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let i = 1; i < 300; i++) {
    const i2 = 2 * i;
    let aa = (i * (b - i) * x) / ((qam + i2) * (a + i2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + i) * (qab + i) * x) / ((a + i2) * (qap + i2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-12) break;
  }
  return h;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (bt * betaContinuedFraction(x, a, b)) / a
    : 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

// Valor crítico t bicaudal: P(|T| > t) = p, com df graus de liberdade.
function tInv2Tail(p: number, df: number): number {
  const twoTail = (t: number) => regularizedIncompleteBeta(df / (df + t * t), df / 2, 0.5);
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (twoTail(mid) > p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
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

    // Só developer/admin escrevem ciclo/etapas/lote (a RLS já exige isso; o
    // motor v1 aceitava 'proponent' aqui e falhava depois com erro de RLS).
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    const { data: canWrite } = await supabase.rpc("has_project_write_role", {
      p_project_id: projectId,
      p_roles: ["developer", "admin"],
    });
    if (!isAdmin && !canWrite) {
      return json({ error: "Sem permissão para calcular o ciclo de créditos deste projeto." }, 403);
    }

    // ---- 1. Projeto e metodologia vigente ------------------------------------------
    const { data: project } = await supabase
      .from("carbon_projects")
      .select("id, methodology_version_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return json({ error: "Projeto não encontrado." }, 404);
    if (!project.methodology_version_id) return json({ error: "Projeto sem metodologia vinculada." }, 400);

    const { data: methodologyVersion } = await supabase
      .from("methodology_versions")
      .select("id, status")
      .eq("id", project.methodology_version_id)
      .maybeSingle();
    if (!methodologyVersion || methodologyVersion.status !== "published") {
      return json({ error: "A metodologia vinculada ao projeto não está publicada." }, 400);
    }

    // ---- 2. Parâmetros -------------------------------------------------------------
    const { data: paramRows } = await supabase
      .from("methodology_parameters")
      .select("param_key, value, valid_from")
      .eq("methodology_version_id", project.methodology_version_id)
      .lte("valid_from", `${periodYear}-12-31`)
      .order("valid_from", { ascending: false });

    const params = new Map<string, number>();
    for (const row of paramRows ?? []) {
      if (!params.has(row.param_key)) params.set(row.param_key, Number(row.value));
    }
    const requiredParams = [
      "ym", "eb_mj_per_kg_ms", "e_ch4_mj_per_kg", "d_ms_kg_per_kg_ms", "f_ion", "r_fraction", "gwp_ch4",
      "le_est", "res", "limiar_u", "p_r", "gl_r", "u_ym", "u_ad", "u_dose", "u_persist",
    ];
    for (const key of requiredParams) {
      if (!params.has(key)) return json({ error: `Parâmetro de metodologia ausente: ${key}.` }, 400);
    }
    const P = (key: string) => params.get(key)!;

    // ---- 3. Insumos anuais do projeto ----------------------------------------------
    const { data: inputRows } = await supabase
      .from("project_period_inputs")
      .select("input_key, value")
      .eq("project_id", projectId)
      .eq("period_year", periodYear);
    const inputs = new Map<string, number>((inputRows ?? []).map((r) => [r.input_key, Number(r.value)]));
    const requiredInputs = [
      "base_comercial_kg", "bovinos_corte_kg", "exportacao_corte_kg", "estoque_inicial_kg",
      "estoque_final_kg", "saidas_nao_declaradas_kg",
    ];
    for (const key of requiredInputs) {
      if (!inputs.has(key)) return json({ error: `Insumo do período ausente (project_period_inputs): ${key}.` }, 400);
    }
    const I = (key: string) => inputs.get(key)!;
    if (I("base_comercial_kg") <= 0) return json({ error: "base_comercial_kg deve ser maior que zero." }, 400);

    // Entradas por produção no Kardex = produção lançada no ano.
    const { data: summary } = await supabase
      .from("production_period_summary")
      .select("total_produced_kg")
      .eq("project_id", projectId)
      .eq("period_year", periodYear)
      .maybeSingle();
    if (!summary || Number(summary.total_produced_kg) <= 0) {
      return json({ error: "Sem produção lançada para este período." }, 400);
    }
    const producaoKg = Number(summary.total_produced_kg);

    // ---- 4. Inventário (já alocado: calculated_tco2e = bruto × alocação) ------------
    const { data: inventoryEntries } = await supabase
      .from("emission_inventory_entries")
      .select("calculated_tco2e")
      .eq("project_id", projectId)
      .eq("period_year", periodYear);
    if (!inventoryEntries || inventoryEntries.length === 0) {
      return json({ error: "Nenhum lançamento de inventário de emissões para este período." }, 400);
    }
    const PE = inventoryEntries.reduce((sum, e) => sum + Number(e.calculated_tco2e), 0);

    // ---- 5. Vazamento de mercado ---------------------------------------------------
    const { data: leakageRows } = await supabase
      .from("leakage_assessments")
      .select("leakage_factor_pct")
      .eq("project_id", projectId)
      .eq("period_year", periodYear);
    if (!leakageRows || leakageRows.length === 0) {
      return json({ error: "Nenhuma avaliação de vazamento registrada para este período." }, 400);
    }
    const LF = leakageRows.reduce((sum, r) => sum + Number(r.leakage_factor_pct), 0) / 100;

    // ---- As 15 etapas ----------------------------------------------------------------
    const steps: StepRow[] = [];
    const push = (step_key: string, input_values: Record<string, unknown>, output_value: number, unit: string) =>
      steps.push({ step_number: steps.length + 1, step_key, input_values, output_value, unit });

    // E1 — volume creditável: (corte − exportação) × Fr, com Fr = min(1, máximo vendável ÷ base comercial).
    const disponivel = producaoKg + I("estoque_inicial_kg") - I("estoque_final_kg");
    const maximoVendavel = disponivel - I("saidas_nao_declaradas_kg");
    const Fr = Math.min(1, maximoVendavel / I("base_comercial_kg"));
    const bovinosBrasil = I("bovinos_corte_kg") - I("exportacao_corte_kg");
    const V_el = bovinosBrasil * Fr;
    push("volume_creditavel", {
      producao_kg: producaoKg,
      estoque_inicial_kg: I("estoque_inicial_kg"),
      estoque_final_kg: I("estoque_final_kg"),
      saidas_nao_declaradas_kg: I("saidas_nao_declaradas_kg"),
      base_comercial_kg: I("base_comercial_kg"),
      Fr,
      bovinos_corte_brasil_kg: bovinosBrasil,
    }, V_el, "kg");

    // E2 — matéria seca tratada.
    const MS = V_el / P("d_ms_kg_per_kg_ms");
    push("materia_seca_tratada", { V_el, d_ms_kg_per_kg_ms: P("d_ms_kg_per_kg_ms") }, MS, "kg MS");

    // E3 — MS elegível (exclui substituição de ionóforo).
    const MS_el = MS * (1 - P("f_ion"));
    push("materia_seca_elegivel", { MS, f_ion: P("f_ion") }, MS_el, "kg MS");

    // E4 — animais-ano equivalentes (informativo, não creditável).
    push("equivalente_animais_ano", { MS_el }, MS_el / 8 / 365, "animal-ano (informativo, não creditável)");

    // E5 — emissão da linha de base.
    const BE = (MS_el * P("ym") * P("eb_mj_per_kg_ms")) / P("e_ch4_mj_per_kg") / 1000;
    push("emissao_linha_base", {
      MS_el, ym: P("ym"), eb_mj_per_kg_ms: P("eb_mj_per_kg_ms"), e_ch4_mj_per_kg: P("e_ch4_mj_per_kg"),
    }, BE, "t CH4");

    // E6 — redução bruta de CH4.
    const dCH4 = BE * P("r_fraction");
    push("reducao_bruta_ch4", { BE, r_fraction: P("r_fraction") }, dCH4, "t CH4");

    // E7 — redução bruta em CO2e.
    const ER_b = dCH4 * P("gwp_ch4");
    push("reducao_bruta_co2e", { dCH4, gwp_ch4: P("gwp_ch4") }, ER_b, "tCO2e");

    // E8 — efeito colateral do esterco (subtraído).
    const ME = ER_b * P("le_est");
    push("efeito_esterco", { ER_b, le_est: P("le_est") }, -ME, "tCO2e");

    // E9 — emissões do projeto alocadas (subtraídas).
    push("emissoes_projeto", { emissoes_alocadas_tco2e: PE }, -PE, "tCO2e");

    // E10 — vazamento de mercado (subtraído). Sempre registrado, mesmo com LF = 0.
    const leakage = ER_b * LF;
    push("vazamento_mercado", { ER_b, LF }, -leakage, "tCO2e");

    // E11 — redução líquida antes da incerteza.
    const ER_n = ER_b - ME - PE - leakage;
    push("reducao_liquida", { ER_b, ME, PE, leakage }, ER_n, "tCO2e");

    // E12 — dedução de incerteza: U90 combinada (IPCC 2006 Vol. 1 Cap. 3, Eq. 3.1).
    const u_R = tInv2Tail(0.1, P("gl_r")) / tInv2Tail(P("p_r"), P("gl_r"));
    const u_Ym = (P("u_ym") * 1.645) / 1.96;
    const u_AD = (P("u_ad") * 1.645) / 1.96;
    const U90 = Math.sqrt(u_R ** 2 + u_Ym ** 2 + u_AD ** 2 + P("u_dose") ** 2 + P("u_persist") ** 2);
    const deducaoFator = Math.max(0, Math.min(1, U90 - P("limiar_u")));
    const deducao = ER_n * deducaoFator;
    push("deducao_incerteza", {
      u_R, u_Ym, u_AD, u_dose: P("u_dose"), u_persist: P("u_persist"), U90, limiar_u: P("limiar_u"),
      fator_deducao: deducaoFator,
    }, -deducao, "tCO2e");

    // E13 — redução ajustada.
    const ER_aj = ER_n - deducao;
    push("reducao_ajustada", { ER_n, deducao }, ER_aj, "tCO2e");

    // E14 — reserva de integridade (0 na v2.0, mas registrada).
    const reserva = ER_aj * P("res");
    push("reserva_integridade", { ER_aj, res: P("res") }, -reserva, "tCO2e");

    // E15 — reduções verificáveis: RV = (ER_n − Ded) × (1 − RES).
    const RV = ER_aj - reserva;
    push("reducoes_verificaveis", { ER_aj, reserva }, RV, "tCO2e");

    // ---- Persistência (ciclo + etapas + lote, atômica) --------------------------------
    const { data: cycleId, error: persistError } = await supabase.rpc("persist_credit_cycle", {
      p_project_id: projectId,
      p_period_year: periodYear,
      p_methodology_version_id: project.methodology_version_id,
      p_engine_version: ENGINE_VERSION,
      p_tco2e_amount: RV,
      p_commercialization_factor: null,
      p_eligibility_factor: 1,
      p_steps: steps,
    });
    if (persistError) {
      const status = persistError.code === "P0001" ? 409 : persistError.code === "42501" ? 403 : 400;
      return json({ error: persistError.message }, status);
    }

    return json({ cycleId, tco2eFinal: RV, steps }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});

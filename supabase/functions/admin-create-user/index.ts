// Cria/convida um usuário e o associa a uma organização.
//
// Roda com a service role key (nunca exposta ao frontend) só depois de validar,
// com o token do próprio chamador, que ele pode gerenciar membros da
// organização de destino (can_manage_org_members). A regra "desenvolvedora
// não tem owner" é um trigger em org_members.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MEMBER_ROLES = ["owner", "manager", "contributor", "viewer"];

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

    const { email, orgId, memberRole, redirectTo } = await req.json();
    if (!email || !orgId || !memberRole) {
      return json({ error: "email, orgId e memberRole são obrigatórios." }, 400);
    }
    if (!MEMBER_ROLES.includes(memberRole)) {
      return json({ error: "memberRole inválido." }, 400);
    }

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) {
      return json({ error: "Não autenticado." }, 401);
    }

    // can_manage_org_members: platform admin, owner/manager da própria org, ou
    // owner/manager de uma desenvolvedora de projeto em que a org-alvo é
    // proponente/verificadora (ver migration 20261009000056).
    const { data: allowed } = await callerClient.rpc("can_manage_org_members", { p_org_id: orgId });

    if (!allowed) {
      return json({ error: "Sem permissão para criar usuários nessa organização." }, 403);
    }

    // Mesma regra do trigger em org_members, checada ANTES do convite para não
    // deixar um usuário convidado sem vínculo se o insert for recusado.
    const { data: targetOrg } = await callerClient.from("organizations").select("org_type").eq("id", orgId).maybeSingle();
    if (targetOrg?.org_type === "project_developer" && memberRole === "owner") {
      return json({ error: "Organizações desenvolvedoras não podem ter usuários com papel de owner." }, 400);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { redirectTo },
    );

    if (inviteError || !invited?.user) {
      return json({ error: inviteError?.message ?? "Erro ao convidar usuário." }, 400);
    }

    const { error: memberError } = await adminClient
      .from("org_members")
      .insert({ org_id: orgId, user_id: invited.user.id, member_role: memberRole });

    if (memberError) {
      return json({ error: memberError.message }, 400);
    }

    return json({ userId: invited.user.id, email: invited.user.email }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});

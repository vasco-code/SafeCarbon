// Proxy server-side para a API SafeGisTrace (docs/04-arquitetura-tecnica-integracoes.md §2).
//
// A arquitetura originalmente documentada previa o client obter um token de
// curta duração e chamar a SafeGisTrace diretamente do browser. Testado ao
// vivo nesta sessão: a API real não responde ao preflight CORS (OPTIONS
// retorna 400), então uma chamada direta do browser falha com "Failed to
// fetch" — a API foi desenhada para consumo servidor-a-servidor. Esta função
// faz o proxy: recebe { path } do client autenticado no SafeCarbon, troca as
// credenciais de serviço por um token (cacheado em memória entre invocações
// "quentes" para não logar de novo a cada chamada), repassa um GET para a
// SafeGisTrace e devolve a resposta com os headers de CORS do próprio
// SafeCarbon. Só GET, e só para os prefixos em ALLOWED_PATH_PREFIXES — nunca
// escreve nada na conta de serviço.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SAFEGISTRACE_API_URL = Deno.env.get("SAFEGISTRACE_API_URL")!;
const SAFEGISTRACE_SERVICE_CLIENT_ID = Deno.env.get("SAFEGISTRACE_SERVICE_CLIENT_ID")!;
const SAFEGISTRACE_SERVICE_CLIENT_SECRET = Deno.env.get("SAFEGISTRACE_SERVICE_CLIENT_SECRET")!;

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

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getServiceToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  const response = await fetch(`${SAFEGISTRACE_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: SAFEGISTRACE_SERVICE_CLIENT_ID,
      password: SAFEGISTRACE_SERVICE_CLIENT_SECRET,
    }),
  });
  if (!response.ok) {
    throw new Error("Falha ao autenticar na SafeGisTrace.");
  }
  const login = await response.json();
  // Renova 60s antes de expirar de verdade, por segurança.
  cachedToken = { value: login.access_token, expiresAt: Date.now() + (login.expires_in - 60) * 1000 };
  return cachedToken.value;
}

const ALLOWED_PATH_PREFIXES = ["/api/qi/protocols", "/api/qi/analyses"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autenticado." }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Não autenticado." }, 401);
    }

    const { path } = await req.json();
    if (!path || typeof path !== "string") {
      return json({ error: "path é obrigatório." }, 400);
    }
    // Só permite os endpoints de leitura que o SafeCarbon realmente usa —
    // nunca vira um proxy genérico para qualquer rota (inclusive de escrita)
    // da conta de serviço, que hoje é um tenant de outro produto (ver task
    // pendente de troca de credencial).
    if (!ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return json({ error: "Caminho não permitido pelo proxy." }, 403);
    }

    const token = await getServiceToken();
    const upstream = await fetch(`${SAFEGISTRACE_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await upstream.json();
    return json(body, upstream.status);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Erro inesperado." }, 500);
  }
});

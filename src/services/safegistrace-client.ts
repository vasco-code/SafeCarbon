// Cliente da API SafeGisTrace (docs/04-arquitetura-tecnica-integracoes.md §2).
// Contrato confirmado via /openapi.json em 2026-07-05 (SafeGisTrace API
// Simplificada v1.0.0) — difere do contrato originalmente assumido nos docs
// (não existe /farm/:place_id nem /safegistrace/protocols; os endpoints reais
// vivem sob /api/qi/...).
//
// Todas as chamadas passam pela Edge Function safegistrace-proxy: a API real
// não responde ao preflight CORS, então o browser não consegue chamá-la
// direto (testado ao vivo — ver comentário na Edge Function). O proxy roda
// server-side e nunca expõe a credencial de serviço ao client.
import { supabase } from "@/lib/supabase";

export interface SafeGisTraceProtocol {
  name: string;
  description: string;
  active: boolean;
  analises_api: string;
  criteria: Array<{ code: string; name: string; type: string; enabled: boolean }>;
}

export interface SafeGisTraceAnalysisListItem {
  id: string;
  car: string;
  reference: string;
  estado: string;
  cidade: string;
  request_number: string;
  request_status: string;
  protocol_name: string;
  overall_status: string;
  has_report: boolean;
  has_geojsons: boolean;
  created_at: string;
}

async function proxyGet<T>(path: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke("safegistrace-proxy", {
    body: { path },
  });
  if (error) {
    throw new Error(error.message ?? `Erro ao chamar SafeGisTrace (${path}).`);
  }
  return data as T;
}

export function getProtocols(active?: boolean): Promise<{ items: SafeGisTraceProtocol[] }> {
  const query = active === undefined ? "" : `?active=${active}`;
  return proxyGet(`/api/qi/protocols${query}`);
}

export function getAnalyses(page = 1, limit = 20): Promise<{
  page: number;
  total: number;
  items: SafeGisTraceAnalysisListItem[];
}> {
  return proxyGet(`/api/qi/analyses?page=${page}&limit=${limit}`);
}

export function getAnalysisSummary(analysisId: string): Promise<Record<string, unknown>> {
  return proxyGet(`/api/qi/analyses/${analysisId}/summary`);
}

export function getAnalysisGeojsons(analysisId: string): Promise<Record<string, unknown>> {
  return proxyGet(`/api/qi/analyses/${analysisId}/geojsons`);
}

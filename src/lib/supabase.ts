import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// O Vite exige o prefixo VITE_ para expor variáveis ao frontend
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Se as variáveis estiverem vindo da imagem, use o mapeamento abaixo:
// VITE_SUPABASE_URL = SUPABASE_URL
// VITE_SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "🚨 Erro de Configuração: Variáveis do Supabase não encontradas!\n\n" +
    "Vá em 'Secrets' ou no seu arquivo .env e adicione:\n" +
    "VITE_SUPABASE_URL=https://zaodhkbeptrvwpwyhbaf.supabase.co\n" +
    "VITE_SUPABASE_ANON_KEY=sb_publishable_L1k3A6WE_9GcMr4ddxBl8g_kmpxRKOM"
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);
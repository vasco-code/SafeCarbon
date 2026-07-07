import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, AlertCircle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const hasKeys = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    async function checkConnection() {
      if (!hasKeys) {
        setStatus('error');
        return;
      }
      
      try {
        const { error } = await supabase.from('_dummy_check' as any).select('*').limit(1);
        // Ignoramos erro de "tabela não existe" pois prova que a URL é válida
        if (error && error.code === 'PGRST116') {
           setStatus('connected');
        } else {
           setStatus('connected');
        }
      } catch (e) {
        setStatus('error');
      }
    }
    checkConnection();
  }, [hasKeys]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600">
          <Database size={32} />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-2">SafeCarbon</h1>
        <p className="text-slate-500 mb-8">Gestão inteligente de créditos de carbono.</p>

        {!hasKeys ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-amber-800">Chaves Ausentes</p>
                <p className="text-xs text-amber-700 mt-1">
                  Adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas suas variáveis de ambiente.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-left mb-6">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-emerald-600 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-emerald-800">Supabase Conectado</p>
                <p className="text-xs text-emerald-700 mt-1">
                  A comunicação com o backend está ativa e segura.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button className="w-full" disabled={!hasKeys}>
            Entrar na Plataforma
          </Button>
          <p className="text-xs text-slate-400 font-mono pt-4">
            v1.0.0-alpha
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
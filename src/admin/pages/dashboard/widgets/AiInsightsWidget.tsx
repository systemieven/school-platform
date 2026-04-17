/**
 * AiInsightsWidget
 *
 * Widget opcional que invoca o agente `dashboard_insights` do
 * ai-orchestrator e exibe 3 bullets diários de insight sobre as
 * métricas atuais do painel. Render lazy — só faz a chamada quando
 * o usuário clica em "Gerar insights" (evita custo em cada refresh
 * de período). Falha silenciosa se o agente estiver desabilitado
 * ou sem chave configurada.
 */
import { useState } from 'react';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';

export interface AiInsightsWidgetProps {
  metrics: Record<string, unknown>;
}

export function AiInsightsWidget({ metrics }: AiInsightsWidgetProps) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error: fnErr } = await supabase.functions.invoke('ai-orchestrator', {
        body: {
          agent_slug: 'dashboard_insights',
          context: { date: today, metrics_summary: JSON.stringify(metrics) },
        },
      });
      if (fnErr) throw fnErr;
      const text = (data as { text?: string })?.text ?? '';
      let parsed: string[] = [];
      try {
        const json = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
        if (Array.isArray(json)) parsed = json.map(String);
        else if (Array.isArray(json.bullets)) parsed = json.bullets.map(String);
      } catch {
        parsed = text.split('\n').map((l) => l.replace(/^[-*•\d.\s]+/, '').trim()).filter(Boolean).slice(0, 3);
      }
      if (parsed.length === 0) throw new Error('Resposta vazia');
      setBullets(parsed.slice(0, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar insights');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-display text-sm font-bold text-brand-primary dark:text-white">Insights do dia (IA)</h3>
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="text-xs text-brand-primary dark:text-brand-secondary hover:underline flex items-center gap-1 disabled:opacity-50"
        >
          {busy ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Gerando…</>
          ) : bullets.length > 0 ? (
            <><RefreshCw className="w-3 h-3" /> Atualizar</>
          ) : (
            <><Sparkles className="w-3 h-3" /> Gerar insights</>
          )}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {bullets.length === 0 && !error ? (
        <div className="text-center py-6">
          <Sparkles className="w-8 h-8 text-purple-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Clique em "Gerar insights" para receber 3 bullets sobre os dados do período.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm text-gray-700 dark:text-gray-200 leading-relaxed"
            >
              <span className="text-purple-500 font-bold">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

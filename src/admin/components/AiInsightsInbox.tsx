import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Inbox, AlertTriangle, AlertOctagon, Info, MessageCircle, ArrowRight, Check } from 'lucide-react';
import { useAiInsights, type AiInsight, type InsightSeverity } from '../hooks/useAiInsights';
import AiComposeMessage, { type ComposeContext } from './AiComposeMessage';

const SEVERITY_CONFIG: Record<InsightSeverity, { icon: React.ComponentType<{ className?: string }>; bg: string; text: string; label: string }> = {
  critical: { icon: AlertOctagon,  bg: 'bg-red-100 dark:bg-red-900/40',     text: 'text-red-600 dark:text-red-400',     label: 'Crítico' },
  high:     { icon: AlertTriangle, bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-600 dark:text-orange-400', label: 'Alto' },
  medium:   { icon: Sparkles,      bg: 'bg-amber-100 dark:bg-amber-900/40',  text: 'text-amber-600 dark:text-amber-400',   label: 'Médio' },
  low:      { icon: Info,          bg: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-600 dark:text-blue-400',     label: 'Baixo' },
};

function timeAgo(s: string) {
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export default function AiInsightsInbox() {
  const { insights, totalCount, countsBySeverity, markSeen, dismiss, resolve } = useAiInsights();
  const [open, setOpen] = useState(false);
  const [compose, setCompose] = useState<ComposeContext | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const urgentCount = countsBySeverity.critical + countsBySeverity.high;
  const badgeColor = countsBySeverity.critical > 0 ? 'bg-red-500'
    : countsBySeverity.high > 0 ? 'bg-orange-500'
    : 'bg-brand-primary';

  function handleAction(insight: AiInsight, action: AiInsight['actions'][number]) {
    if (action.type === 'navigate' && action.params?.path) {
      navigate(String(action.params.path));
      markSeen(insight.id);
      setOpen(false);
    } else if (action.type === 'whatsapp') {
      setCompose({
        student_id: action.params?.student_id as string | undefined,
        guardian_id: action.params?.guardian_id as string | undefined,
        context_type: (action.params?.context_type as string) ?? insight.agent_slug,
        context_payload: { insight_id: insight.id, ...insight.payload },
        suggested_text: (action.params?.suggested_text as string) ?? insight.summary,
      });
    } else if (action.type === 'resolve') {
      resolve(insight.id);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Insights do assistente IA"
      >
        <Sparkles className="w-5 h-5" />
        {totalCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] ${badgeColor} text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none`}>
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-[420px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 flex flex-col"
          style={{ maxHeight: 'calc(100vh - 80px)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
              <span className="font-semibold text-gray-900 dark:text-white text-sm">Assistente IA</span>
              {urgentCount > 0 && (
                <span className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {urgentCount} urgente{urgentCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {insights.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Inbox className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400 dark:text-gray-500">Nada demanda sua atenção agora.</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">O assistente avisa quando algo aparecer.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {insights.map((ins) => {
                  const cfg = SEVERITY_CONFIG[ins.severity];
                  const Icon = cfg.icon;
                  return (
                    <div key={ins.id} className="px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                          <Icon className={`w-4 h-4 ${cfg.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{ins.title}</p>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">{timeAgo(ins.created_at)}</span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{ins.summary}</p>

                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {ins.actions?.map((a, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleAction(ins, a)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-brand-primary/10 dark:bg-brand-secondary/10 text-brand-primary dark:text-brand-secondary hover:bg-brand-primary/20 dark:hover:bg-brand-secondary/20 transition-colors"
                              >
                                {a.type === 'whatsapp'
                                  ? <MessageCircle className="w-3 h-3" />
                                  : a.type === 'resolve'
                                    ? <Check className="w-3 h-3" />
                                    : <ArrowRight className="w-3 h-3" />}
                                {a.label}
                              </button>
                            ))}
                            <button
                              onClick={() => dismiss(ins.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              Dispensar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {compose && (
        <AiComposeMessage
          context={compose}
          onClose={() => setCompose(null)}
        />
      )}
    </div>
  );
}

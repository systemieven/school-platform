import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, ArrowRight, MessageCircle, Check, AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { useAiInsights, type AiInsight, type InsightSeverity } from '../hooks/useAiInsights';
import { useAiRouteContext } from '../hooks/useAiRouteContext';
import AiComposeMessage, { type ComposeContext } from './AiComposeMessage';

const DISMISS_KEY = 'ai_nudge_dismissed_v1';

const SEVERITY_ACCENT: Record<InsightSeverity, { bar: string; icon: React.ComponentType<{ className?: string }>; iconBg: string; iconText: string }> = {
  critical: { bar: 'bg-red-500',     icon: AlertOctagon,  iconBg: 'bg-red-100 dark:bg-red-900/40',     iconText: 'text-red-600 dark:text-red-400' },
  high:     { bar: 'bg-orange-500',  icon: AlertTriangle, iconBg: 'bg-orange-100 dark:bg-orange-900/40', iconText: 'text-orange-600 dark:text-orange-400' },
  medium:   { bar: 'bg-amber-500',   icon: Sparkles,      iconBg: 'bg-amber-100 dark:bg-amber-900/40',  iconText: 'text-amber-600 dark:text-amber-400' },
  low:      { bar: 'bg-blue-500',    icon: Info,          iconBg: 'bg-blue-100 dark:bg-blue-900/40',    iconText: 'text-blue-600 dark:text-blue-400' },
};

function scoreInsight(ins: AiInsight, module: string | null, entity_id: string | null): number {
  let s = 0;
  if (module && ins.related_module === module) s += 10;
  if (entity_id && ins.related_entity_id === entity_id) s += 20;
  s += ({ critical: 4, high: 3, medium: 2, low: 1 } as const)[ins.severity];
  return s;
}

function loadDismissed(): Set<string> {
  try { return new Set<string>(JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '[]')); }
  catch { return new Set(); }
}

function persistDismissed(set: Set<string>) {
  try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set))); } catch {}
}

export default function AiContextualNudge() {
  const { insights, markSeen, dismiss, resolve } = useAiInsights();
  const route = useAiRouteContext();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [expanded, setExpanded] = useState(false);
  const [compose, setCompose] = useState<ComposeContext | null>(null);

  const topInsight = useMemo<AiInsight | null>(() => {
    const candidates = insights.filter((i) => !dismissed.has(i.id));
    if (candidates.length === 0) return null;
    const scored = candidates
      .map((i) => ({ i, s: scoreInsight(i, route.module, route.entity_id) }))
      .sort((a, b) => b.s - a.s);
    const top = scored[0];
    if (route.module && top.i.related_module !== route.module && top.i.severity !== 'critical') {
      return null;
    }
    return top.i;
  }, [insights, dismissed, route.module, route.entity_id]);

  useEffect(() => { setExpanded(false); }, [topInsight?.id]);

  if (!topInsight) return null;
  const cfg = SEVERITY_ACCENT[topInsight.severity];
  const Icon = cfg.icon;

  function handleDismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    persistDismissed(next);
    setExpanded(false);
  }

  function handleAction(ins: AiInsight, action: AiInsight['actions'][number]) {
    if (action.type === 'navigate' && action.params?.path) {
      navigate(String(action.params.path));
      markSeen(ins.id);
    } else if (action.type === 'whatsapp') {
      setCompose({
        student_id: action.params?.student_id as string | undefined,
        guardian_id: action.params?.guardian_id as string | undefined,
        context_type: (action.params?.context_type as string) ?? ins.agent_slug,
        context_payload: { insight_id: ins.id, ...ins.payload },
        suggested_text: (action.params?.suggested_text as string) ?? ins.summary,
      });
    } else if (action.type === 'resolve') {
      resolve(ins.id);
    }
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 pointer-events-none">
        {!expanded ? (
          <button
            onClick={() => { setExpanded(true); markSeen(topInsight.id); }}
            className="pointer-events-auto group flex items-center gap-2.5 pl-3 pr-4 py-2.5 bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl transition-all animate-in slide-in-from-bottom-4 fade-in duration-500"
          >
            <span className={`w-2 h-2 rounded-full ${cfg.bar} animate-pulse`} />
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.iconBg}`}>
              <Icon className={`w-4 h-4 ${cfg.iconText}`} />
            </div>
            <span className="text-xs font-medium text-gray-900 dark:text-white max-w-[240px] truncate">
              {topInsight.title}
            </span>
          </button>
        ) : (
          <div className="pointer-events-auto w-[360px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className={`h-1 ${cfg.bar}`} />
            <div className="px-4 py-3 flex items-start gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                <Icon className={`w-4 h-4 ${cfg.iconText}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">
                    <Sparkles className="w-3 h-3" />
                    Assistente
                  </div>
                  <button
                    onClick={() => handleDismiss(topInsight.id)}
                    className="p-1 -mt-1 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Dispensar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug mt-1">{topInsight.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{topInsight.summary}</p>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {topInsight.actions?.map((a, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAction(topInsight, a)}
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
                    onClick={() => { dismiss(topInsight.id); handleDismiss(topInsight.id); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Depois
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {compose && (
        <AiComposeMessage
          context={compose}
          onClose={() => setCompose(null)}
        />
      )}
    </>
  );
}

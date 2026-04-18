import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, ArrowRight, Check, AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import { usePortalAiInsights, type PortalAiInsight, type InsightSeverity } from '../hooks/usePortalAiInsights';

const DISMISS_KEY = 'portal_ai_nudge_dismissed_v1';

const SEVERITY_ACCENT: Record<InsightSeverity, { bar: string; icon: React.ComponentType<{ className?: string }>; iconBg: string; iconText: string }> = {
  critical: { bar: 'bg-red-500',    icon: AlertOctagon,  iconBg: 'bg-red-100',    iconText: 'text-red-600' },
  high:     { bar: 'bg-orange-500', icon: AlertTriangle, iconBg: 'bg-orange-100', iconText: 'text-orange-600' },
  medium:   { bar: 'bg-amber-500',  icon: Sparkles,      iconBg: 'bg-amber-100',  iconText: 'text-amber-600' },
  low:      { bar: 'bg-blue-500',   icon: Info,          iconBg: 'bg-blue-100',   iconText: 'text-blue-600' },
};

function loadDismissed(): Set<string> {
  try { return new Set<string>(JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '[]')); }
  catch { return new Set(); }
}
function persistDismissed(set: Set<string>) {
  try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set))); } catch {}
}

export default function PortalAiNudge({ authUserId }: { authUserId: string | null | undefined }) {
  const { insights, markSeen, dismiss, resolve } = usePortalAiInsights(authUserId);
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [expanded, setExpanded] = useState(false);

  const topInsight = useMemo<PortalAiInsight | null>(() => {
    const candidates = insights.filter((i) => !dismissed.has(i.id));
    return candidates[0] ?? null;
  }, [insights, dismissed]);

  useEffect(() => { setExpanded(false); }, [topInsight?.id]);

  if (!topInsight || !authUserId) return null;
  const cfg = SEVERITY_ACCENT[topInsight.severity];
  const Icon = cfg.icon;

  function handleDismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    persistDismissed(next);
    setExpanded(false);
  }

  function handleAction(ins: PortalAiInsight, action: PortalAiInsight['actions'][number]) {
    if (action.type === 'navigate' && action.params?.path) {
      const path = String(action.params.path);
      if (path.startsWith('http')) window.open(path, '_blank', 'noopener,noreferrer');
      else navigate(path);
      markSeen(ins.id);
    } else if (action.type === 'resolve') {
      resolve(ins.id);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 pointer-events-none">
      {!expanded ? (
        <button
          onClick={() => { setExpanded(true); markSeen(topInsight.id); }}
          className="pointer-events-auto group flex items-center gap-2.5 pl-3 pr-4 py-2.5 bg-white rounded-full shadow-xl border border-gray-100 hover:shadow-2xl transition-all animate-in slide-in-from-bottom-4 fade-in duration-500"
        >
          <span className={`w-2 h-2 rounded-full ${cfg.bar} animate-pulse`} />
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.iconBg}`}>
            <Icon className={`w-4 h-4 ${cfg.iconText}`} />
          </div>
          <span className="text-xs font-medium text-gray-900 max-w-[240px] truncate">
            {topInsight.title}
          </span>
        </button>
      ) : (
        <div className="pointer-events-auto w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`h-1 ${cfg.bar}`} />
          <div className="px-4 py-3 flex items-start gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
              <Icon className={`w-4 h-4 ${cfg.iconText}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold text-gray-400">
                  <Sparkles className="w-3 h-3" />
                  Assistente
                </div>
                <button
                  onClick={() => handleDismiss(topInsight.id)}
                  className="p-1 -mt-1 -mr-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Dispensar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-snug mt-1">{topInsight.title}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{topInsight.summary}</p>

              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {topInsight.actions?.map((a, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAction(topInsight, a)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors"
                  >
                    {a.type === 'resolve' ? <Check className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                    {a.label}
                  </button>
                ))}
                <button
                  onClick={() => { dismiss(topInsight.id); handleDismiss(topInsight.id); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  Depois
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import type { CalledTicket } from './usePanelRealtime';
import type { PanelTheme } from './themes';

interface Props {
  history: Map<string, CalledTicket[]>;
  theme: PanelTheme;
  sectors: Array<{ key: string; label: string }>;
}

export default function HistoryGrid({ history, theme, sectors }: Props) {
  // Only show sectors that have history entries
  const activeSectors = sectors.filter((s) => {
    const entries = history.get(s.key);
    return entries && entries.length > 0;
  });

  if (activeSectors.length === 0) return null;

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${Math.min(activeSectors.length, 4)}, minmax(0, 1fr))`,
      }}
    >
      {activeSectors.map((sector) => {
        const entries = history.get(sector.key) || [];
        return (
          <div
            key={sector.key}
            className="rounded-xl p-4"
            style={{ backgroundColor: theme.card }}
          >
            <p
              className="text-xs font-semibold tracking-widest uppercase mb-3 pb-2 border-b"
              style={{ color: theme.muted, borderColor: `${theme.muted}20` }}
            >
              {sector.label}
            </p>
            <div className="space-y-1.5">
              {entries.map((ticket, idx) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg"
                  style={{
                    opacity: 1 - idx * 0.15,
                    backgroundColor: `${theme.accent}15`,
                  }}
                >
                  <span
                    className="text-lg font-bold"
                    style={{ color: theme.text }}
                  >
                    {ticket.ticket_number}
                  </span>
                  {ticket.visitor_name && (
                    <span
                      className="text-xs truncate max-w-[50%]"
                      style={{ color: theme.muted }}
                    >
                      {ticket.visitor_name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

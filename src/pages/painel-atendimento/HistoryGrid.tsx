import type { CalledTicket } from './usePanelRealtime';
import type { PanelTheme } from './themes';

interface Props {
  history: CalledTicket[];
  theme: PanelTheme;
}

export default function HistoryGrid({ history, theme }: Props) {
  if (history.length === 0) return null;

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${Math.min(history.length, 5)}, minmax(0, 1fr))`,
      }}
    >
      {history.map((ticket, idx) => (
        <div
          key={ticket.id}
          className="rounded-xl px-4 py-3 flex flex-col items-center gap-1"
          style={{
            backgroundColor: theme.card,
            opacity: 1 - idx * 0.1,
          }}
        >
          <span
            className="text-xs sm:text-sm font-semibold tracking-widest uppercase"
            style={{ color: theme.muted }}
          >
            {ticket.sector_label}
          </span>
          <span
            className="text-2xl sm:text-3xl lg:text-4xl font-bold"
            style={{ color: theme.text }}
          >
            {ticket.ticket_number}
          </span>
          {ticket.visitor_name && (
            <span
              className="text-xs sm:text-sm truncate max-w-full"
              style={{ color: theme.muted }}
            >
              {ticket.visitor_name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

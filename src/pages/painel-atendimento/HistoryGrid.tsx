import type { CalledTicket } from './usePanelRealtime';
import type { PanelTheme } from './themes';

interface Props {
  history: CalledTicket[];
  theme: PanelTheme;
  showVisitorName?: boolean;
}

export default function HistoryGrid({ history, theme, showVisitorName = true }: Props) {
  if (history.length === 0) return null;

  return (
    <div>
      <p
        className="text-xs sm:text-sm font-semibold tracking-widest uppercase mb-3 text-center"
        style={{ color: theme.muted }}
      >
        Últimas senhas chamadas
      </p>
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${Math.min(history.length, 4)}, minmax(0, 1fr))`,
      }}
    >
      {history.slice(0, 4).map((ticket, idx) => (
        <div
          key={ticket.id}
          className="rounded-xl px-5 py-4 flex flex-col items-center gap-1.5"
          style={{
            backgroundColor: theme.card,
            opacity: 1 - idx * 0.1,
          }}
        >
          <span
            className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-center leading-tight"
            style={{ color: theme.muted }}
          >
            {ticket.sector_label}
          </span>
          <span
            className="text-3xl sm:text-4xl lg:text-5xl font-bold"
            style={{ color: theme.text }}
          >
            {ticket.ticket_number}
          </span>
          {showVisitorName && ticket.visitor_name && (
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
    </div>
  );
}

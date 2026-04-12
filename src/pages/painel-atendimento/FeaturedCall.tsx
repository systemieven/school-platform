import type { CalledTicket } from './usePanelRealtime';
import type { PanelTheme } from './themes';
import { Clock } from 'lucide-react';

interface Props {
  ticket: CalledTicket | null;
  showVisitorName: boolean;
  theme: PanelTheme;
}

export default function FeaturedCall({ ticket, showVisitorName, theme }: Props) {
  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 animate-pulse">
        <Clock className="w-20 h-20" style={{ color: theme.muted }} />
        <p className="text-2xl font-medium" style={{ color: theme.muted }}>
          Aguardando chamada...
        </p>
      </div>
    );
  }

  return (
    <div
      key={ticket.id}
      className="flex flex-col items-center justify-center gap-4"
      style={{ animation: 'panelCallIn 500ms ease-out' }}
    >
      <p
        className="text-4xl sm:text-5xl lg:text-7xl font-semibold tracking-widest uppercase"
        style={{ color: theme.muted }}
      >
        {ticket.sector_label}
      </p>

      <p
        className="font-black leading-none -mt-2"
        style={{
          fontSize: 'clamp(9rem, 20vw, 18rem)',
          color: theme.highlight,
          animation: 'panelGlow 2s ease-in-out 3',
          textShadow: `0 0 40px ${theme.highlight}40`,
        }}
      >
        {ticket.ticket_number}
      </p>

      {showVisitorName && ticket.visitor_name && (
        <p
          className="text-2xl sm:text-3xl lg:text-4xl font-medium"
          style={{ color: theme.text, opacity: 0.85 }}
        >
          {ticket.visitor_name}
        </p>
      )}
    </div>
  );
}

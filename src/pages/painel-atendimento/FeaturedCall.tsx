import type { CalledTicket } from './usePanelRealtime';
import type { PanelTheme } from './themes';
import { Clock } from 'lucide-react';

interface Props {
  ticket: CalledTicket | null;
  showVisitorName: boolean;
  ticketEffect: string;
  theme: PanelTheme;
}

function getEffectStyles(effect: string, highlight: string): { container: React.CSSProperties; number: React.CSSProperties } {
  switch (effect) {
    case 'slide':
      return {
        container: { animation: 'panelSlideIn 600ms ease-out' },
        number: {
          fontSize: 'clamp(9rem, 20vw, 18rem)',
          color: highlight,
          textShadow: `0 0 40px ${highlight}40`,
        },
      };
    case 'bounce':
      return {
        container: { animation: 'panelBounceIn 700ms ease-out' },
        number: {
          fontSize: 'clamp(9rem, 20vw, 18rem)',
          color: highlight,
          textShadow: `0 4px 20px ${highlight}30`,
        },
      };
    case 'neon':
      return {
        container: { animation: 'panelCallIn 500ms ease-out' },
        number: {
          fontSize: 'clamp(9rem, 20vw, 18rem)',
          color: highlight,
          '--neon-color': `${highlight}80`,
          animation: 'panelNeonPulse 1.5s ease-in-out 3',
          textShadow: `0 0 10px ${highlight}, 0 0 30px ${highlight}, 0 0 60px ${highlight}`,
        } as React.CSSProperties,
      };
    case 'glow':
    default:
      return {
        container: { animation: 'panelCallIn 500ms ease-out' },
        number: {
          fontSize: 'clamp(9rem, 20vw, 18rem)',
          color: highlight,
          animation: 'panelGlow 2s ease-in-out 3',
          textShadow: `0 0 40px ${highlight}40`,
        },
      };
  }
}

export default function FeaturedCall({ ticket, showVisitorName, ticketEffect, theme }: Props) {
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

  const styles = getEffectStyles(ticketEffect, theme.highlight);

  return (
    <div
      key={ticket.id}
      className="flex flex-col items-center justify-center gap-4"
      style={styles.container}
    >
      <p
        className="text-4xl sm:text-5xl lg:text-7xl font-semibold tracking-widest uppercase"
        style={{ color: theme.muted }}
      >
        {ticket.sector_label}
      </p>

      <p
        className="font-black leading-none -mt-2"
        style={styles.number}
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

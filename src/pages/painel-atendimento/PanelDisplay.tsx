import { useCallback, useRef } from 'react';
import usePanelRealtime from './usePanelRealtime';
import FeaturedCall from './FeaturedCall';
import HistoryGrid from './HistoryGrid';
import ConnectionIndicator from './ConnectionIndicator';
import { THEMES, SOUND_FILES, type PanelTheme } from './themes';

interface PanelConfig {
  show_visitor_name: boolean;
  sound_preset: string;
  sound_repeat: number;
  history_count: number;
  sector_filter: string[];
  theme: string;
}

interface Props {
  config: PanelConfig;
  schoolName: string | null;
  sectors: Array<{ key: string; label: string }>;
}

function playCallSound(preset: string, repeat: number) {
  let count = 0;
  function playOnce() {
    const file = SOUND_FILES[preset] || SOUND_FILES.bell;
    const audio = new Audio(file);
    audio.addEventListener('ended', () => {
      count++;
      if (count < repeat) setTimeout(playOnce, 400);
    });
    audio.play().catch(() => {});
  }
  playOnce();
}

export default function PanelDisplay({ config, schoolName, sectors }: Props) {
  const soundRef = useRef({ preset: config.sound_preset, repeat: config.sound_repeat });
  soundRef.current = { preset: config.sound_preset, repeat: config.sound_repeat };

  const onCall = useCallback(() => {
    playCallSound(soundRef.current.preset, soundRef.current.repeat);
  }, []);

  const { featured, history, connected } = usePanelRealtime({
    sector_filter: config.sector_filter,
    history_count: config.history_count,
    onCall,
  });

  const theme: PanelTheme = THEMES[config.theme] || THEMES['dark-blue'];

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      {/* CSS keyframes */}
      <style>{`
        @keyframes panelCallIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes panelGlow {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.3); }
        }
      `}</style>

      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: `${theme.muted}15` }}
      >
        <h1 className="text-lg font-bold tracking-wide" style={{ color: theme.text }}>
          {schoolName || 'Painel de Atendimento'}
        </h1>
        <ConnectionIndicator connected={connected} />
      </header>

      {/* Featured call */}
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <FeaturedCall
          ticket={featured}
          showVisitorName={config.show_visitor_name}
          theme={theme}
        />
      </main>

      {/* History */}
      <footer className="px-6 pb-6">
        <HistoryGrid history={history} theme={theme} sectors={sectors} />
      </footer>
    </div>
  );
}

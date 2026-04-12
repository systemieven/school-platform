import { useState } from 'react';
import PanelAuthScreen from './painel-atendimento/PanelAuthScreen';
import PanelDisplay from './painel-atendimento/PanelDisplay';

interface AuthResult {
  config: {
    show_history: boolean;
    show_visitor_name: boolean;
    ticket_effect: string;
    sound_preset: string;
    sound_repeat: number;
    history_count: number;
    sector_filter: string[];
    theme: string;
  };
  school_name: string | null;
  sectors: Array<{ key: string; label: string }>;
}

export default function PainelAtendimento() {
  const [auth, setAuth] = useState<AuthResult | null>(null);

  if (!auth) {
    return <PanelAuthScreen onAuth={setAuth} />;
  }

  return (
    <PanelDisplay
      config={auth.config}
      schoolName={auth.school_name}
    />
  );
}

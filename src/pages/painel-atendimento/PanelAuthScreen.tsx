import { useState } from 'react';
import { Loader2, Lock, Maximize } from 'lucide-react';

interface PanelConfig {
  show_visitor_name: boolean;
  sound_preset: string;
  sound_repeat: number;
  history_count: number;
  sector_filter: string[];
  theme: string;
}

interface AuthResult {
  config: PanelConfig;
  school_name: string | null;
  sectors: Array<{ key: string; label: string }>;
}

interface Props {
  onAuth: (result: AuthResult) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dinbwugbwnkrzljuocbs.supabase.co';

export default function PanelAuthScreen({ onAuth }: Props) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/attendance-panel-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.authorized) {
        setError(
          res.status === 404
            ? 'Painel de chamadas ainda n\u00e3o configurado.'
            : 'Senha incorreta.',
        );
        setLoading(false);
        return;
      }

      onAuth({
        config: data.config,
        school_name: data.school_name,
        sectors: data.sectors,
      });
    } catch {
      setError('Erro ao conectar. Tente novamente.');
      setLoading(false);
    }
  }

  function enterFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 bg-[#111d33] rounded-2xl p-8 shadow-2xl"
      >
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-[#003876] flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-[#ffd700]" />
          </div>
          <h1 className="text-xl font-bold text-white">Painel de Chamadas</h1>
          <p className="text-sm text-gray-400">Insira a senha para acessar o painel</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha do painel"
          autoFocus
          className="w-full px-4 py-3 rounded-xl bg-[#0a1628] border border-gray-600 text-white text-center text-lg tracking-widest placeholder:text-gray-500 outline-none focus:border-[#ffd700] focus:ring-2 focus:ring-[#ffd700]/20 transition-all"
        />

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="w-full py-3 rounded-xl bg-[#003876] text-white font-semibold text-sm hover:bg-[#002855] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Entrar'
          )}
        </button>

        <button
          type="button"
          onClick={enterFullscreen}
          className="w-full py-2.5 rounded-xl border border-gray-600 text-gray-400 text-xs font-medium hover:text-white hover:border-gray-400 transition-all flex items-center justify-center gap-2"
        >
          <Maximize className="w-3.5 h-3.5" />
          Tela cheia
        </button>
      </form>
    </div>
  );
}

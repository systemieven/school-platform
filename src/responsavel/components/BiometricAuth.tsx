/**
 * BiometricAuth
 *
 * Overlay de confirmação de identidade para ações sensíveis no portal do responsável.
 * Se o guardião tiver uma credencial biométrica cadastrada e o dispositivo der suporte,
 * exibe o botão biométrico como opção principal.
 * Sempre oferece fallback para senha (via signInWithPassword).
 *
 * Props:
 *   credentialId   — rawId base64url da credencial registrada (null → só senha)
 *   guardianEmail  — email derivado do CPF (para signInWithPassword)
 *   title          — título exibido no overlay (ex: "Confirmar Autorização de Saída")
 *   onSuccess      — callback chamado após autenticação bem-sucedida
 *   onCancel       — callback para voltar
 */
import { useState, useEffect } from 'react';
import { Loader2, Lock, Fingerprint, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWebAuthn } from '../hooks/useWebAuthn';

interface Props {
  credentialId:  string | null;
  guardianEmail: string;
  title:         string;
  onSuccess:     () => void;
  onCancel:      () => void;
}

type Mode = 'biometric' | 'password';

export default function BiometricAuth({ credentialId, guardianEmail, title, onSuccess, onCancel }: Props) {
  const { isPlatformAvailable, authenticate } = useWebAuthn();

  const [platformReady, setPlatformReady] = useState(false);
  const [mode, setMode]                   = useState<Mode>('password');
  const [password, setPassword]           = useState('');
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    if (credentialId) {
      isPlatformAvailable().then((ok) => {
        if (ok) { setPlatformReady(true); setMode('biometric'); }
      });
    }
  }, [credentialId, isPlatformAvailable]);

  async function handleBiometric() {
    if (!credentialId) return;
    setLoading(true);
    setError('');
    const { verified, error: authErr } = await authenticate(credentialId);
    setLoading(false);
    if (verified) { onSuccess(); }
    else { setError(authErr ?? 'Falha na autenticação biométrica.'); }
  }

  async function handlePassword() {
    if (!password.trim()) { setError('Informe sua senha.'); return; }
    setLoading(true);
    setError('');
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: guardianEmail, password });
    setLoading(false);
    if (authErr) { setError('Senha incorreta. Tente novamente.'); }
    else { onSuccess(); }
  }

  const inp = `w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none transition-colors`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-amber-200 dark:border-amber-700/50 overflow-hidden">
      {/* Header */}
      <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-3 border-b border-amber-100 dark:border-amber-700/50 flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">Confirmação de Identidade</span>
      </div>

      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>

        {/* Biometric mode */}
        {mode === 'biometric' && platformReady && credentialId && (
          <div className="space-y-3">
            <button
              onClick={handleBiometric}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Fingerprint className="w-5 h-5" />}
              {loading ? 'Aguardando biometria…' : 'Usar biometria'}
            </button>

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}

            <button
              onClick={() => { setMode('password'); setError(''); }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1 transition-colors"
            >
              Usar senha em vez disso
            </button>
          </div>
        )}

        {/* Password mode */}
        {mode === 'password' && (
          <div className="space-y-3">
            {platformReady && credentialId && (
              <button
                onClick={() => { setMode('biometric'); setError(''); }}
                className="flex items-center gap-1.5 text-xs text-brand-primary dark:text-brand-secondary hover:underline"
              >
                <Fingerprint className="w-3.5 h-3.5" /> Usar biometria
              </button>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Sua Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePassword(); }}
                placeholder="Digite sua senha..."
                className={inp}
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          {mode === 'password' && (
            <button
              onClick={handlePassword}
              disabled={loading || !password.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-brand-primary hover:bg-brand-primary-dark text-white transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {loading ? 'Verificando…' : 'Confirmar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

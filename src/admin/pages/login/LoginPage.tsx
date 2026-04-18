import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { Lock, Mail, Eye, EyeOff, Loader2, AlertCircle, Building2, MessageCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useBranding } from '../../../contexts/BrandingContext';
import { supabase } from '../../../lib/supabase';

type Mode = 'login' | 'forgot';

/**
 * LoginPage — tela unica de /admin/login.
 *
 * Modo 'forgot': invoca a edge function `user-request-access` para
 * disparar uma senha provisoria via WhatsApp. Atende admin, coordinator,
 * teacher e user — super_admin fica excluído por segurança e precisa
 * reset manual via admin da plataforma.
 */
export default function LoginPage() {
  const { profile, loading: authLoading, error: authError, signIn } = useAdminAuth();
  const { identity } = useBranding();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forgot-password state
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  // Already logged in — redirect to dashboard
  if (profile) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    await signIn(email, password);
    setSubmitting(false);
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setForgotMsg({ kind: 'error', text: 'Informe seu e-mail.' });
      return;
    }
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('user-request-access', {
        body: { email: email.trim().toLowerCase(), system_url: window.location.origin + '/admin/login' },
      });
      if (error) {
        setForgotMsg({ kind: 'error', text: error.message ?? 'Erro ao solicitar nova senha.' });
        return;
      }
      const payload = (data ?? {}) as { status?: string; message?: string };
      switch (payload.status) {
        case 'sent':
          setForgotSent(true);
          break;
        case 'no_whatsapp':
          setForgotMsg({ kind: 'info', text: 'Não conseguimos confirmar seu cadastro ou o telefone não responde no WhatsApp. Contate a secretaria.' });
          break;
        case 'rate_limited':
          setForgotMsg({ kind: 'error', text: payload.message ?? 'Muitas tentativas. Aguarde alguns minutos.' });
          break;
        case 'invalid_input':
          setForgotMsg({ kind: 'error', text: payload.message ?? 'Dados inválidos.' });
          break;
        default:
          setForgotMsg({ kind: 'error', text: payload.message ?? 'Erro ao solicitar nova senha.' });
      }
    } catch (err) {
      setForgotMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Erro inesperado.' });
    } finally {
      setForgotLoading(false);
    }
  };

  const goLogin = () => {
    setMode('login');
    setForgotMsg(null);
    setForgotSent(false);
  };

  const busy = authLoading || submitting;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary via-brand-primary-dark to-[#001a3d] px-4">
      {/* Grain overlay */}
      <div className="grain-overlay fixed inset-0 pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo dentro do card */}
          <div className="flex items-center justify-center mb-6">
            {identity.logo_url ? (
              <img
                src={identity.logo_url}
                alt={identity.school_name || 'Logo'}
                className="h-32 w-auto object-contain"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-brand-primary" />
              </div>
            )}
          </div>

          {mode === 'login' && authError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{authError}</p>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* E-mail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full pl-11 pr-12 py-3 rounded-xl border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={busy || !email || !password}
                className="w-full py-3.5 bg-brand-secondary text-brand-primary font-semibold rounded-xl transition-all duration-300 hover:brightness-110 hover:shadow-lg shadow-brand-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 animate-pulse-soft"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Entrando…
                  </>
                ) : (
                  'Entrar'
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode('forgot'); setForgotMsg(null); setForgotSent(false); }}
                className="w-full text-xs text-brand-primary hover:underline mt-2"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : forgotSent ? (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800">
                Verifique seu WhatsApp
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Se o e-mail estiver cadastrado e o telefone tiver WhatsApp, enviamos
                uma senha provisória. Use-a para entrar — você poderá trocá-la
                em seguida.
              </p>
              <button
                onClick={goLogin}
                className="w-full py-3 bg-brand-primary hover:brightness-110 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar ao login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-5">
              <p className="text-xs text-gray-500 bg-blue-50 px-3 py-2.5 rounded-lg leading-relaxed">
                Informe seu e-mail cadastrado. Enviaremos uma senha provisória
                pelo WhatsApp do telefone cadastrado — você poderá trocá-la no
                primeiro acesso.
              </p>

              {forgotMsg && (
                <div className={`flex items-start gap-3 border rounded-xl p-4 ${forgotMsg.kind === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${forgotMsg.kind === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
                  <p className={`text-sm ${forgotMsg.kind === 'error' ? 'text-red-700' : 'text-amber-700'}`}>{forgotMsg.text}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading || !email.trim()}
                className="w-full py-3.5 bg-brand-primary text-white font-semibold rounded-xl transition-all duration-300 hover:brightness-110 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {forgotLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                {forgotLoading ? 'Enviando…' : 'Receber nova senha por WhatsApp'}
              </button>

              <button
                type="button"
                onClick={goLogin}
                className="w-full text-xs text-gray-500 hover:underline"
              >
                Voltar ao login
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} {identity.school_name || ''}
        </p>
      </div>
    </div>
  );
}

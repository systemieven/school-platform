import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useProfessor } from '../../contexts/ProfessorAuthContext';
import { Loader2, Eye, EyeOff, GraduationCap, MessageCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useBranding } from '../../../contexts/BrandingContext';

type Mode = 'login' | 'forgot';

export default function ProfessorLoginPage() {
  const { signIn, requestAccess, session } = useProfessor();
  const { identity } = useBranding();
  const navigate = useNavigate();

  const [mode, setMode]         = useState<Mode>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [sent, setSent]         = useState(false);
  const [noWhats, setNoWhats]   = useState(false);

  if (session) return <Navigate to="/professor" replace />;

  function resetMessages() {
    setError(''); setSent(false); setNoWhats(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Preencha todos os campos.'); return; }
    setLoading(true); resetMessages();
    const res = await signIn(email.trim(), password);
    if (res.error) { setError(res.error); setLoading(false); return; }
    navigate('/professor');
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Informe seu e-mail.'); return; }
    setLoading(true); resetMessages();
    const res = await requestAccess(email.trim());
    setLoading(false);

    if (res.status === 'sent') { setSent(true); return; }
    if (res.status === 'no_whatsapp') { setNoWhats(true); return; }
    if (res.status === 'rate_limited') {
      setError(res.message ?? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      return;
    }
    if (res.status === 'invalid_input') {
      setError(res.message ?? 'E-mail inválido.');
      return;
    }
    setError(res.message ?? 'Erro ao solicitar nova senha. Tente novamente.');
  }

  const inp = `w-full px-4 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-600
    bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
    focus:border-brand-primary dark:focus:border-brand-secondary outline-none transition-colors`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary to-[#002255] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <GraduationCap className="w-8 h-8 text-brand-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">{identity.school_short_name || ''}</h1>
          <p className="text-white/60 text-sm mt-1">Portal do Professor</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-5">
            {mode === 'login' ? 'Entrar' : 'Recuperar senha'}
          </h2>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-4">
              {error}
            </p>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className={inp}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className={`${inp} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <button
                type="button"
                onClick={() => { setMode('forgot'); resetMessages(); }}
                className="w-full text-xs text-brand-primary hover:underline mt-2"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : sent ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <MessageCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Verifique seu WhatsApp
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Enviamos uma senha provisória para o telefone cadastrado. Use seu e-mail
                e essa senha para entrar — você poderá trocá-la em seguida.
              </p>
              <button
                onClick={() => { setMode('login'); resetMessages(); }}
                className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Ir para o login
              </button>
            </div>
          ) : noWhats ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Não conseguimos enviar pelo WhatsApp
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                O telefone cadastrado não está ativo no WhatsApp. Procure a coordenação
                da escola para atualizar seu cadastro.
              </p>
              <button
                onClick={() => { setNoWhats(false); }}
                className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Tentar com outro e-mail
              </button>
              <button
                onClick={() => { setMode('login'); resetMessages(); }}
                className="w-full text-xs text-gray-500 hover:underline"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg leading-relaxed">
                Informe o e-mail cadastrado pela escola. Enviaremos uma senha provisória
                pelo WhatsApp do telefone cadastrado no seu perfil.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className={inp}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                {loading ? 'Enviando...' : 'Enviar senha por WhatsApp'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); resetMessages(); }}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:underline mt-2"
              >
                <ArrowLeft className="w-3 h-3" />
                Voltar para o login
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          {identity.school_name || ''} · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

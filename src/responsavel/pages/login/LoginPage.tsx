import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useGuardian, normalizeCpf } from '../../contexts/GuardianAuthContext';
import { Loader2, Eye, EyeOff, UserCheck, MessageCircle, AlertCircle } from 'lucide-react';
import { useBranding } from '../../../contexts/BrandingContext';

type Mode = 'login' | 'first-access';

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function GuardianLoginPage() {
  const { signIn, requestAccess, session } = useGuardian();
  const { identity } = useBranding();
  const navigate = useNavigate();

  const [mode, setMode]         = useState<Mode>('login');
  const [cpf, setCpf]           = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone]       = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [sent, setSent]         = useState(false);
  const [noWhats, setNoWhats]   = useState(false);

  if (session) return <Navigate to="/responsavel" replace />;

  function resetMessages() {
    setError(''); setSent(false); setNoWhats(false);
  }

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCpf(formatCpf(e.target.value));
  }
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhone(formatPhone(e.target.value));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!cpf.trim() || !password) { setError('Preencha todos os campos.'); return; }
    if (normalizeCpf(cpf).length !== 11) { setError('CPF inválido.'); return; }
    setLoading(true); resetMessages();
    const res = await signIn(cpf, password);
    if (res.error) { setError(res.error); setLoading(false); return; }
    navigate('/responsavel');
  }

  async function handleRequestAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!cpf.trim() || !phone.trim()) { setError('Preencha CPF e telefone.'); return; }
    if (normalizeCpf(cpf).length !== 11) { setError('CPF inválido.'); return; }
    if (phone.replace(/\D/g, '').length < 10) { setError('Telefone inválido.'); return; }

    setLoading(true); resetMessages();
    const res = await requestAccess(cpf, phone);
    setLoading(false);

    if (res.status === 'sent') {
      setSent(true);
      return;
    }
    if (res.status === 'no_whatsapp') {
      setNoWhats(true);
      return;
    }
    if (res.status === 'rate_limited') {
      setError(res.message ?? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      return;
    }
    if (res.status === 'invalid_input') {
      setError(res.message ?? 'Dados inválidos.');
      return;
    }
    setError(res.message ?? 'Erro ao solicitar acesso. Tente novamente.');
  }

  const inp = `w-full px-4 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none transition-colors`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary to-[#002255] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UserCheck className="w-8 h-8 text-brand-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">{identity.school_short_name || ''}</h1>
          <p className="text-white/60 text-sm mt-1">Portal do Responsável</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
          {/* Mode tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            <button onClick={() => { setMode('login'); resetMessages(); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'login' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              Entrar
            </button>
            <button onClick={() => { setMode('first-access'); resetMessages(); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'first-access' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              Primeiro acesso
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-4">
              {error}
            </p>
          )}
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">CPF</label>
                <input
                  value={cpf}
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  autoComplete="username"
                  inputMode="numeric"
                  className={inp}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Senha</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password" className={`${inp} pr-10`} />
                  <button type="button" onClick={() => setShowPwd((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('first-access'); resetMessages(); }}
                className="w-full text-xs text-brand-primary hover:underline mt-2"
              >
                Esqueci minha senha / primeiro acesso
              </button>
            </form>
          ) : sent ? (
            // Estado de sucesso — senha enviada por WhatsApp
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <MessageCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Verifique seu WhatsApp
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Enviamos uma senha provisória para o telefone cadastrado. Use seu CPF
                e essa senha para entrar — você poderá trocá-la em seguida.
              </p>
              <button
                onClick={() => { setMode('login'); resetMessages(); setPhone(''); }}
                className="w-full py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Ir para o login
              </button>
            </div>
          ) : noWhats ? (
            // Estado: número não tem WhatsApp ou CPF/telefone não conferem
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Não conseguimos confirmar seus dados
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                O telefone informado não responde no WhatsApp ou não está cadastrado
                em nossa base. Procure a secretaria para atualizar seu cadastro.
              </p>
              <Link
                to="/agendar-visita"
                className="block w-full py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Falar com a secretaria
              </Link>
              <button
                onClick={() => { setNoWhats(false); }}
                className="w-full text-xs text-gray-500 hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <form onSubmit={handleRequestAccess} className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg leading-relaxed">
                Informe o CPF e o telefone cadastrados pela escola. Enviaremos uma
                senha provisória pelo WhatsApp — você poderá trocá-la no primeiro acesso.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">CPF</label>
                <input
                  value={cpf}
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className={inp}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Telefone (WhatsApp)</label>
                <input
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                  className={inp}
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                {loading ? 'Enviando...' : 'Enviar senha por WhatsApp'}
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

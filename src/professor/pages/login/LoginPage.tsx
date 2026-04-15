import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useProfessor } from '../../contexts/ProfessorAuthContext';
import { Loader2, Eye, EyeOff, GraduationCap } from 'lucide-react';
import { useBranding } from '../../../contexts/BrandingContext';

export default function ProfessorLoginPage() {
  const { signIn, session } = useProfessor();
  const { identity } = useBranding();
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  if (session) return <Navigate to="/professor" replace />;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Preencha todos os campos.'); return; }
    setLoading(true);
    setError('');
    const res = await signIn(email.trim(), password);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    navigate('/professor');
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
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-5">Entrar</h2>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-4">
              {error}
            </p>
          )}

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
          </form>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          {identity.school_name || ''} · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

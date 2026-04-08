import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { Loader2, Eye, EyeOff, BookOpen } from 'lucide-react';

type Mode = 'login' | 'first-access';

export default function PortalLoginPage() {
  const { signIn, firstAccess, session } = useStudentAuth();
  const navigate = useNavigate();

  const [mode, setMode]           = useState<Mode>('login');
  const [enrollment, setEnrollment] = useState('');
  const [password, setPassword]   = useState('');
  const [cpf, setCpf]             = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  if (session) return <Navigate to="/portal" replace />;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment.trim() || !password) { setError('Preencha todos os campos.'); return; }
    setLoading(true); setError('');
    const res = await signIn(enrollment, password);
    if (res.error) { setError(res.error); setLoading(false); return; }
    navigate('/portal');
  }

  async function handleFirstAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment.trim() || !cpf || !newPassword || !confirmPwd) {
      setError('Preencha todos os campos.'); return;
    }
    if (newPassword.length < 6) { setError('A senha deve ter ao menos 6 caracteres.'); return; }
    if (newPassword !== confirmPwd) { setError('As senhas não conferem.'); return; }
    setLoading(true); setError('');
    const res = await firstAccess(enrollment, cpf, newPassword);
    if (res.error) { setError(res.error); setLoading(false); return; }
    setSuccess('Acesso ativado com sucesso! Você já pode entrar com sua matrícula e nova senha.');
    setMode('login');
    setLoading(false);
  }

  const inp = `w-full px-4 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] outline-none transition-colors`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003876] to-[#002255] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#ffd700] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <BookOpen className="w-8 h-8 text-[#003876]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Colégio Batista</h1>
          <p className="text-white/60 text-sm mt-1">Portal do Aluno</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
          {/* Mode tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'login' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              Entrar
            </button>
            <button onClick={() => { setMode('first-access'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'first-access' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              Primeiro acesso
            </button>
          </div>

          {error   && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-4">{error}</p>}
          {success && <p className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg mb-4">{success}</p>}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Número de matrícula</label>
                <input value={enrollment} onChange={(e) => setEnrollment(e.target.value)}
                  placeholder="Ex: 2024-0001" autoComplete="username" className={inp} />
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
                className="w-full py-3 bg-[#003876] hover:bg-[#002855] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleFirstAccess} className="space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                Informe sua matrícula e o CPF do responsável para ativar seu acesso.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Número de matrícula</label>
                <input value={enrollment} onChange={(e) => setEnrollment(e.target.value)}
                  placeholder="Ex: 2024-0001" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">CPF do responsável</label>
                <input value={cpf} onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00" className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Nova senha</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres" className={`${inp} pr-10`} />
                  <button type="button" onClick={() => setShowPwd((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Confirmar senha</label>
                <input type={showPwd ? 'text' : 'password'} value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Repita a senha" className={inp} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-[#003876] hover:bg-[#002855] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Ativando...' : 'Ativar acesso'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          Colégio Batista em Caruaru · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

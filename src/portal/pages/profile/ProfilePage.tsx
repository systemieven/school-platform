import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { User, Lock, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function ProfilePage() {
  const { student } = useStudentAuth();
  const [newPwd,    setNewPwd]    = useState('');
  const [confirmPwd,setConfirmPwd]= useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');

  async function changePwd(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) { setError('A senha deve ter ao menos 6 caracteres.'); return; }
    if (newPwd !== confirmPwd) { setError('As senhas não conferem.'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.auth.updateUser({ password: newPwd });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaved(true); setSaving(false);
    setNewPwd(''); setConfirmPwd('');
    setTimeout(() => setSaved(false), 3000);
  }

  const inp = `w-full px-4 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none`;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <User className="w-5 h-5 text-brand-primary dark:text-brand-secondary" /> Perfil
      </h1>

      {/* Personal data */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Dados pessoais</h2>
        {student && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Nome',            student.full_name],
              ['Matrícula',       student.enrollment_number],
              ['Responsável',     student.guardian_name],
              ['Telefone resp.',  student.guardian_phone],
              ['Data de nascimento', student.birth_date
                ? new Date(student.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')
                : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{value}</p>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">Para atualizar dados pessoais, entre em contato com a secretaria.</p>
      </div>

      {/* Change password */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Alterar senha
        </h2>
        {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mb-4">{error}</p>}
        <form onSubmit={changePwd} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nova senha</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)} placeholder="Mínimo 6 caracteres"
                className={`${inp} pr-10`} />
              <button type="button" onClick={() => setShowPwd((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Confirmar nova senha</label>
            <input type={showPwd ? 'text' : 'password'} value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repita a senha" className={inp} />
          </div>
          <button type="submit" disabled={saving || saved}
            className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-colors ${
              saved
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-60'
            }`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {saving ? 'Salvando...' : saved ? 'Senha alterada!' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import { Loader2, User, Save, Check, Eye, EyeOff, KeyRound } from 'lucide-react';

type SaveState = 'idle' | 'saving' | 'saved';

export default function PerfilPage() {
  const { guardian, session } = useGuardian();

  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [infoState, setInfoState] = useState<SaveState>('idle');
  const [infoError, setInfoError] = useState('');

  const [currentPwd, setCurrentPwd]   = useState('');
  const [newPwd, setNewPwd]           = useState('');
  const [confirmPwd, setConfirmPwd]   = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [pwdState, setPwdState]       = useState<SaveState>('idle');
  const [pwdError, setPwdError]       = useState('');

  useEffect(() => {
    if (guardian) {
      setName(guardian.name ?? '');
      setPhone(guardian.phone ?? '');
      setEmail(guardian.email ?? '');
    }
  }, [guardian]);

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setInfoError('O nome é obrigatório.'); return; }
    setInfoState('saving'); setInfoError('');

    const { error } = await supabase
      .from('guardian_profiles')
      .update({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null })
      .eq('id', session?.user.id ?? '');

    if (error) { setInfoError('Erro ao salvar. Tente novamente.'); setInfoState('idle'); return; }

    setInfoState('saved');
    setTimeout(() => setInfoState('idle'), 900);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPwd || !newPwd || !confirmPwd) { setPwdError('Preencha todos os campos.'); return; }
    if (newPwd.length < 6) { setPwdError('A nova senha deve ter ao menos 6 caracteres.'); return; }
    if (newPwd !== confirmPwd) { setPwdError('As senhas não conferem.'); return; }
    setPwdState('saving'); setPwdError('');

    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) { setPwdError(error.message); setPwdState('idle'); return; }

    setPwdState('saved');
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    setTimeout(() => setPwdState('idle'), 900);
  }

  const inp = `w-full px-4 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none transition-colors`;

  if (!guardian) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <User className="w-5 h-5" /> Perfil
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gerencie seus dados de contato e senha.
        </p>
      </div>

      {/* Personal info */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
          Dados pessoais
        </h2>
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Nome completo</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="Seu nome completo" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">CPF</label>
            <input value={guardian.cpf ?? ''} disabled className={`${inp} opacity-60 cursor-not-allowed`} />
            <p className="text-xs text-gray-400 mt-1">O CPF não pode ser alterado.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Telefone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">E-mail de contato</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inp} placeholder="seu@email.com" />
          </div>

          {infoError && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{infoError}</p>}

          <button
            type="submit"
            disabled={infoState !== 'idle'}
            className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 ${
              infoState === 'saved'
                ? 'bg-emerald-500 text-white'
                : 'bg-brand-primary hover:bg-brand-primary-dark text-white'
            }`}
          >
            {infoState === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
            {infoState === 'saved'  && <Check className="w-4 h-4" />}
            {infoState === 'idle'   && <Save className="w-4 h-4" />}
            {infoState === 'saving' ? 'Salvando...' : infoState === 'saved' ? 'Salvo!' : 'Salvar dados'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
          Alterar senha
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Senha atual</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                className={`${inp} pr-10`}
                placeholder="Senha atual"
              />
              <button type="button" onClick={() => setShowPwd((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Nova senha</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className={inp}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Confirmar nova senha</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              className={inp}
              placeholder="Repita a nova senha"
            />
          </div>

          {pwdError && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{pwdError}</p>}

          <button
            type="submit"
            disabled={pwdState !== 'idle'}
            className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 ${
              pwdState === 'saved'
                ? 'bg-emerald-500 text-white'
                : 'bg-brand-primary hover:bg-brand-primary-dark text-white'
            }`}
          >
            {pwdState === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
            {pwdState === 'saved'  && <Check className="w-4 h-4" />}
            {pwdState === 'idle'   && <KeyRound className="w-4 h-4" />}
            {pwdState === 'saving' ? 'Salvando...' : pwdState === 'saved' ? 'Salvo!' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

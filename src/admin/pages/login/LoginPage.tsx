import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { Lock, Mail, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useBranding } from '../../../contexts/BrandingContext';

export default function LoginPage() {
  const { profile, loading: authLoading, error: authError, signIn } = useAdminAuth();
  const { identity } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in — redirect to dashboard
  if (profile) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    await signIn(email, password);
    setSubmitting(false);
  };

  const busy = authLoading || submitting;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary via-brand-primary-dark to-[#001a3d] px-4">
      {/* Grain overlay */}
      <div className="grain-overlay fixed inset-0 pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-secondary rounded-2xl mb-4 shadow-lg shadow-brand-secondary/20">
            <Lock className="w-8 h-8 text-brand-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-white/60 mt-2 text-sm">{identity.school_name}</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-brand-primary mb-6 text-center">Entrar</h2>

          {authError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{authError}</p>
            </div>
          )}

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
              className="w-full py-3.5 bg-brand-primary text-white font-semibold rounded-xl transition-all duration-300 hover:bg-brand-primary-dark hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          </form>
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          © {new Date().getFullYear()} {identity.school_name || ''}
        </p>
      </div>
    </div>
  );
}

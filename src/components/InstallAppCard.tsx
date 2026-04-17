import { Download, Check, Share } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useBranding } from '../contexts/BrandingContext';

export default function InstallAppCard() {
  const { canInstall, installed, platform, promptInstall, hasDeferredPrompt } = useInstallPrompt();
  const { identity } = useBranding();

  if (installed) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">App instalado</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Você está usando o {identity.school_short_name || 'app'} como aplicativo.
          </p>
        </div>
      </div>
    );
  }

  if (!canInstall) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
        <Download className="w-4 h-4" /> Instalar aplicativo
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Adicione o {identity.school_short_name || identity.school_name} à tela inicial para abrir em tela cheia,
        receber notificações e acessar mais rápido.
      </p>

      {hasDeferredPrompt ? (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white transition-colors"
        >
          <Download className="w-4 h-4" />
          Instalar agora
        </button>
      ) : platform === 'ios' ? (
        <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 rounded-lg px-3 py-2 leading-relaxed flex items-start gap-2">
          <Share className="w-4 h-4 shrink-0 mt-0.5 text-brand-primary dark:text-brand-secondary" />
          <span>
            No Safari, toque em <strong>Compartilhar</strong> e selecione
            <strong> Adicionar à Tela de Início</strong>.
          </span>
        </div>
      ) : null}
    </div>
  );
}

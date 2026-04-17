import { Bell, BellOff, Loader2, AlertCircle } from 'lucide-react';
import { usePushSubscription } from '../hooks/usePushSubscription';

interface Props {
  userType: 'admin' | 'guardian' | 'student';
}

export default function PushNotificationsCard({ userType }: Props) {
  const { supported, permission, subscribed, loading, error, subscribe, unsubscribe } =
    usePushSubscription(userType);

  if (!supported) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Notificações push
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Este navegador não suporta notificações push. Instale o app e tente novamente.
        </p>
      </div>
    );
  }

  const blocked = permission === 'denied';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
        <Bell className="w-4 h-4" /> Notificações push
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Receba alertas no seu dispositivo sobre comunicados, avisos e lembretes importantes.
      </p>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {blocked ? (
        <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          Permissão bloqueada. Habilite notificações nas configurações do navegador e recarregue a página.
        </div>
      ) : subscribed ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void unsubscribe()}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
          Desativar notificações
        </button>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => void subscribe()}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl bg-brand-primary hover:bg-brand-primary-dark text-white transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          Ativar notificações
        </button>
      )}
    </div>
  );
}

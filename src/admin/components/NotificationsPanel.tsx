import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CalendarCheck, GraduationCap, MessageSquare,
  RefreshCw, CheckCheck, X, Inbox, WifiOff, Settings, Volume2, VolumeX,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminAuth } from '../hooks/useAdminAuth';
import type { Notification, NotificationType } from '../types/admin.types';

// ── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<NotificationType, { icon: React.ComponentType<{ className?: string }>; bg: string; text: string }> = {
  new_appointment:  { icon: CalendarCheck, bg: 'bg-blue-100 dark:bg-blue-900/40',    text: 'text-blue-600 dark:text-blue-400' },
  new_enrollment:   { icon: GraduationCap, bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400' },
  new_contact:      { icon: MessageSquare, bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-600 dark:text-purple-400' },
  status_change:    { icon: RefreshCw,     bg: 'bg-amber-100 dark:bg-amber-900/40',   text: 'text-amber-600 dark:text-amber-400' },
  wa_disconnected:  { icon: WifiOff,       bg: 'bg-red-100 dark:bg-red-900/40',       text: 'text-red-600 dark:text-red-400' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

interface Props {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

const NOTIF_TYPE_LABELS: Record<string, string> = {
  new_appointment: 'Novos agendamentos',
  new_enrollment: 'Novas matrículas',
  new_contact: 'Novos contatos',
  status_change: 'Mudanças de status',
  wa_disconnected: 'WhatsApp desconectado',
};

const ALL_TYPES = Object.keys(NOTIF_TYPE_LABELS);

export default function NotificationsPanel({ notifications, onClose, onMarkRead, onMarkAllRead }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { profile } = useAdminAuth();
  const unread = notifications.filter((n) => !n.is_read).length;
  const [showPrefs, setShowPrefs] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<string[]>(ALL_TYPES);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load preferences
  const loadPrefs = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notification_preferences')
      .select('enabled_types, sound_enabled')
      .eq('user_id', profile.id)
      .single();
    if (data) {
      setEnabledTypes(data.enabled_types || ALL_TYPES);
      setSoundEnabled(data.sound_enabled ?? true);
    }
    setPrefsLoaded(true);
  }, [profile]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  async function savePrefs(types: string[], sound: boolean) {
    if (!profile) return;
    await supabase.from('notification_preferences').upsert({
      user_id: profile.id,
      enabled_types: types,
      sound_enabled: sound,
      updated_at: new Date().toISOString(),
    });
  }

  function toggleType(type: string) {
    const next = enabledTypes.includes(type)
      ? enabledTypes.filter((t) => t !== type)
      : [...enabledTypes, type];
    setEnabledTypes(next);
    savePrefs(next, soundEnabled);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    savePrefs(enabledTypes, next);
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  function handleNotifClick(n: Notification) {
    if (!n.is_read) onMarkRead(n.id);
    if (n.link) navigate(n.link);
    onClose();
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 flex flex-col"
      style={{ maxHeight: 'calc(100vh - 80px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#003876] dark:text-[#ffd700]" />
          <span className="font-semibold text-gray-900 dark:text-white text-sm">Notificações</span>
          {unread > 0 && (
            <span className="bg-[#003876] dark:bg-[#ffd700] text-white dark:text-[#003876] text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Marcar todas como lidas"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lidas</span>
            </button>
          )}
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            className={`p-1 rounded-lg transition-colors ${showPrefs ? 'text-[#003876] dark:text-[#ffd700] bg-gray-100 dark:bg-gray-700' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title="Preferências de notificação"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preferences */}
      {showPrefs && prefsLoaded && (
        <div className="border-b border-gray-100 dark:border-gray-700 px-4 py-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Preferências</p>
            <button onClick={toggleSound} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              {soundEnabled ? 'Som ligado' : 'Som desligado'}
            </button>
          </div>
          <div className="space-y-1">
            {ALL_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 py-1 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={enabledTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  className="rounded border-gray-300 dark:border-gray-600 text-[#003876] focus:ring-[#003876]/20"
                />
                <span className="text-xs text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                  {NOTIF_TYPE_LABELS[type] || type}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Inbox className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400 dark:text-gray-500">Nenhuma notificação ainda</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.status_change;
              const Icon = cfg.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`w-full text-left flex gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${
                    !n.is_read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.text}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${n.is_read ? 'text-gray-600 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-white'}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!n.is_read && (
                    <div className="w-2 h-2 bg-[#003876] dark:bg-[#ffd700] rounded-full flex-shrink-0 mt-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

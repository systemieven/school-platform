/**
 * AttendanceSettingsPanel
 *
 * Painel da aba "Atendimentos" em /admin/configuracoes.
 * Gerencia 6 cards de configuração da categoria `attendance` em
 * `system_settings`, mais um atalho para sincronizar o som de prévia.
 *
 * Padrão: self-contained (igual ao AppointmentsSettingsPanel) — carrega
 * os próprios registros, mantém estado local e salva via upsert.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { SettingsCard } from '../../components/SettingsCard';
import {
  Shield,
  Hash,
  Volume2,
  Monitor,
  Star,
  Save,
  Loader2,
  Check,
  Plus,
  Trash2,
  // Eligibility icons
  CalendarCheck,
  CalendarPlus,
  History,
  Infinity as InfinityIcon,
  UserPlus,
  // Sound icons
  Bell,
  BellRing,
  Music2,
  Megaphone,
  // Client screen icons
  LayoutGrid,
  Clock,
  MessageSquare,
  // Feedback icons
  ThumbsUp,
  MessageCircle,
  ListChecks,
  Type,
  // Question type icons
  CircleDot,
  CheckSquare,
  SlidersHorizontal,
  ToggleLeft,
  Smile,
  X as XIcon,
  // Ticket format icons (prefix mode)
  Minus,
  Edit3,
  Folder,
  // Display panel icons
  Tv,
  Eye,
  EyeOff,
  Copy,
  Link,
  
  // Sector icon map
  Building2,
  Users,
  User,
  FileText,
  BookOpen,
  BookMarked,
  GraduationCap,
  Calendar,
  ClipboardList,
  PenLine,
  Briefcase,
  Heart,
  Phone,
  Mail,
  Home,
  HelpCircle,
  Award,
  UserCheck,
  Handshake,
  Baby,
  Bus,
} from 'lucide-react';
import type {
  AttendanceEligibilityRules,
  AttendanceTicketFormat,
  AttendanceSoundConfig,
  AttendanceClientScreenFields,
  AttendanceFeedbackConfig,
  AttendanceQuestion,
  AttendanceQuestionType,
  DisplayPanelConfig,
} from '../../types/admin.types';

interface AllowWalkins {
  enabled: boolean;
}

interface Sector {
  key: string;
  label: string;
  icon?: string;
}

interface AttendanceState {
  eligibility_rules: AttendanceEligibilityRules;
  allow_walkins: AllowWalkins;
  ticket_format: AttendanceTicketFormat;
  sound: AttendanceSoundConfig;
  client_screen_fields: AttendanceClientScreenFields;
  feedback: AttendanceFeedbackConfig;
  display_panel: DisplayPanelConfig;
}

const DEFAULTS: AttendanceState = {
  eligibility_rules: {
    same_day: true,
    future: false,
    past_limited: false,
    any: false,
    past_days_limit: 7,
  },
  allow_walkins: { enabled: false },
  ticket_format: { prefix_mode: 'none', custom_prefix: 'A', digits: 3, per_sector_counter: false },
  sound: { enabled: true, preset: 'bell' },
  client_screen_fields: {
    show_last_called: true,
    show_sector: true,
    show_wait_estimate: true,
    show_instructions: true,
    instructions_text: 'Aguarde o chamado na tela.',
  },
  feedback: {
    enabled: true,
    prompt_text: 'Como foi seu atendimento?',
    scale: 'stars',
    max: 5,
    allow_comments: true,
    custom_questions_enabled: false,
    questions: [],
  },
  display_panel: {
    password: '',
    show_visitor_name: true,
    sound_preset: 'bell',
    sound_repeat: 2,
    history_count: 5,
    sector_filter: [],
    theme: 'dark-blue',
  },
};

// NOTE: `estimated_service_time` foi removido — o tempo de atendimento é
// configurado por motivo de visita (Agendamentos > Motivos de Visita,
// campo "Duração da visita") e o edge function `attendance-public-config`
// calcula dinamicamente a estimativa por setor cruzando essa duração com
// a média real dos atendimentos finalizados do dia.
const ATTENDANCE_KEYS: (keyof AttendanceState)[] = [
  'eligibility_rules',
  'allow_walkins',
  'ticket_format',
  'sound',
  'client_screen_fields',
  'feedback',
  'display_panel',
];

const SECTOR_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2, Users, User, FileText, BookOpen, BookMarked, GraduationCap,
  MessageCircle, MessageSquare, Calendar, ClipboardList, PenLine, Briefcase,
  Heart, Star, Phone, Mail, Home, HelpCircle, Award, UserCheck, Handshake, Baby, Bus,
};

const THEME_PRESETS: Array<{
  key: DisplayPanelConfig['theme'];
  label: string;
  bg: string;
  card: string;
  accent: string;
  highlight: string;
  text: string;
  muted: string;
}> = [
  { key: 'dark-blue',  label: 'Azul escuro',    bg: '#0a1628', card: '#111d33', accent: '#003876', highlight: '#ffd700', text: '#ffffff', muted: '#94a3b8' },
  { key: 'dark-green', label: 'Verde escuro',   bg: '#0a1a0a', card: '#112211', accent: '#166534', highlight: '#86efac', text: '#ffffff', muted: '#94a3b8' },
  { key: 'dark-gold',  label: 'Dourado escuro', bg: '#1a1400', card: '#221c05', accent: '#92700c', highlight: '#ffd700', text: '#ffffff', muted: '#b0a47a' },
  { key: 'light',      label: 'Claro',          bg: '#f8fafc', card: '#ffffff', accent: '#003876', highlight: '#ffd700', text: '#1e293b', muted: '#64748b' },
];

const SOUND_PRESETS: Array<{
  key: AttendanceSoundConfig['preset'];
  label: string;
  file: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'bell',   label: 'Sino',      file: '/sounds/attendance-bell.mp3',   icon: Bell      },
  { key: 'chime',  label: 'Chime',     file: '/sounds/attendance-chime.mp3',  icon: BellRing  },
  { key: 'ding',   label: 'Ding',      file: '/sounds/attendance-ding.mp3',   icon: Music2    },
  { key: 'buzzer', label: 'Campainha', file: '/sounds/attendance-buzzer.mp3', icon: Megaphone },
];

/**
 * Converte valores legados de eligibility_rules (que tinham o campo
 * unico `mode`) para a nova estrutura de flags multi-select. Tambem
 * garante que valores parcialmente salvos nao explodam o componente.
 */
function normalizeEligibilityRules(raw: unknown): AttendanceEligibilityRules {
  const r = (raw as Record<string, unknown>) || {};
  const legacyMode = typeof r.mode === 'string' ? (r.mode as string) : null;
  const past_days_limit = typeof r.past_days_limit === 'number' && r.past_days_limit > 0
    ? r.past_days_limit
    : 7;
  if (legacyMode) {
    return {
      same_day:     legacyMode === 'same_day',
      future:       legacyMode === 'future',
      past_limited: legacyMode === 'past_limited',
      any:          legacyMode === 'any',
      past_days_limit,
    };
  }
  return {
    same_day:     !!r.same_day,
    future:       !!r.future,
    past_limited: !!r.past_limited,
    any:          !!r.any,
    past_days_limit,
  };
}

export default function AttendanceSettingsPanel() {
  const [data, setData] = useState<AttendanceState>(DEFAULTS);
  const [original, setOriginal] = useState<string>(JSON.stringify(DEFAULTS));
  const [ids, setIds] = useState<Record<string, string>>({});
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPanelPassword, setShowPanelPassword] = useState(false);
  const [panelLinkCopied, setPanelLinkCopied] = useState(false);

  // Load attendance settings + sectors from visit_settings.reasons
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [settingsRes, reasonsRes] = await Promise.all([
        supabase
          .from('system_settings')
          .select('id, key, value')
          .eq('category', 'attendance')
          .in('key', ATTENDANCE_KEYS as string[]),
        supabase
          .from('system_settings')
          .select('value')
          .eq('category', 'visit')
          .eq('key', 'reasons')
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const merged: AttendanceState = { ...DEFAULTS };
      const newIds: Record<string, string> = {};
      (settingsRes.data || []).forEach((row) => {
        const r = row as { id: string; key: string; value: unknown };
        newIds[r.key] = r.id;
        try {
          const parsed = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
          if (r.key === 'eligibility_rules') {
            // Normaliza valores legados (campo `mode` → flags multi-select)
            merged.eligibility_rules = normalizeEligibilityRules(parsed);
          } else {
            (merged as unknown as Record<string, unknown>)[r.key] = {
              ...((DEFAULTS as unknown as Record<string, unknown>)[r.key] as object),
              ...(parsed as object),
            };
          }
        } catch {
          /* keep default */
        }
      });

      // Parse sectors from visit_settings.reasons
      let parsedSectors: Sector[] = [];
      if (reasonsRes.data?.value) {
        try {
          const raw = typeof reasonsRes.data.value === 'string'
            ? JSON.parse(reasonsRes.data.value)
            : reasonsRes.data.value;
          if (Array.isArray(raw)) {
            parsedSectors = (raw as Array<{ key: string; label: string; icon?: string }>)
              .filter((r) => r.key && r.label)
              .map((r) => ({ key: r.key, label: r.label, icon: r.icon }));
          }
        } catch {
          /* ignore */
        }
      }

      setSectors(parsedSectors);
      setData(merged);
      setIds(newIds);
      setOriginal(JSON.stringify(merged));
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const hasChanges = JSON.stringify(data) !== original;

  async function handleSave() {
    setSaving(true);
    const rows = ATTENDANCE_KEYS.map((key) => ({
      key,
      value: data[key],
    }));

    await Promise.all(
      rows.map(async (r) => {
        const existingId = ids[r.key];
        if (existingId) {
          await supabase.from('system_settings').update({ value: r.value }).eq('id', existingId);
        } else {
          const { data: row } = await supabase
            .from('system_settings')
            .insert({ category: 'attendance', key: r.key, value: r.value })
            .select('id')
            .single();
          if (row) setIds((prev) => ({ ...prev, [r.key]: row.id }));
        }
      }),
    );

    setOriginal(JSON.stringify(data));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function playSoundPreview(preset: AttendanceSoundConfig['preset']) {
    const match = SOUND_PRESETS.find((p) => p.key === preset);
    if (!match) return;
    try {
      const audio = new Audio(match.file);
      audio.play().catch(() => { /* ignore preview errors (autoplay block) */ });
    } catch {
      /* ignore */
    }
  }

  /**
   * Seleciona um preset e ja toca o audio em seguida — o admin nao
   * precisa clicar em "Ouvir" separadamente.
   */
  function selectSoundPreset(preset: AttendanceSoundConfig['preset']) {
    setData((prev) => ({ ...prev, sound: { ...prev.sound, preset } }));
    playSoundPreview(preset);
  }

  function ticketPreview(): string {
    const { prefix_mode, custom_prefix, digits } = data.ticket_format;
    const sample = '1'.padStart(Math.max(1, digits), '0');
    if (prefix_mode === 'none') return sample;
    if (prefix_mode === 'custom') return `${custom_prefix || 'A'}${sample}`;
    if (prefix_mode === 'sector') {
      const firstSector = sectors[0]?.key.slice(0, 1).toUpperCase() || 'S';
      return `${firstSector}${sample}`;
    }
    return sample;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#003876] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* 1. Regras de Elegibilidade */}
      <SettingsCard collapseId="attendance.eligibility" title="Regras de Elegibilidade" icon={Shield} description="Defina quando um visitante pode emitir senha. Marque mais de uma para combinar as regras; “Qualquer data” desabilita as demais.">
        {(() => {
          // Quando "any" está ativo, as outras ficam desabilitadas (cinza).
          const anyActive = data.eligibility_rules.any;
          type RuleKey = 'same_day' | 'future' | 'past_limited' | 'any';
          const rules: Array<{
            key: RuleKey;
            label: string;
            desc: string;
            icon: React.ComponentType<{ className?: string }>;
          }> = [
            { key: 'same_day',     label: 'No dia da visita',   desc: 'Agendamentos marcados para hoje.',           icon: CalendarCheck },
            { key: 'future',       label: 'Datas futuras',      desc: 'Agendamentos de amanhã em diante.',          icon: CalendarPlus  },
            { key: 'past_limited', label: 'Últimos N dias',     desc: 'Agendamentos anteriores dentro do limite.',  icon: History       },
            { key: 'any',          label: 'Qualquer data',      desc: 'Sem restrição — libera todas as regras.',    icon: InfinityIcon  },
          ];

          function toggleRule(key: RuleKey) {
            setData((prev) => ({
              ...prev,
              eligibility_rules: {
                ...prev.eligibility_rules,
                [key]: !prev.eligibility_rules[key],
              },
            }));
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {rules.map(({ key, label, desc, icon: Icon }) => {
                const active = data.eligibility_rules[key];
                const disabled = anyActive && key !== 'any';
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleRule(key)}
                    className={`
                      flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200
                      ${disabled
                        ? 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-60 cursor-not-allowed'
                        : active
                          ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                      }
                    `}
                  >
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${
                      disabled ? 'text-gray-400' : active ? 'text-[#ffd700]' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${
                        disabled
                          ? 'text-gray-400'
                          : active
                            ? 'text-white'
                            : 'text-gray-800 dark:text-gray-100'
                      }`}>{label}</p>
                      <p className={`text-[11px] mt-0.5 leading-tight ${
                        disabled
                          ? 'text-gray-400'
                          : active
                            ? 'text-white/70'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}>{desc}</p>
                    </div>
                  </button>
                );
              })}

              {/* Walk-in button (armazena em allow_walkins.enabled, nao na mesma chave) */}
              <button
                type="button"
                onClick={() =>
                  setData((prev) => ({
                    ...prev,
                    allow_walkins: { enabled: !prev.allow_walkins.enabled },
                  }))
                }
                className={`
                  flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 sm:col-span-2
                  ${data.allow_walkins.enabled
                    ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                  }
                `}
              >
                <UserPlus className={`w-4 h-4 shrink-0 mt-0.5 ${
                  data.allow_walkins.enabled ? 'text-[#ffd700]' : 'text-gray-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${
                    data.allow_walkins.enabled ? 'text-white' : 'text-gray-800 dark:text-gray-100'
                  }`}>Sem agendamento prévio (walk-in)</p>
                  <p className={`text-[11px] mt-0.5 leading-tight ${
                    data.allow_walkins.enabled ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    Permite gerar senha informando nome e setor direto na recepção; um agendamento sintético é criado para manter a timeline.
                  </p>
                </div>
              </button>
            </div>
          );
        })()}

        {/* Input de limite de dias — só quando past_limited está ativo e any não está */}
        {data.eligibility_rules.past_limited && !data.eligibility_rules.any && (
          <div className="pt-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Limite de dias anteriores
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={data.eligibility_rules.past_days_limit}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  eligibility_rules: {
                    ...prev.eligibility_rules,
                    past_days_limit: Math.max(1, parseInt(e.target.value) || 1),
                  },
                }))
              }
              className="w-32 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
            />
          </div>
        )}
      </SettingsCard>

      {/* 2. Formato de Senha */}
      <SettingsCard collapseId="attendance.ticketFormat" title="Formato de Senha" icon={Hash} description="Personalize o formato do número exibido na senha emitida.">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
          <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-gray-400">Prévia</span>
          <span className="font-display text-2xl font-bold text-[#003876] dark:text-white">{ticketPreview()}</span>
        </div>

        {/* Prefixo — botões com ícones, igual aos demais cards */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Prefixo</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {([
              { key: 'none',   label: 'Nenhum',        desc: 'Apenas os dígitos (ex: 001).',       icon: Minus      },
              { key: 'custom', label: 'Personalizado', desc: 'Letra(s) fixa(s) antes do número.',  icon: Edit3      },
              { key: 'sector', label: 'Por setor',     desc: 'Inicial do setor como prefixo.',     icon: Folder     },
            ] as const).map(({ key, label, desc, icon: Icon }) => {
              const active = data.ticket_format.prefix_mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setData((prev) => ({
                      ...prev,
                      ticket_format: { ...prev.ticket_format, prefix_mode: key as AttendanceTicketFormat['prefix_mode'] },
                    }))
                  }
                  className={`
                    flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200
                    ${active
                      ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${active ? 'text-[#ffd700]' : 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>{label}</p>
                    <p className={`text-[11px] mt-0.5 leading-tight ${active ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input do prefixo customizado — só aparece quando "Personalizado" está ativo */}
        {data.ticket_format.prefix_mode === 'custom' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Prefixo personalizado</label>
            <input
              type="text"
              maxLength={3}
              value={data.ticket_format.custom_prefix}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  ticket_format: { ...prev.ticket_format, custom_prefix: e.target.value.toUpperCase() },
                }))
              }
              placeholder="Ex: A"
              className="w-32 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
            />
          </div>
        )}

        {/* Dígitos — slider estilo business hours (thumb branco com anel azul) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Dígitos</label>
            <span className="font-display text-xl font-bold text-[#003876] dark:text-white tabular-nums">
              {data.ticket_format.digits}
            </span>
          </div>
          {(() => {
            const MIN = 1;
            const MAX = 6;
            const value = Math.max(MIN, Math.min(MAX, data.ticket_format.digits));
            const pct = ((value - MIN) / (MAX - MIN)) * 100;
            return (
              <div className="space-y-2">
                <div className="relative h-6 flex items-center">
                  <div className="absolute inset-x-0 h-2 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div
                    className="absolute h-2 rounded-full bg-gradient-to-r from-[#003876] to-blue-500 pointer-events-none"
                    style={{ width: `${pct}%` }}
                  />
                  <input
                    type="range"
                    min={MIN}
                    max={MAX}
                    step={1}
                    value={value}
                    onChange={(e) =>
                      setData((prev) => ({
                        ...prev,
                        ticket_format: {
                          ...prev.ticket_format,
                          digits: Math.max(MIN, Math.min(MAX, parseInt(e.target.value) || MIN)),
                        },
                      }))
                    }
                    className="absolute inset-x-0 w-full h-full appearance-none bg-transparent cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                      [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]
                      [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                      [&::-webkit-slider-thumb]:active:scale-110 [&::-webkit-slider-thumb]:transition-transform
                      [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]"
                  />
                </div>
                {/* Escala fixa de 1 a 6 */}
                <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
                  {Array.from({ length: MAX - MIN + 1 }).map((_, i) => {
                    const tick = MIN + i;
                    const current = tick === value;
                    return (
                      <span
                        key={tick}
                        className={`tabular-nums ${current ? 'text-[#003876] dark:text-[#ffd700] font-semibold' : ''}`}
                      >
                        {tick}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        <label className="flex items-center gap-2.5 pt-2">
          <input
            type="checkbox"
            checked={data.ticket_format.per_sector_counter}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                ticket_format: { ...prev.ticket_format, per_sector_counter: e.target.checked },
              }))
            }
            className="w-4 h-4 rounded border-gray-300 text-[#003876] focus:ring-[#003876]/30"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Contador separado por setor</span>
        </label>
      </SettingsCard>

      {/* 3. Som de Notificação */}
      <SettingsCard collapseId="attendance.sound" title="Som de Notificação" icon={Volume2} description="Som tocado no painel do cliente quando a senha for chamada. Clique num preset para ouvir.">
        <button
          type="button"
          onClick={() =>
            setData((prev) => ({
              ...prev,
              sound: { ...prev.sound, enabled: !prev.sound.enabled },
            }))
          }
          className={`
            w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200
            ${data.sound.enabled
              ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
            }
          `}
        >
          <Volume2 className={`w-4 h-4 shrink-0 mt-0.5 ${data.sound.enabled ? 'text-[#ffd700]' : 'text-gray-400'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${data.sound.enabled ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
              Habilitar som de notificação
            </p>
            <p className={`text-[11px] mt-0.5 leading-tight ${data.sound.enabled ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
              Toca o preset escolhido quando a senha do cliente for chamada.
            </p>
          </div>
        </button>

        {data.sound.enabled && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {SOUND_PRESETS.map(({ key, label, icon: Icon }) => {
              const active = data.sound.preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectSoundPreset(key)}
                  className={`
                    flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200
                    ${active
                      ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                    }
                  `}
                >
                  <Icon className={`w-6 h-6 ${active ? 'text-[#ffd700]' : 'text-gray-400'}`} />
                  <span className={`text-xs font-semibold ${
                    active ? 'text-white' : 'text-gray-800 dark:text-gray-100'
                  }`}>{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </SettingsCard>

      {/* 4. Tela do cliente */}
      <SettingsCard collapseId="attendance.clientScreen" title="Tela do Cliente" icon={Monitor} description="Controle o que é exibido na página pública após a senha ser gerada. Clique para habilitar/desabilitar cada item.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {([
            { key: 'show_last_called',   label: 'Última senha chamada', desc: 'Exibe a última senha chamada em outro setor.', icon: History         },
            { key: 'show_sector',        label: 'Setor do atendimento', desc: 'Mostra o setor/motivo da senha do cliente.',    icon: LayoutGrid      },
            { key: 'show_wait_estimate', label: 'Estimativa de espera', desc: 'Tempo médio até o chamado, por setor.',         icon: Clock           },
            { key: 'show_instructions',  label: 'Instruções ao cliente', desc: 'Texto livre configurado abaixo.',               icon: MessageSquare   },
          ] as const).map(({ key, label, desc, icon: Icon }) => {
            const active = Boolean((data.client_screen_fields as unknown as Record<string, unknown>)[key]);
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setData((prev) => ({
                    ...prev,
                    client_screen_fields: {
                      ...prev.client_screen_fields,
                      [key]: !active,
                    } as AttendanceClientScreenFields,
                  }))
                }
                className={`
                  flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200
                  ${active
                    ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                  }
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${active ? 'text-[#ffd700]' : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${
                    active ? 'text-white' : 'text-gray-800 dark:text-gray-100'
                  }`}>{label}</p>
                  <p className={`text-[11px] mt-0.5 leading-tight ${
                    active ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                  }`}>{desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {data.client_screen_fields.show_instructions && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Texto das instruções
            </label>
            <textarea
              value={data.client_screen_fields.instructions_text}
              onChange={(e) =>
                setData((prev) => ({
                  ...prev,
                  client_screen_fields: { ...prev.client_screen_fields, instructions_text: e.target.value },
                }))
              }
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
            />
          </div>
        )}
      </SettingsCard>

      {/* 5. Feedback */}
      <SettingsCard collapseId="attendance.feedback" title="Feedback Pós-Atendimento" icon={Star} description="Coleta de avaliação do cliente após a finalização do atendimento.">
        {/* Master toggle — padrão de botão igual aos outros cards */}
        <button
          type="button"
          onClick={() =>
            setData((prev) => ({
              ...prev,
              feedback: { ...prev.feedback, enabled: !prev.feedback.enabled },
            }))
          }
          className={`
            w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200
            ${data.feedback.enabled
              ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
            }
          `}
        >
          <ThumbsUp className={`w-4 h-4 shrink-0 mt-0.5 ${data.feedback.enabled ? 'text-[#ffd700]' : 'text-gray-400'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${data.feedback.enabled ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
              Habilitar feedback pós-atendimento
            </p>
            <p className={`text-[11px] mt-0.5 leading-tight ${data.feedback.enabled ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
              Coleta avaliação do cliente logo após o atendimento ser finalizado.
            </p>
          </div>
        </button>

        {data.feedback.enabled && (
          <>
            {/* Texto do convite — editável */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Texto exibido ao cliente
              </label>
              <input
                type="text"
                value={data.feedback.prompt_text}
                onChange={(e) =>
                  setData((prev) => ({
                    ...prev,
                    feedback: { ...prev.feedback, prompt_text: e.target.value },
                  }))
                }
                placeholder="Como foi seu atendimento?"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Aparece logo acima da escala de avaliação na tela do cliente.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Escala</label>
                <select
                  value={data.feedback.scale}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      feedback: { ...prev.feedback, scale: e.target.value as AttendanceFeedbackConfig['scale'] },
                    }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
                >
                  <option value="stars">Estrelas</option>
                  <option value="numeric">Numérica</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Máximo</label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={data.feedback.max}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      feedback: { ...prev.feedback, max: Math.max(3, Math.min(10, parseInt(e.target.value) || 5)) },
                    }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
                />
              </div>
            </div>

            {/* Toggles adicionais: campo livre (independente) + perguntas personalizadas (independente) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Campo livre para comentários — campo adicional no formulário do cliente */}
              <button
                type="button"
                onClick={() =>
                  setData((prev) => ({
                    ...prev,
                    feedback: { ...prev.feedback, allow_comments: !prev.feedback.allow_comments },
                  }))
                }
                className={`
                  flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200
                  ${data.feedback.allow_comments
                    ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                  }
                `}
              >
                <MessageCircle className={`w-4 h-4 shrink-0 mt-0.5 ${data.feedback.allow_comments ? 'text-[#ffd700]' : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${data.feedback.allow_comments ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
                    Campo livre para comentários
                  </p>
                  <p className={`text-[11px] mt-0.5 leading-tight ${data.feedback.allow_comments ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                    Exibe um campo de texto adicional no formulário.
                  </p>
                </div>
              </button>

              {/* Perguntas personalizadas — quando ligado, lista de perguntas aparece abaixo */}
              <button
                type="button"
                onClick={() =>
                  setData((prev) => ({
                    ...prev,
                    feedback: { ...prev.feedback, custom_questions_enabled: !prev.feedback.custom_questions_enabled },
                  }))
                }
                className={`
                  flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200
                  ${data.feedback.custom_questions_enabled
                    ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                  }
                `}
              >
                <ListChecks className={`w-4 h-4 shrink-0 mt-0.5 ${data.feedback.custom_questions_enabled ? 'text-[#ffd700]' : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${data.feedback.custom_questions_enabled ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
                    Perguntas personalizadas
                  </p>
                  <p className={`text-[11px] mt-0.5 leading-tight ${data.feedback.custom_questions_enabled ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                    Inclui perguntas extras além da avaliação principal.
                  </p>
                </div>
              </button>
            </div>

            {/* Lista de perguntas personalizadas — só quando o toggle estiver ligado */}
            {data.feedback.custom_questions_enabled && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold tracking-[0.1em] uppercase text-gray-400">Perguntas personalizadas</p>
                  <button
                    type="button"
                    onClick={() =>
                      setData((prev) => ({
                        ...prev,
                        feedback: {
                          ...prev.feedback,
                          questions: [
                            ...prev.feedback.questions,
                            { id: `q_${Date.now()}`, label: '', type: 'rating', max: 5 } as AttendanceQuestion,
                          ],
                        },
                      }))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-500 hover:text-[#003876] hover:border-[#003876] transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar
                  </button>
                </div>

                {data.feedback.questions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Nenhuma pergunta personalizada.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.feedback.questions.map((q, idx) => {
                      const updateQuestion = (updater: (q: AttendanceQuestion) => AttendanceQuestion) =>
                        setData((prev) => ({
                          ...prev,
                          feedback: {
                            ...prev.feedback,
                            questions: prev.feedback.questions.map((x, i) => (i === idx ? updater(x) : x)),
                          },
                        }));

                      /**
                       * Mudança de tipo cria uma nova pergunta preservando id+label.
                       * Cada tipo tem um shape próprio — forçar via "as" seria frágil,
                       * então construímos explicitamente e deixamos o defaults de cada
                       * variante aparecerem.
                       */
                      const changeType = (newType: AttendanceQuestionType) =>
                        updateQuestion((current) => {
                          const base = { id: current.id, label: current.label };
                          switch (newType) {
                            case 'rating':        return { ...base, type: 'rating', max: 5 };
                            case 'text':          return { ...base, type: 'text' };
                            case 'single_choice': return { ...base, type: 'single_choice', options: ['Opção 1', 'Opção 2'] };
                            case 'multi_choice':  return { ...base, type: 'multi_choice',  options: ['Opção 1', 'Opção 2'] };
                            case 'scale':         return { ...base, type: 'scale', min: 0, max: 10, step: 1, min_label: '', max_label: '' };
                            case 'yes_no':        return { ...base, type: 'yes_no' };
                            case 'emoji':         return { ...base, type: 'emoji' };
                          }
                        });

                      const TYPE_BUTTONS: Array<{ value: AttendanceQuestionType; Icon: React.ComponentType<{ className?: string }>; label: string }> = [
                        { value: 'rating',        Icon: Star,                label: 'Estrelas'   },
                        { value: 'emoji',         Icon: Smile,               label: 'Emoji'      },
                        { value: 'single_choice', Icon: CircleDot,           label: 'Escolha'    },
                        { value: 'multi_choice',  Icon: CheckSquare,         label: 'Múltipla'   },
                        { value: 'yes_no',        Icon: ToggleLeft,          label: 'Sim/Não'    },
                        { value: 'scale',         Icon: SlidersHorizontal,   label: 'Escala'     },
                        { value: 'text',          Icon: Type,                label: 'Texto'      },
                      ];

                      return (
                        <div key={q.id} className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 p-3 space-y-2.5">
                          {/* Linha 1: texto da pergunta + remover */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Texto da pergunta"
                              value={q.label}
                              onChange={(e) => {
                                const value = e.target.value;
                                updateQuestion((cur) => ({ ...cur, label: value }));
                              }}
                              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setData((prev) => ({
                                  ...prev,
                                  feedback: {
                                    ...prev.feedback,
                                    questions: prev.feedback.questions.filter((_, i) => i !== idx),
                                  },
                                }))
                              }
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                              title="Remover pergunta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Linha 2: seletor de tipo (7 botões em grid responsivo) */}
                          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                            {TYPE_BUTTONS.map(({ value, Icon, label }) => {
                              const active = q.type === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => changeType(value)}
                                  title={label}
                                  className={`flex flex-col items-center justify-center gap-1 px-1.5 py-2 rounded-lg border transition-all ${
                                    active
                                      ? 'bg-[#003876] text-white border-[#003876] shadow-md'
                                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:text-[#003876] hover:border-[#003876]'
                                  }`}
                                >
                                  <Icon className={`w-3.5 h-3.5 ${active && value === 'rating' ? 'fill-[#ffd700] text-[#ffd700]' : ''}`} />
                                  <span className="text-[10px] font-medium leading-none">{label}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Linha 3: configuração específica do tipo */}
                          {q.type === 'rating' && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="shrink-0">Quantidade de estrelas:</span>
                              <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
                                {[3, 4, 5, 6, 10].map((n) => (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => updateQuestion((cur) => ({ ...cur, type: 'rating', max: n }))}
                                    className={`px-2.5 py-1 text-[11px] font-semibold border-r border-gray-200 dark:border-gray-600 last:border-r-0 transition-colors ${
                                      (q.max ?? 5) === n
                                        ? 'bg-[#003876] text-white'
                                        : 'text-gray-500 hover:text-[#003876]'
                                    }`}
                                  >
                                    {n}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {(q.type === 'single_choice' || q.type === 'multi_choice') && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">Opções</p>
                              <div className="space-y-1.5">
                                {q.options.map((opt, optIdx) => (
                                  <div key={optIdx} className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        updateQuestion((cur) => {
                                          if (cur.type !== 'single_choice' && cur.type !== 'multi_choice') return cur;
                                          return { ...cur, options: cur.options.map((o, i) => (i === optIdx ? v : o)) };
                                        });
                                      }}
                                      placeholder={`Opção ${optIdx + 1}`}
                                      className="flex-1 min-w-0 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs outline-none focus:border-[#003876] focus:ring-1 focus:ring-[#003876]/20"
                                    />
                                    <button
                                      type="button"
                                      disabled={q.options.length <= 2}
                                      onClick={() => updateQuestion((cur) => {
                                        if (cur.type !== 'single_choice' && cur.type !== 'multi_choice') return cur;
                                        if (cur.options.length <= 2) return cur;
                                        return { ...cur, options: cur.options.filter((_, i) => i !== optIdx) };
                                      })}
                                      className="p-1 rounded text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                      title="Remover opção"
                                    >
                                      <XIcon className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  disabled={q.options.length >= 8}
                                  onClick={() => updateQuestion((cur) => {
                                    if (cur.type !== 'single_choice' && cur.type !== 'multi_choice') return cur;
                                    if (cur.options.length >= 8) return cur;
                                    return { ...cur, options: [...cur.options, `Opção ${cur.options.length + 1}`] };
                                  })}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[#003876] hover:bg-[#003876]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  Adicionar opção ({q.options.length}/8)
                                </button>
                              </div>
                            </div>
                          )}

                          {q.type === 'scale' && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="block text-[10px] font-semibold tracking-wider uppercase text-gray-400 mb-1">Mínimo</label>
                                <input
                                  type="number"
                                  value={q.min}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value || '0', 10);
                                    updateQuestion((cur) => (cur.type === 'scale' ? { ...cur, min: v } : cur));
                                  }}
                                  className="w-full px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs outline-none focus:border-[#003876] focus:ring-1 focus:ring-[#003876]/20"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold tracking-wider uppercase text-gray-400 mb-1">Máximo</label>
                                <input
                                  type="number"
                                  value={q.max}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value || '0', 10);
                                    updateQuestion((cur) => (cur.type === 'scale' ? { ...cur, max: v } : cur));
                                  }}
                                  className="w-full px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs outline-none focus:border-[#003876] focus:ring-1 focus:ring-[#003876]/20"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold tracking-wider uppercase text-gray-400 mb-1">Rótulo inicial</label>
                                <input
                                  type="text"
                                  value={q.min_label ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    updateQuestion((cur) => (cur.type === 'scale' ? { ...cur, min_label: v } : cur));
                                  }}
                                  placeholder="Ex: Ruim"
                                  className="w-full px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs outline-none focus:border-[#003876] focus:ring-1 focus:ring-[#003876]/20"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold tracking-wider uppercase text-gray-400 mb-1">Rótulo final</label>
                                <input
                                  type="text"
                                  value={q.max_label ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    updateQuestion((cur) => (cur.type === 'scale' ? { ...cur, max_label: v } : cur));
                                  }}
                                  placeholder="Ex: Excelente"
                                  className="w-full px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs outline-none focus:border-[#003876] focus:ring-1 focus:ring-[#003876]/20"
                                />
                              </div>
                            </div>
                          )}

                          {q.type === 'yes_no' && (
                            <p className="text-[11px] text-gray-400 italic">
                              O cliente verá dois botões: Sim / Não.
                            </p>
                          )}
                          {q.type === 'emoji' && (
                            <p className="text-[11px] text-gray-400 italic">
                              Escala de 5 emojis: 😡 😕 😐 🙂 😍.
                            </p>
                          )}
                          {q.type === 'text' && (
                            <p className="text-[11px] text-gray-400 italic">
                              O cliente verá um campo de texto livre.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </SettingsCard>

      {/* 6. Painel de Chamadas */}
      <SettingsCard collapseId="attendance.displayPanel" title="Painel de Chamadas" icon={Tv} description="Configure o painel público exibido na TV da recepção.">
        {/* Senha de acesso */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Senha de acesso ao painel</label>
          <div className="relative max-w-xs">
            <input
              type={showPanelPassword ? 'text' : 'password'}
              value={data.display_panel.password}
              onChange={(e) => setData((prev) => ({ ...prev, display_panel: { ...prev.display_panel, password: e.target.value } }))}
              placeholder="Defina uma senha simples"
              className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
            />
            <button
              type="button"
              onClick={() => setShowPanelPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPanelPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Exibir nome do visitante — toggle full-width igual cards 3 e 5 */}
        <button
          type="button"
          onClick={() => setData((prev) => ({ ...prev, display_panel: { ...prev.display_panel, show_visitor_name: !prev.display_panel.show_visitor_name } }))}
          className={`
            w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200
            ${data.display_panel.show_visitor_name
              ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
            }
          `}
        >
          <Eye className={`w-4 h-4 shrink-0 mt-0.5 ${data.display_panel.show_visitor_name ? 'text-[#ffd700]' : 'text-gray-400'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${data.display_panel.show_visitor_name ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
              Exibir nome do visitante
            </p>
            <p className={`text-[11px] mt-0.5 leading-tight ${data.display_panel.show_visitor_name ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
              Mostra o nome do visitante abaixo da senha em destaque no painel.
            </p>
          </div>
        </button>

        {/* Som do painel — grid centralizado igual ao card 3 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Som de alerta</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {SOUND_PRESETS.map(({ key, label, icon: Icon }) => {
              const active = data.display_panel.sound_preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setData((prev) => ({ ...prev, display_panel: { ...prev.display_panel, sound_preset: key } }));
                    playSoundPreview(key);
                  }}
                  className={`
                    flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200
                    ${active
                      ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                    }
                  `}
                >
                  <Icon className={`w-6 h-6 ${active ? 'text-[#ffd700]' : 'text-gray-400'}`} />
                  <span className={`text-xs font-semibold ${
                    active ? 'text-white' : 'text-gray-800 dark:text-gray-100'
                  }`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Repetições + Histórico — grid 2 colunas com botões card-style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Repetições do alerta</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { n: 1, label: '1×', desc: 'Único' },
                { n: 2, label: '2×', desc: 'Duplo' },
                { n: 3, label: '3×', desc: 'Triplo' },
              ].map(({ n, label, desc }) => {
                const active = data.display_panel.sound_repeat === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setData((prev) => ({ ...prev, display_panel: { ...prev.display_panel, sound_repeat: n } }))}
                    className={`
                      flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all duration-200
                      ${active
                        ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                      }
                    `}
                  >
                    <span className={`text-lg font-bold ${active ? 'text-[#ffd700]' : 'text-gray-400'}`}>{label}</span>
                    <span className={`text-[10px] font-medium ${active ? 'text-white/70' : 'text-gray-500'}`}>{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Senhas no histórico por setor</label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 5, 7, 10].map((n) => {
                const active = data.display_panel.history_count === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setData((prev) => ({ ...prev, display_panel: { ...prev.display_panel, history_count: n } }))}
                    className={`
                      flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all duration-200
                      ${active
                        ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                      }
                    `}
                  >
                    <span className={`text-lg font-bold ${active ? 'text-[#ffd700]' : 'text-gray-400'}`}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filtro de setores */}
        {sectors.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Setores exibidos no painel
              <span className="ml-1 text-gray-400/80 font-normal">(vazio = todos)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {sectors.map(({ key, label, icon }) => {
                const active = data.display_panel.sector_filter.includes(key);
                const SectorIcon = (icon && SECTOR_ICON_MAP[icon]) || SECTOR_ICON_MAP.FileText;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setData((prev) => ({
                        ...prev,
                        display_panel: {
                          ...prev.display_panel,
                          sector_filter: active
                            ? prev.display_panel.sector_filter.filter((s) => s !== key)
                            : [...prev.display_panel.sector_filter, key],
                        },
                      }))
                    }
                    className={`
                      flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200
                      ${active
                        ? 'bg-[#003876] text-white border-[#003876] shadow-md shadow-[#003876]/20'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#003876]/40 hover:text-[#003876]'
                      }
                    `}
                  >
                    <SectorIcon className={`w-4 h-4 shrink-0 mt-0.5 ${active ? 'text-[#ffd700]' : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${active ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>{label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tema visual */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tema visual</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {THEME_PRESETS.map(({ key, label, bg, card, highlight, text, muted }) => {
              const active = data.display_panel.theme === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setData((prev) => ({ ...prev, display_panel: { ...prev.display_panel, theme: key } }))}
                  className={`rounded-xl border overflow-hidden transition-all duration-200 ${
                    active
                      ? 'border-[#003876] shadow-md shadow-[#003876]/20 ring-2 ring-[#003876]/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-[#003876]/40'
                  }`}
                >
                  {/* Mini panel mockup */}
                  <div className="aspect-[4/3] p-2 flex flex-col" style={{ backgroundColor: bg }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="h-1 w-8 rounded-full" style={{ backgroundColor: muted, opacity: 0.5 }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center gap-1">
                      <div className="h-1 w-6 rounded-full" style={{ backgroundColor: muted, opacity: 0.4 }} />
                      <div className="text-base font-black leading-none" style={{ color: highlight }}>A001</div>
                      <div className="h-1 w-8 rounded-full" style={{ backgroundColor: text, opacity: 0.25 }} />
                    </div>
                    <div className="flex gap-1 mt-1">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex-1 rounded p-1 space-y-0.5" style={{ backgroundColor: card }}>
                          <div className="h-0.5 w-4 rounded-full" style={{ backgroundColor: muted, opacity: 0.3 }} />
                          <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: text, opacity: 0.2 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={`px-2 py-1.5 text-center text-[10px] font-semibold transition-colors ${
                    active ? 'bg-[#003876] text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-500'
                  }`}>
                    {label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Link direto */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Link direto para o painel</label>
          <div className="flex items-center gap-2 max-w-md">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
              <Link className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500 truncate">{`${window.location.origin}/painel-atendimento`}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/painel-atendimento`);
                setPanelLinkCopied(true);
                setTimeout(() => setPanelLinkCopied(false), 2000);
              }}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                panelLinkCopied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#003876] text-white hover:bg-[#002855]'
              }`}
            >
              {panelLinkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {panelLinkCopied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* Floating save button */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-[#003876] text-white hover:bg-[#002855] shadow-[#003876]/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

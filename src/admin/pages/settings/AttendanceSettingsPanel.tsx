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
  // Ticket format icons (prefix mode)
  Minus,
  Edit3,
  Folder,
} from 'lucide-react';
import type {
  AttendanceEligibilityRules,
  AttendanceTicketFormat,
  AttendanceSoundConfig,
  AttendanceClientScreenFields,
  AttendanceFeedbackConfig,
} from '../../types/admin.types';

interface AllowWalkins {
  enabled: boolean;
}

interface Sector {
  key: string;
  label: string;
}

interface AttendanceState {
  eligibility_rules: AttendanceEligibilityRules;
  allow_walkins: AllowWalkins;
  ticket_format: AttendanceTicketFormat;
  sound: AttendanceSoundConfig;
  client_screen_fields: AttendanceClientScreenFields;
  feedback: AttendanceFeedbackConfig;
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
            parsedSectors = (raw as Array<{ key: string; label: string }>)
              .filter((r) => r.key && r.label)
              .map((r) => ({ key: r.key, label: r.label }));
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
      <SettingsCard title="Regras de Elegibilidade" icon={Shield} description="Defina quando um visitante pode emitir senha. Marque mais de uma para combinar as regras; “Qualquer data” desabilita as demais.">
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
      <SettingsCard title="Formato de Senha" icon={Hash} description="Personalize o formato do número exibido na senha emitida.">
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
      <SettingsCard title="Som de Notificação" icon={Volume2} description="Som tocado no painel do cliente quando a senha for chamada. Clique num preset para ouvir.">
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
      <SettingsCard title="Tela do Cliente" icon={Monitor} description="Controle o que é exibido na página pública após a senha ser gerada. Clique para habilitar/desabilitar cada item.">
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
      <SettingsCard title="Feedback Pós-Atendimento" icon={Star} description="Coleta de avaliação do cliente após a finalização do atendimento.">
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
                            { id: `q_${Date.now()}`, label: '', type: 'rating' },
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
                  <div className="space-y-2">
                    {data.feedback.questions.map((q, idx) => {
                      const setType = (value: 'rating' | 'text') =>
                        setData((prev) => ({
                          ...prev,
                          feedback: {
                            ...prev.feedback,
                            questions: prev.feedback.questions.map((x, i) => (i === idx ? { ...x, type: value } : x)),
                          },
                        }));

                      return (
                        <div key={q.id} className="flex items-center gap-2">
                          {/* Input diminuído — menos protagonismo que antes */}
                          <input
                            type="text"
                            placeholder="Texto da pergunta"
                            value={q.label}
                            onChange={(e) => {
                              const value = e.target.value;
                              setData((prev) => ({
                                ...prev,
                                feedback: {
                                  ...prev.feedback,
                                  questions: prev.feedback.questions.map((x, i) => (i === idx ? { ...x, label: value } : x)),
                                },
                              }));
                            }}
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs outline-none focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20"
                          />

                          {/* Dois botões mutuamente exclusivos: Estrela ou Texto */}
                          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden shrink-0">
                            <button
                              type="button"
                              onClick={() => setType('rating')}
                              title="Avaliação em estrelas"
                              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                q.type === 'rating'
                                  ? 'bg-[#003876] text-white'
                                  : 'text-gray-500 hover:text-[#003876]'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${q.type === 'rating' ? 'fill-[#ffd700] text-[#ffd700]' : ''}`} />
                              Estrela
                            </button>
                            <button
                              type="button"
                              onClick={() => setType('text')}
                              title="Resposta em texto livre"
                              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border-l border-gray-200 dark:border-gray-600 transition-colors ${
                                q.type === 'text'
                                  ? 'bg-[#003876] text-white'
                                  : 'text-gray-500 hover:text-[#003876]'
                              }`}
                            >
                              <Type className="w-3.5 h-3.5" />
                              Texto
                            </button>
                          </div>

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
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

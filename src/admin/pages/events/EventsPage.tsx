import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  SchoolEvent, EventTargetType, SchoolClass, SchoolSegment,
} from '../../types/admin.types';
import { EVENT_TARGET_LABELS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  Loader2, Plus, Pencil, Trash2, CalendarDays, X, Save,
  Users, Globe, BookOpen, MapPin, Clock, Send, Eye, EyeOff,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';
import { AnnouncementDrawer } from '../announcements/AnnouncementsPage';
import type { DrawerProps as AnnouncementDrawerProps } from '../announcements/AnnouncementsPage';

const TARGETS: EventTargetType[] = ['all', 'segment', 'class', 'role'];

const TARGET_ICON: Record<EventTargetType, React.ComponentType<{ className?: string }>> = {
  all:     Globe,
  segment: BookOpen,
  class:   Users,
  role:    Users,
};

const ROLES_LIST = [
  { value: 'student',     label: 'Alunos' },
  { value: 'teacher',     label: 'Professores' },
  { value: 'coordinator', label: 'Coordenadores' },
  { value: 'admin',       label: 'Administradores' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────


function fmtTime(t: string | null) {
  return t ? t.slice(0, 5) : null;
}

// ── Drawer ────────────────────────────────────────────────────────────────────

interface DrawerProps {
  event: SchoolEvent | null;
  segments: SchoolSegment[];
  classes: SchoolClass[];
  onClose: () => void;
  onSaved: (e: SchoolEvent, openWACampaign?: boolean) => void;
}

function EventDrawer({ event, segments, classes, onClose, onSaved }: DrawerProps) {
  const { profile } = useAdminAuth();
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const [title,      setTitle]      = useState(event?.title ?? '');
  const [description,setDescription]= useState(event?.description ?? '');
  const [location,   setLocation]   = useState(event?.location ?? '');
  const [eventDate,  setEventDate]  = useState(event?.event_date ?? '');
  const [startTime,  setStartTime]  = useState(event?.start_time ?? '');
  const [endTime,    setEndTime]    = useState(event?.end_time ?? '');
  const [targetType, setTargetType] = useState<EventTargetType>(event?.target_type ?? 'all');
  const [targetIds,  setTargetIds]  = useState<string[]>(event?.target_ids ?? []);
  const [targetRoles,setTargetRoles]= useState<string[]>(event?.target_roles ?? []);
  const [sendWA,     setSendWA]     = useState(event?.send_whatsapp_reminder ?? false);
  const [isPublished,setIsPublished]= useState(event?.is_published ?? false);

  function toggleId(arr: string[], id: string): string[] {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate) { setError('Título e data são obrigatórios.'); return; }
    setSaving(true); setError('');

    const payload = {
      title:                  title.trim(),
      description:            description.trim() || null,
      location:               location.trim() || null,
      event_date:             eventDate,
      start_time:             startTime || null,
      end_time:               endTime || null,
      target_type:            targetType,
      target_ids:             targetType === 'segment' || targetType === 'class' ? targetIds : [],
      target_roles:           targetType === 'role' ? targetRoles : [],
      send_whatsapp_reminder: sendWA,
      is_published:           isPublished,
    };

    let data: SchoolEvent | null = null;
    let dbErr;

    if (event) {
      const res = await supabase.from('school_events').update(payload).eq('id', event.id)
        .select('*, creator:profiles!created_by(full_name)').single();
      data = res.data as SchoolEvent | null;
      dbErr = res.error;
    } else {
      const res = await supabase.from('school_events')
        .insert({ ...payload, created_by: profile?.id })
        .select('*, creator:profiles!created_by(full_name)').single();
      data = res.data as SchoolEvent | null;
      dbErr = res.error;
    }

    if (dbErr || !data) { setError(dbErr?.message ?? 'Erro ao salvar.'); setSaving(false); return; }
    onSaved(data, sendWA);
  }

  const inp = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] dark:focus:border-[#ffd700]';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg h-full bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-[#003876] to-[#002255] text-white">
          <h2 className="font-semibold text-sm flex items-center gap-2"><CalendarDays className="w-4 h-4" />{event ? 'Editar Evento' : 'Novo Evento'}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/20 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={save} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

          {/* ── Informações do Evento ── */}
          <SettingsCard title="Informações do Evento" icon={CalendarDays}>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Título *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Festa Junina 2025"
                className={inp} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Data *</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Início</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Término</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Local</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Quadra poliesportiva" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descrição</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                rows={3} placeholder="Detalhes do evento..." className={`${inp} resize-none`} />
            </div>
          </SettingsCard>

          {/* ── Público-alvo ── */}
          <SettingsCard title="Público-alvo" icon={Users}>
            <div className="grid grid-cols-2 gap-2">
              {TARGETS.map((t) => {
                const Icon = TARGET_ICON[t];
                const active = targetType === t;
                return (
                  <button key={t} type="button" onClick={() => { setTargetType(t); setTargetIds([]); setTargetRoles([]); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      active ? 'border-[#003876] bg-[#003876]/10 dark:border-[#ffd700] dark:bg-[#ffd700]/10 text-[#003876] dark:text-[#ffd700]'
                             : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {EVENT_TARGET_LABELS[t]}
                  </button>
                );
              })}
            </div>

            {targetType === 'segment' && (
              <div className="flex flex-wrap gap-2">
                {segments.map((s) => (
                  <button key={s.id} type="button" onClick={() => setTargetIds((p) => toggleId(p, s.id))}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      targetIds.includes(s.id)
                        ? 'border-[#003876] bg-[#003876] dark:border-[#ffd700] dark:bg-[#ffd700]/20 text-white dark:text-[#ffd700]'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}

            {targetType === 'class' && (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {classes.map((c) => (
                  <button key={c.id} type="button" onClick={() => setTargetIds((p) => toggleId(p, c.id))}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      targetIds.includes(c.id)
                        ? 'border-[#003876] bg-[#003876] dark:border-[#ffd700] dark:bg-[#ffd700]/20 text-white dark:text-[#ffd700]'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            {targetType === 'role' && (
              <div className="flex flex-wrap gap-2">
                {ROLES_LIST.map((r) => (
                  <button key={r.value} type="button" onClick={() => setTargetRoles((p) => toggleId(p, r.value))}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      targetRoles.includes(r.value)
                        ? 'border-[#003876] bg-[#003876] dark:border-[#ffd700] dark:bg-[#ffd700]/20 text-white dark:text-[#ffd700]'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </SettingsCard>

          {/* ── Opções ── */}
          <SettingsCard title="Opções">
            <Toggle
              checked={sendWA}
              onChange={setSendWA}
              label="Enviar lembrete via WhatsApp"
              description="Abre o formulário de comunicado pré-preenchido ao salvar"
            />
            <Toggle
              checked={isPublished}
              onChange={setIsPublished}
              label="Publicar (visível no portal)"
              onColor="bg-emerald-500"
            />
          </SettingsCard>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-[#003876] hover:bg-[#002255] text-white disabled:opacity-60 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar evento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar strip ─────────────────────────────────────────────────────────────

interface CalendarStripProps {
  month: Date;
  events: SchoolEvent[];
  selected: Date | null;
  onSelectDate: (d: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}

function CalendarStrip({ month, events, selected, onSelectDate, onPrev, onNext }: CalendarStripProps) {
  const year  = month.getFullYear();
  const mon   = month.getMonth();
  const first = new Date(year, mon, 1);
  const last  = new Date(year, mon + 1, 0);
  const startDay = first.getDay(); // 0=Sun
  const cells: (Date | null)[] = Array(startDay).fill(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, mon, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const eventDays = new Set(
    events.map((e) => e.event_date.slice(0, 10))
  );

  const monthLabel = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <p className="text-sm font-semibold capitalize text-gray-700 dark:text-gray-200">{monthLabel}</p>
        <button onClick={onNext} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center mb-1">
        {['D','S','T','Q','Q','S','S'].map((d, i) => (
          <span key={i} className="text-xs font-medium text-gray-400 py-1">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso   = d.toISOString().slice(0, 10);
          const isT   = d.getTime() === today.getTime();
          const isSel = selected?.toISOString().slice(0, 10) === iso;
          const hasEv = eventDays.has(iso);
          return (
            <button key={i} onClick={() => onSelectDate(d)}
              className={`relative flex flex-col items-center justify-center h-8 rounded-lg text-xs font-medium transition-colors ${
                isSel ? 'bg-[#003876] dark:bg-[#ffd700] text-white dark:text-gray-900'
                : isT  ? 'bg-[#003876]/10 dark:bg-[#ffd700]/10 text-[#003876] dark:text-[#ffd700] font-bold'
                       : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
              {d.getDate()}
              {hasEv && !isSel && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#003876] dark:bg-[#ffd700]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const { profile } = useAdminAuth();
  const canEdit = profile?.role && ['super_admin','admin','coordinator'].includes(profile.role);

  const [events,   setEvents]   = useState<SchoolEvent[]>([]);
  const [segments, setSegments] = useState<SchoolSegment[]>([]);
  const [classes,  setClasses]  = useState<SchoolClass[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [drawerEvent, setDrawerEvent] = useState<SchoolEvent | null | undefined>(undefined); // undefined=closed, null=new
  const [waCampaignDraft, setWaCampaignDraft] = useState<AnnouncementDrawerProps['initialValues'] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: evData }, { data: segData }, { data: clData }] = await Promise.all([
      supabase.from('school_events')
        .select('*, creator:profiles!created_by(full_name)')
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true }),
      supabase.from('school_segments').select('id, name').order('position'),
      supabase.from('school_classes').select('id, name, segment_id').order('name'),
    ]);
    setEvents((evData ?? []) as SchoolEvent[]);
    setSegments((segData ?? []) as SchoolSegment[]);
    setClasses((clData ?? []) as SchoolClass[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(ev: SchoolEvent) {
    if (!confirm(`Excluir o evento "${ev.title}"?`)) return;
    await supabase.from('school_events').delete().eq('id', ev.id);
    setEvents((p) => p.filter((e) => e.id !== ev.id));
  }

  async function togglePublish(ev: SchoolEvent) {
    const { data } = await supabase.from('school_events')
      .update({ is_published: !ev.is_published })
      .eq('id', ev.id)
      .select('*, creator:profiles!created_by(full_name)').single();
    if (data) setEvents((p) => p.map((e) => e.id === ev.id ? data as SchoolEvent : e));
  }

  function handleSaved(saved: SchoolEvent, openWACampaign?: boolean) {
    setEvents((p) => {
      const idx = p.findIndex((e) => e.id === saved.id);
      return idx >= 0 ? p.map((e) => e.id === saved.id ? saved : e) : [saved, ...p];
    });
    setDrawerEvent(undefined);

    if (openWACampaign) {
      // Build announcement body: description + "Local: ..." on last line
      const bodyParts = [saved.description ?? ''];
      if (saved.location) bodyParts.push(`Local: ${saved.location}`);
      const body = bodyParts.filter(Boolean).join('\n\n');

      // Map event target to announcement target (role → all, since announcement doesn't support role)
      const annTarget = (saved.target_type === 'role' ? 'all' : saved.target_type) as 'all' | 'segment' | 'class';

      setWaCampaignDraft({
        title:         saved.title,
        body,
        target_type:   annTarget,
        target_ids:    saved.target_ids ?? [],
        target_roles:  saved.target_roles ?? [],
        send_whatsapp: true,
      });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const selectedIso = selectedDate?.toISOString().slice(0, 10) ?? null;

  const filtered = events.filter((ev) => {
    if (selectedIso && ev.event_date !== selectedIso) return false;
    if (filter === 'upcoming') return ev.event_date >= today;
    if (filter === 'past')     return ev.event_date < today;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-[#003876] dark:text-[#ffd700]" /> Eventos
        </h1>
        {canEdit && (
          <button onClick={() => setDrawerEvent(null)}
            className="flex items-center gap-2 px-4 py-2 bg-[#003876] hover:bg-[#002255] text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Novo Evento
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#003876] dark:text-[#ffd700]" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
          {/* Calendar */}
          <div className="space-y-3">
            <CalendarStrip
              month={calMonth}
              events={events}
              selected={selectedDate}
              onSelectDate={(d) => setSelectedDate((p) => p?.toISOString().slice(0, 10) === d.toISOString().slice(0, 10) ? null : d)}
              onPrev={() => setCalMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
              onNext={() => setCalMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
            />
            {selectedDate && (
              <button onClick={() => setSelectedDate(null)}
                className="w-full text-xs text-center text-[#003876] dark:text-[#ffd700] hover:underline">
                Limpar filtro de data
              </button>
            )}
          </div>

          {/* List */}
          <div className="space-y-4">
            {/* Filter tabs */}
            <div className="flex gap-2">
              {(['upcoming','all','past'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filter === f ? 'bg-[#003876] text-white dark:bg-[#ffd700] dark:text-gray-900'
                                 : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                  {f === 'upcoming' ? 'Próximos' : f === 'past' ? 'Passados' : 'Todos'}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} evento{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum evento encontrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((ev) => {
                  const isPast = ev.event_date < today;
                  const TargetIcon = TARGET_ICON[ev.target_type];
                  return (
                    <div key={ev.id}
                      className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden transition-opacity ${
                        isPast ? 'opacity-70 border-gray-100 dark:border-gray-700' : 'border-gray-100 dark:border-gray-700'}`}>
                      {/* Left accent bar */}
                      <div className="flex">
                        <div className={`w-1 flex-shrink-0 ${ev.is_published ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between gap-3">
                            {/* Date block */}
                            <div className="flex-shrink-0 w-12 text-center">
                              <p className="text-lg font-bold text-[#003876] dark:text-[#ffd700] leading-none">
                                {new Date(ev.event_date + 'T12:00:00').getDate().toString().padStart(2,'0')}
                              </p>
                              <p className="text-xs text-gray-400 uppercase">
                                {new Date(ev.event_date + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                              </p>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{ev.title}</p>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  ev.is_published
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                                  {ev.is_published ? 'Publicado' : 'Rascunho'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {(ev.start_time || ev.end_time) && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}
                                  </span>
                                )}
                                {ev.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {ev.location}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <TargetIcon className="w-3 h-3" />
                                  {EVENT_TARGET_LABELS[ev.target_type]}
                                </span>
                                {ev.send_whatsapp_reminder && (
                                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                    <Send className="w-3 h-3" /> WhatsApp
                                  </span>
                                )}
                              </div>

                              {ev.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{ev.description}</p>
                              )}
                            </div>

                            {/* Actions */}
                            {canEdit && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => togglePublish(ev)} title={ev.is_published ? 'Despublicar' : 'Publicar'}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                  {ev.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => setDrawerEvent(ev)}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => remove(ev)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-gray-400 hover:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {drawerEvent !== undefined && (
        <EventDrawer
          event={drawerEvent}
          segments={segments}
          classes={classes}
          onClose={() => setDrawerEvent(undefined)}
          onSaved={handleSaved}
        />
      )}

      {waCampaignDraft !== null && (
        <AnnouncementDrawer
          announcement={null}
          initialValues={waCampaignDraft}
          segments={segments}
          classes={classes}
          onClose={() => setWaCampaignDraft(null)}
          onSaved={() => setWaCampaignDraft(null)}
        />
      )}
    </div>
  );
}

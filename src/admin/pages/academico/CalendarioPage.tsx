import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { SchoolCalendarEvent, CalendarEventType } from '../../types/admin.types';
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from '../../types/admin.types';
import {
  Calendar, ChevronLeft, ChevronRight, Loader2, List, LayoutGrid,
  Plus, Pencil, Trash2, CalendarDays,
} from 'lucide-react';
import { Drawer, DrawerCard } from '../../components/Drawer';

// ── School event (from /admin/eventos) ──────────────────────────────────────
interface SchoolEventRow {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  is_published: boolean;
}

const SCHOOL_EVENT_COLOR = 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400';

// ── Native date helpers (replacing date-fns) ────────────────────────────────

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function subMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() - n, 1);
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function isTodayDate(date: Date): boolean {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + (6 - d.getDay()));
  d.setHours(23, 59, 59, 999);
  return d;
}

function eachDayOfInterval(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endTime = end.getTime();
  while (cur.getTime() <= endTime) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISO(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatDayMonth(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_TYPES: CalendarEventType[] = [
  'holiday', 'exam_period', 'recess', 'deadline', 'institutional', 'period_start', 'period_end',
];

interface EventForm {
  title: string;
  type: CalendarEventType;
  description: string;
  start_date: string;
  end_date: string;
  period_number: string;
  segment_ids: string[];
}

const emptyForm = (): EventForm => ({
  title: '',
  type: 'institutional',
  description: '',
  start_date: '',
  end_date: '',
  period_number: '',
  segment_ids: [],
});

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<SchoolCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [filterSegment, setFilterSegment] = useState<string>('');
  const [showSchoolEvents, setShowSchoolEvents] = useState(true);
  const [schoolEvents, setSchoolEvents] = useState<SchoolEventRow[]>([]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SchoolCalendarEvent | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const schoolYear = currentDate.getFullYear();

  // ── Fetch events ────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('school_calendar_events')
      .select('*')
      .eq('school_year', schoolYear)
      .order('start_date');

    if (error) {
      console.error('Erro ao carregar calendário:', error);
    } else {
      setEvents(data ?? []);
    }
    setLoading(false);
  }, [schoolYear]);

  const fetchSegments = useCallback(async () => {
    const { data } = await supabase
      .from('school_segments')
      .select('id, name')
      .eq('is_active', true)
      .order('position');
    setSegments(data ?? []);
  }, []);

  const fetchSchoolEvents = useCallback(async () => {
    const yearStart = `${schoolYear}-01-01`;
    const yearEnd = `${schoolYear}-12-31`;
    const { data } = await supabase
      .from('school_events')
      .select('id, title, event_date, start_time, end_time, location, is_published')
      .gte('event_date', yearStart)
      .lte('event_date', yearEnd)
      .eq('is_published', true)
      .order('event_date');
    setSchoolEvents(data ?? []);
  }, [schoolYear]);

  useEffect(() => {
    fetchEvents();
    fetchSegments();
    fetchSchoolEvents();
  }, [fetchEvents, fetchSegments, fetchSchoolEvents]);

  // ── Filtered events ─────────────────────────────────────────────────────────
  const filtered = filterSegment
    ? events.filter((e) => e.segment_ids.length === 0 || e.segment_ids.includes(filterSegment))
    : events;

  // ── Calendar grid ───────────────────────────────────────────────────────────
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const gridDays = eachDayOfInterval(gridStart, gridEnd);

  function eventsForDay(day: Date): SchoolCalendarEvent[] {
    return filtered.filter((e) => {
      const start = parseISO(e.start_date);
      const end = parseISO(e.end_date);
      return day >= start && day <= end;
    });
  }

  function schoolEventsForDay(day: Date): SchoolEventRow[] {
    if (!showSchoolEvents) return [];
    const iso = formatDateISO(day);
    return schoolEvents.filter((e) => e.event_date === iso);
  }

  // ── Drawer handlers ─────────────────────────────────────────────────────────
  function openNewEvent(date?: Date) {
    const d = date ? formatDateISO(date) : '';
    setEditingEvent(null);
    setForm({ ...emptyForm(), start_date: d, end_date: d });
    setDrawerOpen(true);
  }

  function openEditEvent(ev: SchoolCalendarEvent) {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      type: ev.type,
      description: ev.description ?? '',
      start_date: ev.start_date,
      end_date: ev.end_date,
      period_number: ev.period_number?.toString() ?? '',
      segment_ids: ev.segment_ids ?? [],
    });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.start_date || !form.end_date) {
      console.error('Preencha título, data inicial e data final');
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      type: form.type,
      description: form.description.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      school_year: schoolYear,
      period_number: form.period_number ? parseInt(form.period_number) : null,
      segment_ids: form.segment_ids,
    };

    let error;
    if (editingEvent) {
      ({ error } = await supabase
        .from('school_calendar_events')
        .update(payload)
        .eq('id', editingEvent.id));
    } else {
      ({ error } = await supabase.from('school_calendar_events').insert(payload));
    }

    if (error) {
      console.error('Erro ao salvar evento:', error);
    } else {
      setDrawerOpen(false);
      fetchEvents();
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!editingEvent) return;
    setSaving(true);
    const { error } = await supabase
      .from('school_calendar_events')
      .delete()
      .eq('id', editingEvent.id);

    if (error) {
      console.error('Erro ao excluir evento:', error);
    } else {
      setDrawerOpen(false);
      fetchEvents();
    }
    setSaving(false);
  }

  function toggleSegmentId(id: string) {
    setForm((prev) => ({
      ...prev,
      segment_ids: prev.segment_ids.includes(id)
        ? prev.segment_ids.filter((s) => s !== id)
        : [...prev.segment_ids, id],
    }));
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 min-w-[140px] text-center capitalize">
            {formatMonthYear(currentDate)}
          </span>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterSegment}
            onChange={(e) => setFilterSegment(e.target.value)}
            className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
          >
            <option value="">Todos os segmentos</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <button
            onClick={() => setShowSchoolEvents(!showSchoolEvents)}
            title={showSchoolEvents ? 'Ocultar eventos institucionais' : 'Mostrar eventos institucionais'}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${
              showSchoolEvents
                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Eventos
          </button>

          <div className="flex rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-2 transition-colors ${view === 'grid' ? 'bg-brand-primary text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 transition-colors ${view === 'list' ? 'bg-brand-primary text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => openNewEvent()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Evento
          </button>
        </div>
      </div>

      {/* Grid view */}
      {view === 'grid' && (
        <div className="border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800/50">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {gridDays.map((day) => {
              const dayCalEvents = eventsForDay(day);
              const daySchoolEvts = schoolEventsForDay(day);
              const allChips = [
                ...dayCalEvents.map((ev) => ({ key: ev.id, title: ev.title, color: EVENT_TYPE_COLORS[ev.type], editable: true as const, event: ev })),
                ...daySchoolEvts.map((ev) => ({ key: `se-${ev.id}`, title: `📅 ${ev.title}`, color: SCHOOL_EVENT_COLOR, editable: false as const, event: null })),
              ];
              const inMonth = isSameMonth(day, currentDate);
              const today = isTodayDate(day);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => openNewEvent(day)}
                  className={`min-h-[80px] border-t border-r border-gray-100 dark:border-gray-700 p-1.5 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors ${
                    !inMonth ? 'opacity-40' : ''
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    today ? 'bg-brand-primary text-white' : 'text-gray-600 dark:text-gray-300'
                  }`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {allChips.slice(0, 3).map((chip) => (
                      <button
                        key={chip.key}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (chip.editable && chip.event) openEditEvent(chip.event);
                        }}
                        className={`w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate ${chip.color} ${!chip.editable ? 'cursor-default opacity-80' : ''}`}
                      >
                        {chip.title}
                      </button>
                    ))}
                    {allChips.length > 3 && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 pl-1">
                        +{allChips.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {view === 'list' && (() => {
        // Merge calendar events + school events into a single sorted list
        type ListItem =
          | { kind: 'calendar'; ev: SchoolCalendarEvent; sortDate: string }
          | { kind: 'school'; ev: SchoolEventRow; sortDate: string };

        const listItems: ListItem[] = [
          ...filtered.map((ev): ListItem => ({ kind: 'calendar', ev, sortDate: ev.start_date })),
          ...(showSchoolEvents
            ? schoolEvents.map((ev): ListItem => ({ kind: 'school', ev, sortDate: ev.event_date }))
            : []),
        ].sort((a, b) => a.sortDate.localeCompare(b.sortDate));

        return (
          <div className="space-y-2">
            {listItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                <Calendar className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">Nenhum evento neste ano</p>
              </div>
            )}
            {listItems.map((item) => {
              if (item.kind === 'calendar') {
                const ev = item.ev;
                return (
                  <div
                    key={ev.id}
                    onClick={() => openEditEvent(ev)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-brand-primary/30 dark:hover:border-brand-primary/30 cursor-pointer transition-colors"
                  >
                    <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${EVENT_TYPE_COLORS[ev.type]}`}>
                      {EVENT_TYPE_LABELS[ev.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{ev.title}</p>
                      {ev.description && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{ev.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {formatDayMonth(parseISO(ev.start_date))}
                      {ev.start_date !== ev.end_date && ` – ${formatDayMonth(parseISO(ev.end_date))}`}
                    </span>
                  </div>
                );
              }
              // School event (read-only, indigo)
              const ev = item.ev;
              return (
                <div
                  key={`se-${ev.id}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-indigo-100 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-900/10 opacity-80"
                >
                  <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${SCHOOL_EVENT_COLOR}`}>
                    📅 Evento
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 truncate">{ev.title}</p>
                    {ev.location && (
                      <p className="text-xs text-indigo-400 dark:text-indigo-500 truncate">{ev.location}</p>
                    )}
                  </div>
                  <span className="text-xs text-indigo-400 dark:text-indigo-500 whitespace-nowrap">
                    {formatDayMonth(parseISO(ev.event_date))}
                    {ev.start_time && ` ${ev.start_time.slice(0, 5)}`}
                    {ev.end_time && `–${ev.end_time.slice(0, 5)}`}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingEvent ? 'Editar Evento' : 'Novo Evento'}
        icon={Calendar}
        footer={
          <div className="flex items-center gap-2">
            {editingEvent && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setDrawerOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        }
      >
        <DrawerCard title="Informações" icon={Pencil}>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Título</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 mb-3"
            placeholder="Nome do evento"
          />

          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Tipo</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as CalendarEventType })}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 mb-3"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
            ))}
          </select>

          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 mb-3 resize-none"
            placeholder="Opcional"
          />

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Data Início</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Data Fim</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              />
            </div>
          </div>

          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            Período (Bimestre)
          </label>
          <select
            value={form.period_number}
            onChange={(e) => setForm({ ...form, period_number: e.target.value })}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 mb-3"
          >
            <option value="">Nenhum</option>
            <option value="1">1o Bimestre</option>
            <option value="2">2o Bimestre</option>
            <option value="3">3o Bimestre</option>
            <option value="4">4o Bimestre</option>
          </select>
        </DrawerCard>

        <DrawerCard title="Segmentos" icon={Calendar}>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            Deixe vazio para aplicar a todos os segmentos.
          </p>
          <div className="flex flex-wrap gap-2">
            {segments.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleSegmentId(s.id)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  form.segment_ids.includes(s.id)
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-primary/50'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </DrawerCard>
      </Drawer>
    </div>
  );
}

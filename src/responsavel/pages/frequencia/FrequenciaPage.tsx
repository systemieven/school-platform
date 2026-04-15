import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import { Loader2, CalendarClock, Filter } from 'lucide-react';

interface AttendanceRow {
  id: string;
  status: 'present' | 'absent' | 'justified' | 'late';
  diary_entry: {
    id: string;
    entry_date: string;
    type: string;
    subject?: { id: string; name: string } | null;
  } | null;
}

interface Subject {
  id: string;
  name: string;
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  present:   { label: 'Presente',   color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  absent:    { label: 'Falta',      color: 'text-red-700 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/20' },
  justified: { label: 'Justificada',color: 'text-yellow-700 dark:text-yellow-400',   bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  late:      { label: 'Atrasado',   color: 'text-orange-700 dark:text-orange-400',   bg: 'bg-orange-50 dark:bg-orange-900/20' },
};

export default function FrequenciaPage() {
  const { currentStudentId } = useGuardian();
  const [rows, setRows]           = useState<AttendanceRow[]>([]);
  const [subjects, setSubjects]   = useState<Subject[]>([]);
  const [loading, setLoading]     = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [monthFilter, setMonthFilter]     = useState('all');

  useEffect(() => {
    if (!currentStudentId) { setLoading(false); return; }

    supabase
      .from('diary_attendance')
      .select(`
        id,
        status,
        diary_entry:class_diary_entries(
          id, entry_date, type,
          subject:school_subjects(id, name)
        )
      `)
      .eq('student_id', currentStudentId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as unknown as AttendanceRow[];
        setRows(list);

        // Extract unique subjects
        const subjectMap = new Map<string, Subject>();
        for (const r of list) {
          const sub = r.diary_entry?.subject as { id: string; name: string } | null;
          if (sub && !subjectMap.has(sub.id)) {
            subjectMap.set(sub.id, sub);
          }
        }
        setSubjects(Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
      });
  }, [currentStudentId]);

  // Extract unique months from rows
  const months = Array.from(new Set(
    rows
      .map((r) => r.diary_entry?.entry_date?.slice(0, 7))
      .filter(Boolean) as string[]
  )).sort().reverse();

  const filtered = rows.filter((r) => {
    if (subjectFilter !== 'all') {
      const sub = r.diary_entry?.subject as { id: string } | null;
      if (sub?.id !== subjectFilter) return false;
    }
    if (monthFilter !== 'all') {
      if (!r.diary_entry?.entry_date?.startsWith(monthFilter)) return false;
    }
    return true;
  });

  const total    = filtered.length;
  const present  = filtered.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absent   = filtered.filter((r) => r.status === 'absent').length;
  const justified = filtered.filter((r) => r.status === 'justified').length;
  const pct      = total > 0 ? Math.round((present / total) * 100) : null;

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <CalendarClock className="w-5 h-5" /> Frequência
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Acompanhe a frequência escolar.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{total}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total de aulas</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{present}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Presenças</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-2xl font-bold text-red-500">{absent + justified}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Faltas ({justified} justif.)</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
          <p className={`text-2xl font-bold ${pct != null && pct < 75 ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>
            {pct != null ? `${pct}%` : '—'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Frequência</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-1.5 outline-none focus:border-brand-primary dark:focus:border-brand-secondary"
        >
          <option value="all">Todas as disciplinas</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-1.5 outline-none focus:border-brand-primary dark:focus:border-brand-secondary"
        >
          <option value="all">Todos os meses</option>
          {months.map((m) => (
            <option key={m} value={m} className="capitalize">{fmtMonth(m)}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum registro encontrado.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {filtered.map((r) => {
              const st = STATUS_STYLES[r.status] ?? STATUS_STYLES.absent;
              const sub = r.diary_entry?.subject as { name: string } | null;
              return (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {r.diary_entry?.entry_date ? fmtDate(r.diary_entry.entry_date) : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {sub?.name ?? 'Disciplina não informada'} · {r.diary_entry?.type ?? ''}
                    </p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.color} ${st.bg}`}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

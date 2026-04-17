import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfessor } from '../../contexts/ProfessorAuthContext';
import { supabase } from '../../../lib/supabase';
import {
  ClipboardList, Plus, Check, Calendar, ChevronLeft,
} from 'lucide-react';
import type { ClassDiaryEntry, DiaryEntryType } from '../../../admin/types/admin.types';
import { DIARY_ENTRY_TYPE_LABELS as TYPE_LABELS } from '../../../admin/types/admin.types';

const ENTRY_TYPE_COLORS: Record<DiaryEntryType, string> = {
  aula:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  reposicao:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  avaliacao:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  evento:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  excursao:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  outro:      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

type MonthOption = { label: string; value: string };

function getMonthOptions(): MonthOption[] {
  const months: MonthOption[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    });
  }
  return months;
}

interface EntryWithMeta extends ClassDiaryEntry {
  hasAttendance: boolean;
  disciplineName: string | null;
}

export default function DiarioPage() {
  const { classId } = useParams<{ classId: string }>();
  const { professor, teacherClasses } = useProfessor();
  const navigate = useNavigate();

  const cls = teacherClasses.find((c) => c.id === classId);
  const monthOptions = getMonthOptions();

  const [entries, setEntries]       = useState<EntryWithMeta[]>([]);
  const [loading, setLoading]       = useState(true);
  const [monthFilter, setMonthFilter] = useState(monthOptions[0].value);
  const [discFilter, setDiscFilter] = useState('');

  async function loadEntries() {
    if (!classId || !professor) return;
    setLoading(true);

    const [year, month] = monthFilter.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate   = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    let query = supabase
      .from('class_diary_entries')
      .select('*, diary_attendance(id), discipline:disciplines(id,name)')
      .eq('class_id', classId)
      .eq('teacher_id', professor.id)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date', { ascending: false });

    if (discFilter) {
      query = query.eq('discipline_id', discFilter);
    }

    const { data } = await query;

    if (data) {
      const mapped: EntryWithMeta[] = data.map((e) => {
        const joinedDisc = e.discipline as { id: string; name: string } | null;
        // Fallback for legacy rows where discipline_id is null: match by subject_id
        const ctxDisc = !joinedDisc && e.subject_id
          ? cls?.disciplines.find((d) => d.subject_id === e.subject_id)
          : undefined;
        return {
          ...e,
          hasAttendance: Array.isArray(e.diary_attendance) && e.diary_attendance.length > 0,
          disciplineName: joinedDisc?.name ?? ctxDisc?.discipline_name ?? null,
        };
      });
      setEntries(mapped);
    }
    setLoading(false);
  }

  useEffect(() => { loadEntries(); }, [classId, professor, monthFilter, discFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/professor/turmas')}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Diário — {cls?.name ?? '…'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {entries.length} entrada{entries.length !== 1 ? 's' : ''} neste período
          </p>
        </div>
      </div>

      {/* Filters + New button */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:border-brand-primary transition-colors"
        >
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        {(cls?.disciplines.length ?? 0) > 0 && (
          <select
            value={discFilter}
            onChange={(e) => setDiscFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:border-brand-primary transition-colors"
          >
            <option value="">Todas as disciplinas</option>
            {cls!.disciplines.map((d) => (
              <option key={d.discipline_id} value={d.discipline_id}>{d.discipline_name}</option>
            ))}
          </select>
        )}

        <button
          onClick={() => navigate(`/professor/turmas/${classId}/diario/novo`)}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova entrada
        </button>
      </div>

      {/* Entries list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 animate-pulse">
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Nenhuma entrada neste período</p>
          <p className="text-xs text-gray-400 mt-1">Clique em "Nova entrada" para registrar uma aula.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 hover:border-brand-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTRY_TYPE_COLORS[entry.type]}`}>
                      {TYPE_LABELS[entry.type]}
                    </span>
                    {entry.disciplineName && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.disciplineName}
                      </span>
                    )}
                    {entry.is_locked && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                        Travada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date(entry.entry_date + 'T12:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                    </span>
                  </div>
                  {entry.content && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {entry.content}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {entry.hasAttendance ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" /> Presença registrada
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Sem presença
                    </span>
                  )}
                  <button
                    onClick={() => navigate(`/professor/turmas/${classId}/diario/${entry.id}`)}
                    className="text-xs text-brand-primary hover:underline"
                  >
                    Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

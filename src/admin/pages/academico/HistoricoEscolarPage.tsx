import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { StudentTranscript, StudentResult, StudentResultStatus } from '../../types/admin.types';
import { RESULT_STATUS_LABELS, RESULT_STATUS_COLORS } from '../../types/admin.types';
import {
  ScrollText, Loader2, Search, ChevronDown, ChevronRight, FileDown, RefreshCw, User,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface StudentOption {
  id: string;
  full_name: string;
  enrollment_number: string;
}

interface TranscriptWithDetails extends StudentTranscript {
  results: StudentResult[];
  expanded: boolean;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HistoricoEscolarPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<StudentOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ── Search students ─────────────────────────────────────────────────────────
  const searchStudents = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const { data, error } = await supabase
      .from('students')
      .select('id, full_name, enrollment_number')
      .or(`full_name.ilike.%${term}%,enrollment_number.ilike.%${term}%`)
      .limit(10)
      .order('full_name');

    if (error) {
      console.error('Erro na busca');
    } else {
      setSuggestions(data ?? []);
    }
    setSearching(false);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchStudents(searchTerm);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchStudents]);

  // ── Fetch transcripts ──────────────────────────────────────────────────────
  const fetchTranscripts = useCallback(async (studentId: string) => {
    setLoading(true);
    const { data: transcriptData, error: tErr } = await supabase
      .from('student_transcripts')
      .select('*, segment:school_segments(id, name), class:school_classes(id, name)')
      .eq('student_id', studentId)
      .order('school_year', { ascending: false });

    if (tErr) {
      console.error('Erro ao carregar histórico');
      setLoading(false);
      return;
    }

    const { data: resultsData, error: rErr } = await supabase
      .from('student_results')
      .select('*, discipline:disciplines(id, name, code)')
      .eq('student_id', studentId);

    if (rErr) {
      console.error('Erro ao carregar resultados');
    }

    const allResults: StudentResult[] = resultsData ?? [];

    const built: TranscriptWithDetails[] = (transcriptData ?? []).map((t: any) => ({
      ...t,
      results: allResults.filter(
        (r) => r.class_id === t.class_id && r.school_year === t.school_year,
      ),
      expanded: false,
    }));

    setTranscripts(built);
    setLoading(false);
  }, []);

  // ── Select student ──────────────────────────────────────────────────────────
  function selectStudent(student: StudentOption) {
    setSelectedStudent(student);
    setSearchTerm(student.full_name);
    setShowSuggestions(false);
    fetchTranscripts(student.id);
  }

  // ── Toggle expand ──────────────────────────────────────────────────────────
  function toggleExpand(idx: number) {
    setTranscripts((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, expanded: !t.expanded } : t)),
    );
  }

  // ── Generate transcript ────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!selectedStudent) return;
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke('calculate-grades', {
        body: { student_id: selectedStudent.id },
      });
      if (error) throw error;
      console.log('Histórico gerado/atualizado');
      fetchTranscripts(selectedStudent.id);
    } catch {
      console.error('Erro ao gerar histórico');
    }
    setGenerating(false);
  }

  // ── Result color helper ────────────────────────────────────────────────────
  function resultBadge(result: StudentResultStatus) {
    return (
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${RESULT_STATUS_COLORS[result]}`}>
        {RESULT_STATUS_LABELS[result]}
      </span>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (selectedStudent && e.target.value !== selectedStudent.full_name) {
                setSelectedStudent(null);
                setTranscripts([]);
              }
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder="Buscar aluno por nome ou matrícula..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
          )}
        </div>

        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStudent(s)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-full bg-brand-primary/10 dark:bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-brand-primary dark:text-brand-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                    {s.full_name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Mat: {s.enrollment_number}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!selectedStudent && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
          <ScrollText className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">Busque um aluno para visualizar o histórico escolar</p>
        </div>
      )}

      {/* Student selected */}
      {selectedStudent && (
        <>
          {/* Actions */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {selectedStudent.full_name}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Matrícula: {selectedStudent.enrollment_number}
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Gerar Histórico
            </button>
            <button
              onClick={() => console.log('Em breve')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Exportar PDF
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}

          {/* Transcripts */}
          {!loading && transcripts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <ScrollText className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum histórico encontrado para este aluno</p>
            </div>
          )}

          {!loading && transcripts.length > 0 && (
            <div className="space-y-2">
              {transcripts.map((t, idx) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800"
                >
                  {/* Year row */}
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors text-left"
                  >
                    {t.expanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200 w-12">
                      {t.school_year}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate">
                      {t.class?.name ?? '—'} &middot; {t.segment?.name ?? '—'}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      t.final_result === 'approved'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : t.final_result === 'failed_grade' || t.final_result === 'failed_attendance'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}>
                      {RESULT_STATUS_LABELS[t.final_result as StudentResultStatus] ?? t.final_result}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {t.expanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      {t.results.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-gray-400 dark:text-gray-500 text-center">
                          Nenhum resultado detalhado disponível
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800/50">
                              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Disciplina
                              </th>
                              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                1o Bi
                              </th>
                              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                2o Bi
                              </th>
                              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                3o Bi
                              </th>
                              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                4o Bi
                              </th>
                              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Final
                              </th>
                              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Freq.
                              </th>
                              <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.results.map((r) => (
                              <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                <td className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-700">
                                  {r.discipline?.name ?? r.discipline_id}
                                </td>
                                {([r.period1_avg, r.period2_avg, r.period3_avg, r.period4_avg, r.final_avg] as (number | null)[]).map(
                                  (val, vi) => (
                                    <td
                                      key={vi}
                                      className={`px-3 py-2 text-center text-sm font-semibold border-t border-gray-100 dark:border-gray-700 ${
                                        val === null
                                          ? 'text-gray-300 dark:text-gray-600'
                                          : val >= 7
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-red-600 dark:text-red-400'
                                      }`}
                                    >
                                      {val !== null ? val.toFixed(1) : '—'}
                                    </td>
                                  ),
                                )}
                                <td className="px-3 py-2 text-center text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700">
                                  {r.attendance_pct !== null ? `${r.attendance_pct}%` : '—'}
                                </td>
                                <td className="px-3 py-2 text-center border-t border-gray-100 dark:border-gray-700">
                                  {resultBadge(r.result)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

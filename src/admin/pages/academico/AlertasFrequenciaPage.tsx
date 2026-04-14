import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

import {
  Bell, Loader2, Users, AlertTriangle, ShieldAlert, MessageCircle, Filter,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRow {
  student_id: string;
  student_name: string;
  class_id: string;
  class_name: string;
  discipline_id: string;
  discipline_name: string;
  total: number;
  present: number;
  pct: number;
  status: 'ok' | 'warning' | 'critical';
}

interface ClassOption {
  id: string;
  name: string;
  segment_id: string;
  segment_name: string;
}

// ── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLD_OK = 85;
const THRESHOLD_WARNING = 75;

function attendanceStatus(pct: number): 'ok' | 'warning' | 'critical' {
  if (pct >= THRESHOLD_OK) return 'ok';
  if (pct >= THRESHOLD_WARNING) return 'warning';
  return 'critical';
}

const STATUS_CONFIG = {
  ok: {
    label: 'OK',
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  warning: {
    label: 'Em risco',
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  critical: {
    label: 'Crítico',
    color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AlertasFrequenciaPage() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [filterSegment, setFilterSegment] = useState('');

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch classes & segments
    const [classesRes, segRes] = await Promise.all([
      supabase
        .from('school_classes')
        .select('id, name, segment_id, segment:school_segments(name)')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('school_segments')
        .select('id, name')
        .eq('is_active', true)
        .order('position'),
    ]);

    const classesData: ClassOption[] = (classesRes.data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      segment_id: c.segment_id,
      segment_name: c.segment?.name ?? '',
    }));
    setClasses(classesData);
    setSegments(segRes.data ?? []);

    // Fetch attendance records
    const { data: attendance, error } = await supabase
      .from('student_attendance')
      .select(`
        student_id,
        discipline_id,
        status,
        student:students(id, full_name, class_id),
        discipline:disciplines(id, name)
      `);

    if (error) {
      console.error('Erro ao carregar dados de frequência:', error);
      setLoading(false);
      return;
    }

    // Group by student+discipline
    const grouped = new Map<string, { studentId: string; studentName: string; classId: string; disciplineId: string; disciplineName: string; total: number; present: number }>();

    for (const rec of attendance ?? []) {
      const student = rec.student as any;
      const discipline = rec.discipline as any;
      if (!student || !discipline) continue;

      const key = `${student.id}__${discipline.id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          studentId: student.id,
          studentName: student.full_name ?? '',
          classId: student.class_id ?? '',
          disciplineId: discipline.id,
          disciplineName: discipline.name ?? '',
          total: 0,
          present: 0,
        });
      }
      const g = grouped.get(key)!;
      g.total += 1;
      if (rec.status === 'present' || rec.status === 'late') {
        g.present += 1;
      }
    }

    // Build rows
    const builtRows: AttendanceRow[] = [];
    for (const g of Array.from(grouped.values())) {
      const pct = g.total > 0 ? Math.round((g.present / g.total) * 100) : 100;
      const cls = classesData.find((c) => c.id === g.classId);
      builtRows.push({
        student_id: g.studentId,
        student_name: g.studentName,
        class_id: g.classId,
        class_name: cls?.name ?? '',
        discipline_id: g.disciplineId,
        discipline_name: g.disciplineName,
        total: g.total,
        present: g.present,
        pct,
        status: attendanceStatus(pct),
      });
    }

    // Sort worst first
    builtRows.sort((a, b) => a.pct - b.pct);
    setRows(builtRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filtered = rows.filter((r) => {
    if (filterClass && r.class_id !== filterClass) return false;
    if (filterSegment) {
      const cls = classes.find((c) => c.id === r.class_id);
      if (cls?.segment_id !== filterSegment) return false;
    }
    return true;
  });

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const uniqueStudents = new Set(filtered.map((r) => r.student_id));
  const warningStudents = new Set(
    filtered.filter((r) => r.status === 'warning').map((r) => r.student_id),
  );
  const criticalStudents = new Set(
    filtered.filter((r) => r.status === 'critical').map((r) => r.student_id),
  );

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
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Monitorados', value: uniqueStudents.size, icon: Users, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800/50' },
          { label: 'Em risco (< 80%)', value: warningStudents.size, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Crítico (< 75%)', value: criticalStudents.size, icon: ShieldAlert, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={`rounded-2xl border border-gray-100 dark:border-gray-700 p-4 ${kpi.bg}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
        >
          <option value="">Todas as turmas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.segment_name})
            </option>
          ))}
        </select>

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
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <Bell className="w-10 h-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhum registro de frequência encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {['Aluno', 'Turma', 'Disciplina', 'Frequência', 'Status', ''].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const cfg = STATUS_CONFIG[r.status];
                return (
                  <tr
                    key={`${r.student_id}-${r.discipline_id}-${i}`}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                  >
                    <td className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                      {r.student_name}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                      {r.class_name}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                      {r.discipline_name}
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              r.status === 'ok'
                                ? 'bg-emerald-500'
                                : r.status === 'warning'
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(r.pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-10 text-right">
                          {r.pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                      {r.status !== 'ok' && (
                        <button
                          onClick={() => console.log('Alerta WhatsApp enviado')}
                          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Enviar Alerta
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Student, SchoolClass, SchoolSegment, StudentStatus } from '../../types/admin.types';
import { STUDENT_STATUS_LABELS, SHIFT_LABELS, type Shift } from '../../types/admin.types';
import {
  Users, Search, Loader2, X, GraduationCap,
  Phone, Mail, Calendar, ChevronDown,
} from 'lucide-react';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [segments, setSegments] = useState<SchoolSegment[]>([]);
  const [classes, setClasses]   = useState<SchoolClass[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterSeg, setFilterSeg] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: studs }, { data: segs }, { data: cls }] = await Promise.all([
      supabase.from('students').select('*').order('full_name'),
      supabase.from('school_segments').select('*').order('position'),
      supabase.from('school_classes').select('*').order('name'),
    ]);
    setStudents((studs ?? []) as Student[]);
    setSegments((segs ?? []) as SchoolSegment[]);
    setClasses((cls ?? []) as SchoolClass[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const classById = useMemo(() => {
    const m = new Map<string, SchoolClass>();
    classes.forEach((c) => m.set(c.id, c));
    return m;
  }, [classes]);

  const segById = useMemo(() => {
    const m = new Map<string, SchoolSegment>();
    segments.forEach((s) => m.set(s.id, s));
    return m;
  }, [segments]);

  // Available classes for selected segment filter
  const filteredClasses = useMemo(() => {
    if (!filterSeg) return classes;
    return classes.filter((c) => c.segment_id === filterSeg);
  }, [classes, filterSeg]);

  const visibleStudents = useMemo(() => {
    let list = students;
    if (filterStatus) list = list.filter((s) => s.status === filterStatus);
    if (filterClass) list = list.filter((s) => s.class_id === filterClass);
    else if (filterSeg) {
      const segClassIds = new Set(classes.filter((c) => c.segment_id === filterSeg).map((c) => c.id));
      list = list.filter((s) => s.class_id && segClassIds.has(s.class_id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.enrollment_number.toLowerCase().includes(q) ||
        s.guardian_name.toLowerCase().includes(q) ||
        (s.cpf && s.cpf.includes(q)),
      );
    }
    return list;
  }, [students, search, filterSeg, filterClass, filterStatus, classes]);

  function getClassName(classId: string | null) {
    if (!classId) return 'Sem turma';
    const cls = classById.get(classId);
    return cls ? cls.name : '—';
  }

  function getSegmentName(classId: string | null) {
    if (!classId) return '';
    const cls = classById.get(classId);
    if (!cls) return '';
    const seg = segById.get(cls.segment_id);
    return seg ? seg.name : '';
  }

  const statusColors: Record<StudentStatus, string> = {
    active: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    transferred: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    graduated: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    inactive: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8" />
            Alunos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Alunos com matrícula confirmada.</p>
        </div>
        <p className="text-sm text-gray-400">
          {students.filter((s) => s.status === 'active').length} ativo{students.filter((s) => s.status === 'active').length !== 1 ? 's' : ''}
          {' / '}{students.length} total
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Busca</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text" placeholder="Nome, matrícula, CPF..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Segment */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Segmento</label>
            <select
              value={filterSeg}
              onChange={(e) => { setFilterSeg(e.target.value); setFilterClass(''); }}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              <option value="">Todos</option>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Turma</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              <option value="">Todas</option>
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
            >
              <option value="">Todos</option>
              {Object.entries(STUDENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Student list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-[#003876] animate-spin" />
        </div>
      ) : visibleStudents.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {students.length === 0
              ? 'Nenhum aluno registrado. Confirme pré-matrículas para gerar registros.'
              : 'Nenhum aluno encontrado para os filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleStudents.map((s) => {
            const isExpanded = expandedId === s.id;
            const cls = s.class_id ? classById.get(s.class_id) : null;
            return (
              <div key={s.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  {/* Avatar placeholder */}
                  <div className="w-10 h-10 rounded-full bg-[#003876]/10 dark:bg-[#003876]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#003876] dark:text-[#ffd700]">
                      {s.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{s.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {s.enrollment_number} · {getClassName(s.class_id)}
                      {getSegmentName(s.class_id) && ` · ${getSegmentName(s.class_id)}`}
                    </p>
                  </div>

                  {cls && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0 hidden sm:inline">
                      {SHIFT_LABELS[cls.shift as Shift] ?? cls.shift}
                    </span>
                  )}

                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[s.status]}`}>
                    {STUDENT_STATUS_LABELS[s.status]}
                  </span>

                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <InfoItem icon={GraduationCap} label="Matrícula" value={s.enrollment_number} />
                    <InfoItem icon={Users} label="Responsável" value={s.guardian_name} />
                    <InfoItem icon={Phone} label="Telefone" value={s.guardian_phone} />
                    {s.guardian_email && <InfoItem icon={Mail} label="E-mail" value={s.guardian_email} />}
                    {s.birth_date && <InfoItem icon={Calendar} label="Nascimento" value={new Date(s.birth_date).toLocaleDateString('pt-BR')} />}
                    {s.cpf && <InfoItem icon={Users} label="CPF" value={s.cpf} />}
                    <InfoItem icon={Calendar} label="Matriculado em" value={new Date(s.enrolled_at).toLocaleDateString('pt-BR')} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[10px] text-gray-400">{label}</p>
        <p className="text-xs text-gray-700 dark:text-gray-300">{value}</p>
      </div>
    </div>
  );
}

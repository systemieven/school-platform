import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { usePermissions } from '../../contexts/PermissionsContext';
import type { Student, SchoolClass, SchoolSegment, StudentStatus } from '../../types/admin.types';
import { STUDENT_STATUS_LABELS, SHIFT_LABELS, type Shift } from '../../types/admin.types';
import CreateStudentDrawer from './CreateStudentDrawer';
import {
  Users, Search, Loader2, X, GraduationCap, UserPlus, Upload,
  Phone, Mail, Calendar, ChevronDown, Edit3, Save, AlertCircle, FileText,
} from 'lucide-react';

// ── Student Edit Drawer ───────────────────────────────────────────────────────

function StudentDrawer({ student, classes, onClose, onSaved }: {
  student: Student;
  classes: SchoolClass[];
  onClose: () => void;
  onSaved: (updated: Student) => void;
}) {
  const [form, setForm] = useState({
    full_name:      student.full_name,
    birth_date:     student.birth_date || '',
    cpf:            student.cpf || '',
    guardian_name:  student.guardian_name,
    guardian_phone: student.guardian_phone,
    guardian_email: student.guardian_email || '',
    class_id:       student.class_id || '',
    status:         student.status as StudentStatus,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  async function handleSave() {
    if (!form.full_name.trim() || !form.guardian_name.trim() || !form.guardian_phone.trim()) {
      setError('Nome do aluno, responsável e telefone são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    const patch = {
      full_name:      form.full_name.trim(),
      birth_date:     form.birth_date || null,
      cpf:            form.cpf.trim() || null,
      guardian_name:  form.guardian_name.trim(),
      guardian_phone: form.guardian_phone.trim(),
      guardian_email: form.guardian_email.trim() || null,
      class_id:       form.class_id || null,
      status:         form.status,
      updated_at:     new Date().toISOString(),
    };
    const { data, error: dbErr } = await supabase.from('students').update(patch).eq('id', student.id).select().single();
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    logAudit({ action: 'update', module: 'students', recordId: student.id, description: `Aluno "${patch.full_name}" atualizado`, oldData: { full_name: student.full_name, status: student.status }, newData: patch });
    onSaved(data as Student);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h3 className="font-display font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
            Editar Aluno
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Enrollment number (read-only) */}
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <p className="text-xs text-gray-400">Matrícula</p>
          <p className="text-sm font-mono font-semibold text-gray-700 dark:text-gray-200">{student.enrollment_number}</p>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {[
            { label: 'Nome completo *', key: 'full_name', type: 'text' },
            { label: 'Data de nascimento', key: 'birth_date', type: 'date' },
            { label: 'CPF', key: 'cpf', type: 'text', placeholder: '000.000.000-00' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
              <input
                type={type}
                value={(form as Record<string, string>)[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>
          ))}

          <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Responsável</p>
            {[
              { label: 'Nome do responsável *', key: 'guardian_name', type: 'text' },
              { label: 'Telefone *', key: 'guardian_phone', type: 'tel' },
              { label: 'E-mail', key: 'guardian_email', type: 'email' },
            ].map(({ label, key, type }) => (
              <div key={key} className="mb-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                <input
                  type={type}
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Turma</label>
              <select
                value={form.class_id}
                onChange={(e) => set('class_id', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary"
              >
                <option value="">Sem turma</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary"
              >
                {Object.entries(STUDENT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-primary text-white py-2.5 rounded-xl text-sm font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [students, setStudents] = useState<Student[]>([]);
  const [segments, setSegments] = useState<SchoolSegment[]>([]);
  const [classes, setClasses]   = useState<SchoolClass[]>([]);
  const [profileById, setProfileById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterSeg, setFilterSeg] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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

    // Resolve coordinator_ids and teacher_ids to names
    const allIds = [
      ...new Set([
        ...((segs ?? []) as SchoolSegment[]).flatMap((s) => s.coordinator_ids ?? []),
        ...((cls  ?? []) as SchoolClass[]).flatMap((c) => c.teacher_ids ?? []),
      ]),
    ];
    if (allIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allIds);
      const map = new Map<string, string>();
      (profs ?? []).forEach((p: { id: string; full_name: string }) => map.set(p.id, p.full_name));
      setProfileById(map);
    }

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
          <h1 className="font-display text-3xl font-bold text-brand-primary dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8" />
            Alunos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Alunos com matrícula confirmada.</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-400 mr-2">
            {students.filter((s) => s.status === 'active').length} ativo{students.filter((s) => s.status === 'active').length !== 1 ? 's' : ''}
            {' / '}{students.length} total
          </p>
          {can('students', 'import') && (
            <button
              onClick={() => navigate('/admin/alunos/importar')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Upload className="w-4 h-4" /> Importar
            </button>
          )}
          {can('students', 'create') && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium rounded-xl transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Novo Aluno
            </button>
          )}
        </div>
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
          <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
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
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-brand-primary/10 dark:bg-brand-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {s.photo_url ? (
                      <img src={s.photo_url} alt={s.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-brand-primary dark:text-brand-secondary">
                        {s.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    )}
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

                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/alunos/${s.id}`); }}
                    className="p-1.5 text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                    title="Ver ficha do aluno"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditStudent(s); }}
                    className="p-1.5 text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                    title="Editar aluno"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (() => {
                  const clsObj = s.class_id ? classById.get(s.class_id) : null;
                  const segObj = clsObj ? segById.get(clsObj.segment_id) : null;
                  const coordinators = (segObj?.coordinator_ids ?? [])
                    .map((id) => profileById.get(id))
                    .filter(Boolean)
                    .join(', ');
                  const teachers = (clsObj?.teacher_ids ?? [])
                    .map((id) => profileById.get(id))
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <InfoItem icon={GraduationCap} label="Matrícula" value={s.enrollment_number} />
                      <InfoItem icon={Users} label="Responsável" value={s.guardian_name} />
                      <InfoItem icon={Phone} label="Telefone" value={s.guardian_phone} />
                      {s.guardian_email && <InfoItem icon={Mail} label="E-mail" value={s.guardian_email} />}
                      {s.birth_date && <InfoItem icon={Calendar} label="Nascimento" value={new Date(s.birth_date).toLocaleDateString('pt-BR')} />}
                      {s.cpf && <InfoItem icon={Users} label="CPF" value={s.cpf} />}
                      <InfoItem icon={Calendar} label="Matriculado em" value={new Date(s.enrolled_at).toLocaleDateString('pt-BR')} />
                      {coordinators && <InfoItem icon={Users} label="Coordenadores" value={coordinators} />}
                      {teachers && <InfoItem icon={GraduationCap} label="Professores" value={teachers} />}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Create drawer */}
      {showCreate && (
        <CreateStudentDrawer
          onClose={() => setShowCreate(false)}
          onCreated={(newStudent) => {
            setStudents((prev) => [newStudent, ...prev]);
            setShowCreate(false);
          }}
        />
      )}

      {/* Edit drawer */}
      {editStudent && (
        <StudentDrawer
          student={editStudent}
          classes={classes}
          onClose={() => setEditStudent(null)}
          onSaved={(updated) => {
            setStudents((prev) => prev.map((s) => s.id === updated.id ? { ...s, ...updated } : s));
            setEditStudent(null);
          }}
        />
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

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { logAudit } from '../../../../lib/audit';
import type { Grade, Activity, SchoolClass } from '../../../types/admin.types';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { Loader2, Star, Plus, Trash2, X, Save, ChevronDown } from 'lucide-react';
import { SearchableSelect } from '../../../components/FormField';

const PERIODS = ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'];

// Inline editable score cell
function GradeCell({ value, onSave }: { value: number | null; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value ?? ''));

  function commit() {
    const n = parseFloat(val);
    if (!isNaN(n)) onSave(n);
    setEditing(false);
  }

  if (editing) return (
    <input autoFocus type="number" min="0" max="10" step="0.1" value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()}
      className="w-14 px-1.5 py-1 text-xs text-center rounded border border-brand-primary dark:border-brand-secondary bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 outline-none" />
  );

  return (
    <button onClick={() => setEditing(true)}
      className="w-14 px-1.5 py-1 text-xs text-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300">
      {value != null ? value.toFixed(1) : <span className="text-gray-300 dark:text-gray-600">—</span>}
    </button>
  );
}

// Manual grade drawer (activity_id = null)
function ManualGradeDrawer({ classId, students, subject, period, onClose, onSaved }: {
  classId: string; students: { id: string; full_name: string }[];
  subject: string; period: string;
  onClose: () => void; onSaved: (g: Grade) => void;
}) {
  const { profile } = useAdminAuth();
  const [form, setForm] = useState({ student_id: '', score: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.student_id || !form.score) { setError('Selecione o aluno e informe a nota.'); return; }
    setSaving(true); setError('');
    const { data, error: err } = await supabase.from('grades').insert({
      class_id: classId, created_by: profile!.id, student_id: form.student_id,
      subject, period, activity_id: null,
      score: parseFloat(form.score), max_score: 10,
      notes: form.notes || null, updated_at: new Date().toISOString(),
    }).select('*, student:students(full_name, enrollment_number)').single();
    if (err) { setError(err.message); setSaving(false); return; }
    logAudit({ action: 'create', module: 'teacher-area', recordId: (data as Grade).id, description: `Nota manual registrada: ${form.score}`, newData: { student_id: form.student_id, score: form.score, subject } });
    onSaved(data as Grade);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">Nota Manual</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
          <SearchableSelect
            label="Aluno *"
            value={form.student_id}
            onChange={(val) => setForm((p) => ({ ...p, student_id: val }))}
            options={students.map((s) => ({ value: s.id, label: s.full_name }))}
            placeholder="Selecione o aluno..."
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nota *</label>
            <input type="number" min="0" max="10" step="0.1" value={form.score}
              onChange={(e) => setForm((p) => ({ ...p, score: e.target.value }))} placeholder="0.0 a 10.0"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Observações</label>
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary resize-none" />
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GradesTab({ cls }: { cls: SchoolClass }) {
  const { profile } = useAdminAuth();
  const [students, setStudents] = useState<{ id: string; full_name: string; enrollment_number: string }[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [subject, setSubject] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [showManual, setShowManual] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [stuRes, actRes, graRes] = await Promise.all([
      supabase.from('students').select('id, full_name, enrollment_number').eq('class_id', cls.id).eq('status', 'active').order('full_name'),
      supabase.from('activities').select('*').eq('class_id', cls.id).eq('status', 'published').order('due_date'),
      supabase.from('grades').select('*, student:students(full_name, enrollment_number), activity:activities(title)').eq('class_id', cls.id).eq('period', period),
    ]);
    const stus = (stuRes.data ?? []) as typeof students;
    const acts = (actRes.data ?? []) as Activity[];
    const grs  = (graRes.data ?? []) as Grade[];

    // Collect unique subjects from activities + grades
    const subjectSet = new Set<string>([
      ...acts.filter((a) => a.subject).map((a) => a.subject!),
      ...grs.filter((g) => g.subject).map((g) => g.subject),
    ]);
    const subList = Array.from(subjectSet).sort();
    setSubjects(subList);
    if (!subject && subList.length) setSubject(subList[0]);

    setStudents(stus); setActivities(acts); setGrades(grs);
    setLoading(false);
  }, [cls.id, period, subject]);

  useEffect(() => { load(); }, [cls.id, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredActivities = activities.filter((a) => !subject || a.subject === subject);

  function gradeFor(studentId: string, activityId: string | null) {
    return grades.find((g) => g.student_id === studentId && g.activity_id === activityId && g.subject === subject) ?? null;
  }

  async function upsertGrade(studentId: string, activityId: string | null, score: number) {
    const existing = gradeFor(studentId, activityId);
    if (existing) {
      const { data } = await supabase.from('grades').update({ score, updated_at: new Date().toISOString() }).eq('id', existing.id).select('*').single();
      if (data) setGrades((p) => p.map((g) => g.id === existing.id ? { ...g, score } : g));
    } else {
      const { data } = await supabase.from('grades').insert({
        class_id: cls.id, created_by: profile!.id, student_id: studentId,
        subject: subject || 'Geral', period, activity_id: activityId,
        score, max_score: activityId ? (activities.find((a) => a.id === activityId)?.max_score ?? 10) : 10,
        updated_at: new Date().toISOString(),
      }).select('*').single();
      if (data) setGrades((p) => [...p, data as Grade]);
    }
  }

  async function deleteGrade(id: string) {
    await supabase.from('grades').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'teacher-area', recordId: id, description: 'Nota excluída' });
    setGrades((p) => p.filter((g) => g.id !== id));
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" /></div>;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary">
            {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {subjects.length > 0 && (
          <div className="relative">
            <select value={subject} onChange={(e) => setSubject(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary">
              <option value="">Todas as disciplinas</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}
        <button onClick={() => setShowManual(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Nota Manual
        </button>
      </div>

      {/* Grid */}
      {!students.length ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum aluno ativo nesta turma.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide min-w-[160px]">Aluno</th>
                {filteredActivities.map((a) => (
                  <th key={a.id} className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-center min-w-[80px]" title={a.title}>
                    <span className="truncate block max-w-[72px] mx-auto">{a.title}</span>
                  </th>
                ))}
                <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-center min-w-[80px]">Média</th>
                <th className="px-3 py-3 min-w-[40px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {students.map((s) => {
                const rowGrades = filteredActivities.map((a) => gradeFor(s.id, a.id));
                const scores = rowGrades.filter((g) => g != null).map((g) => g!.score);
                const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
                const manualGrades = grades.filter((g) => g.student_id === s.id && g.activity_id === null && (!subject || g.subject === subject));

                return (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{s.full_name}</td>
                    {filteredActivities.map((a, i) => (
                      <td key={a.id} className="px-3 py-2.5 text-center">
                        <GradeCell value={rowGrades[i]?.score ?? null} onSave={(v) => upsertGrade(s.id, a.id, v)} />
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs font-semibold ${avg != null ? (avg >= 6 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') : 'text-gray-300 dark:text-gray-600'}`}>
                        {avg != null ? avg.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {manualGrades.map((g) => (
                        <div key={g.id} className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{g.score.toFixed(1)}{g.notes ? ` · ${g.notes}` : ''}</span>
                          <button onClick={() => deleteGrade(g.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showManual && (
        <ManualGradeDrawer
          classId={cls.id} students={students} subject={subject || 'Geral'} period={period}
          onClose={() => setShowManual(false)}
          onSaved={(g) => { setGrades((p) => [...p, g]); setShowManual(false); }}
        />
      )}
    </div>
  );
}

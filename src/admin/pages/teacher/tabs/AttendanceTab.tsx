import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { logAudit } from '../../../../lib/audit';
import type { Attendance, AttendanceStatus, SchoolClass } from '../../../types/admin.types';
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from '../../../types/admin.types';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { SelectField } from '../../../components/FormField';
import { Loader2, Save, CalendarCheck, CheckCircle2 } from 'lucide-react';

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'justified', 'late'];

type DraftRow = { studentId: string; fullName: string; status: AttendanceStatus };

export default function AttendanceTab({ cls }: { cls: SchoolClass }) {
  const { profile } = useAdminAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [disciplines, setDisciplines] = useState<{ id: string; name: string }[]>([]);
  const [disciplineId, setDisciplineId] = useState('');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [_existing, setExisting] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase
      .from('class_disciplines')
      .select('discipline_id, discipline:disciplines(id, name)')
      .eq('class_id', cls.id)
      .then(({ data }) => {
        if (!data) return;
        const list = (data as { discipline_id: string; discipline: { id: string; name: string } | null }[])
          .filter((row) => row.discipline !== null)
          .map((row) => ({ id: row.discipline!.id, name: row.discipline!.name }));
        setDisciplines(list);
      });
  }, [cls.id]);

  const load = useCallback(async () => {
    setLoading(true); setSaved(false);
    const [stuRes, attRes] = await Promise.all([
      supabase.from('students').select('id, full_name').eq('class_id', cls.id).eq('status', 'active').order('full_name'),
      supabase.from('student_attendance').select('*').eq('class_id', cls.id).eq('date', date),
    ]);

    const stus = (stuRes.data ?? []) as { id: string; full_name: string }[];
    const att  = (attRes.data ?? []) as Attendance[];
    setExisting(att);

    setRows(stus.map((s) => ({
      studentId: s.id,
      fullName:  s.full_name,
      status:    (att.find((a) => a.student_id === s.id)?.status as AttendanceStatus) ?? 'present',
    })));
    setLoading(false);
  }, [cls.id, date]);

  useEffect(() => { load(); }, [load]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRows((p) => p.map((r) => r.studentId === studentId ? { ...r, status } : r));
    setSaved(false);
  }

  function markAll(status: AttendanceStatus) {
    setRows((p) => p.map((r) => ({ ...r, status })));
    setSaved(false);
  }

  async function saveChamada() {
    setSaving(true);
    const upserts = rows.map((r) => ({
      student_id: r.studentId, class_id: cls.id, created_by: profile!.id,
      date, status: r.status, discipline_id: disciplineId || null, updated_at: new Date().toISOString(),
    }));
    await supabase.from('student_attendance').upsert(upserts, { onConflict: 'student_id,class_id,date' });
    logAudit({ action: 'update', module: 'teacher-area', description: `Chamada registrada para ${date} com ${upserts.length} aluno(s)`, newData: { date, total: upserts.length } });
    setSaving(false); setSaved(true);
  }

  const presentCount = rows.filter((r) => r.status === 'present' || r.status === 'late').length;

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" /></div>;

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-brand-primary dark:focus:border-brand-secondary" />

        {disciplines.length > 0 && (
          <SelectField label="Disciplina" value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} className="min-w-[180px]">
            <option value="">Todas / Geral</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </SelectField>
        )}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <span className="text-xs text-gray-500 dark:text-gray-400">{presentCount}/{rows.length} presentes</span>
          <button onClick={() => markAll('present')}
            className="px-3 py-1.5 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors font-medium">
            Todos presentes
          </button>
          <button onClick={() => markAll('absent')}
            className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-medium">
            Todos ausentes
          </button>
        </div>
      </div>

      {/* Student rows */}
      {!rows.length ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum aluno ativo nesta turma.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700/50 shadow-sm">
          {rows.map((r) => (
            <div key={r.studentId} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-brand-primary/10 dark:bg-brand-secondary/10 flex items-center justify-center text-xs font-bold text-brand-primary dark:text-brand-secondary flex-shrink-0">
                  {r.fullName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.fullName}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => setStatus(r.studentId, s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      r.status === s
                        ? ATTENDANCE_STATUS_COLORS[s]
                        : 'bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}>
                    {ATTENDANCE_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save button */}
      {rows.length > 0 && (
        <div className="flex justify-end">
          <button onClick={saveChamada} disabled={saving || saved}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-colors ${
              saved
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 cursor-default'
                : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
            }`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : saved ? 'Chamada salva' : 'Salvar chamada'}
          </button>
        </div>
      )}
    </div>
  );
}

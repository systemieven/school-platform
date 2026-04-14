import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { logAudit } from '../../../../lib/audit';
import type { Activity, ActivityType, ActivityStatus, SchoolClass } from '../../../types/admin.types';
import { ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_LABELS } from '../../../types/admin.types';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { Loader2, Pencil, Trash2, ClipboardList, X, Save, Calendar } from 'lucide-react';

const TYPES: ActivityType[]   = ['homework', 'test', 'project', 'quiz', 'other'];
const STATUSES: ActivityStatus[] = ['draft', 'published', 'closed'];

const STATUS_COLORS: Record<ActivityStatus, string> = {
  draft:     'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  published: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  closed:    'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

interface ClassDiscipline {
  id: string;
  discipline_id: string;
  discipline: { name: string } | null;
}

const emptyForm = () => ({ title: '', subject: '', description: '', type: 'homework' as ActivityType, status: 'draft' as ActivityStatus, due_date: '', max_score: '10', discipline_id: '' });

function ActivityDrawer({
  activity, classId, onClose, onSaved,
}: {
  activity: Activity | null;
  classId: string;
  onClose: () => void;
  onSaved: (a: Activity) => void;
}) {
  const { profile } = useAdminAuth();
  const [classDisciplines, setClassDisciplines] = useState<ClassDiscipline[]>([]);
  const [form, setForm] = useState(activity ? {
    title: activity.title, subject: activity.subject ?? '', description: activity.description ?? '',
    type: activity.type, status: activity.status,
    due_date: activity.due_date ?? '', max_score: String(activity.max_score ?? 10),
    discipline_id: (activity as Activity & { discipline_id?: string }).discipline_id ?? '',
  } : emptyForm());

  useEffect(() => {
    supabase.from('class_disciplines')
      .select('id, discipline_id, discipline:disciplines(name)')
      .eq('class_id', classId)
      .then(({ data }) => { setClassDisciplines((data ?? []) as unknown as ClassDiscipline[]); });
  }, [classId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.title.trim()) { setError('Título é obrigatório.'); return; }
    setSaving(true); setError('');
    const payload = {
      class_id: classId, created_by: profile!.id,
      title: form.title.trim(), subject: form.subject || null,
      description: form.description || null, type: form.type, status: form.status,
      due_date: form.due_date || null, max_score: parseFloat(form.max_score) || 10,
      discipline_id: form.discipline_id || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error: err } = activity
      ? await supabase.from('activities').update(payload).eq('id', activity.id).select('*').single()
      : await supabase.from('activities').insert(payload).select('*').single();
    if (err) { setError(err.message); setSaving(false); return; }
    logAudit({ action: activity ? 'update' : 'create', module: 'teacher-area', recordId: (data as Activity).id, description: `Atividade "${form.title}" ${activity ? 'atualizada' : 'criada'}`, newData: payload });
    onSaved(data as Activity);
  }

  const cls = `w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none`;

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{activity ? 'Editar Atividade' : 'Nova Atividade'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Título *</label>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Ex: Prova de Matemática" className={cls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ActivityType }))} className={cls}>
                {TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ActivityStatus }))} className={cls}>
                {STATUSES.map((s) => <option key={s} value={s}>{ACTIVITY_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          {classDisciplines.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Disciplina</label>
              <select value={form.discipline_id} onChange={(e) => {
                const disc = classDisciplines.find((cd) => cd.discipline_id === e.target.value);
                setForm((p) => ({ ...p, discipline_id: e.target.value, subject: disc?.discipline?.name ?? p.subject }));
              }} className={cls}>
                <option value="">Selecione</option>
                {classDisciplines.map((cd) => (
                  <option key={cd.discipline_id} value={cd.discipline_id}>{cd.discipline?.name ?? cd.discipline_id}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{classDisciplines.length > 0 ? 'Assunto (opcional)' : 'Disciplina'}</label>
              <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Ex: Matemática" className={cls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nota máxima</label>
              <input type="number" min="0" max="100" step="0.5" value={form.max_score}
                onChange={(e) => setForm((p) => ({ ...p, max_score: e.target.value }))} className={cls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Data de entrega</label>
            <input type="date" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} className={cls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Descrição</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none resize-none" />
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActivitiesTab({ cls }: { cls: SchoolClass }) {
  const { profile, hasRole } = useAdminAuth();
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Activity | null | undefined>(undefined);
  const [showDrawer, setShowDrawer] = useState(false);

  const load = useCallback(() => {
    supabase.from('activities').select('*, creator:profiles(full_name)')
      .eq('class_id', cls.id).order('created_at', { ascending: false })
      .then(({ data }) => { setItems((data ?? []) as Activity[]); setLoading(false); });
  }, [cls.id]);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    await supabase.from('activities').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'teacher-area', recordId: id, description: 'Atividade excluída' });
    setItems((p) => p.filter((a) => a.id !== id));
  }

  const canEdit = (a: Activity) => a.created_by === profile?.id || hasRole('super_admin', 'admin', 'coordinator');

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setShowDrawer(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium rounded-xl transition-colors">
          <ClipboardList className="w-4 h-4" /> Nova Atividade
        </button>
      </div>

      {!items.length ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma atividade cadastrada.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((a) => (
            <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{a.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status]}`}>
                      {ACTIVITY_STATUS_LABELS[a.status]}
                    </span>
                    <span className="px-2 py-0.5 bg-brand-primary/10 dark:bg-brand-secondary/10 text-brand-primary dark:text-brand-secondary rounded-full text-xs">
                      {ACTIVITY_TYPE_LABELS[a.type]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {a.subject && <span className="text-xs text-gray-500 dark:text-gray-400">{a.subject}</span>}
                    {a.due_date && (
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3 h-3" /> {fmtDate(a.due_date)}
                      </span>
                    )}
                    {a.max_score != null && <span className="text-xs text-gray-400">Nota max: {a.max_score}</span>}
                  </div>
                  {a.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{a.description}</p>}
                </div>
                {canEdit(a) && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => { setEditing(a); setShowDrawer(true); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(a.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showDrawer && (
        <ActivityDrawer
          activity={editing ?? null}
          classId={cls.id}
          onClose={() => setShowDrawer(false)}
          onSaved={(a) => {
            setItems((p) => editing ? p.map((x) => x.id === a.id ? a : x) : [a, ...p]);
            setShowDrawer(false);
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { logAudit } from '../../../../lib/audit';
import type { ClassMaterial, SchoolClass } from '../../../types/admin.types';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { Loader2, Pencil, Trash2, ExternalLink, FileText, X, Save, EyeOff } from 'lucide-react';

const emptyForm = () => ({ title: '', subject: '', description: '', external_url: '', is_visible: true });

function MaterialDrawer({
  material, classId, onClose, onSaved,
}: {
  material: ClassMaterial | null;
  classId: string;
  onClose: () => void;
  onSaved: (m: ClassMaterial) => void;
}) {
  const { profile } = useAdminAuth();
  const [form, setForm] = useState(material ? {
    title: material.title, subject: material.subject ?? '', description: material.description ?? '',
    external_url: material.external_url ?? '', is_visible: material.is_visible,
  } : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!form.title.trim()) { setError('Título é obrigatório.'); return; }
    setSaving(true); setError('');
    const payload = {
      class_id: classId, created_by: profile!.id,
      title: form.title.trim(), subject: form.subject || null,
      description: form.description || null, external_url: form.external_url || null,
      is_visible: form.is_visible, updated_at: new Date().toISOString(),
    };
    const { data, error: err } = material
      ? await supabase.from('class_materials').update(payload).eq('id', material.id).select('*').single()
      : await supabase.from('class_materials').insert(payload).select('*').single();
    if (err) { setError(err.message); setSaving(false); return; }
    logAudit({ action: material ? 'update' : 'create', module: 'teacher-area', recordId: (data as ClassMaterial).id, description: `Material "${form.title}" ${material ? 'atualizado' : 'criado'}`, newData: payload });
    onSaved(data as ClassMaterial);
  }

  const f = (k: string) => (form as Record<string, unknown>)[k] as string;
  const sf = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">{material ? 'Editar Material' : 'Novo Material'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
          {[
            { label: 'Título *', key: 'title', placeholder: 'Ex: Introdução à álgebra' },
            { label: 'Disciplina', key: 'subject', placeholder: 'Ex: Matemática' },
            { label: 'Link externo', key: 'external_url', placeholder: 'https://...' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
              <input value={f(key)} onChange={(e) => sf(key, e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Descrição</label>
            <textarea value={form.description} onChange={(e) => sf('description', e.target.value)} rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none resize-none" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button type="button" onClick={() => setForm((p) => ({ ...p, is_visible: !p.is_visible }))}
              className={`w-10 h-6 rounded-full transition-colors ${form.is_visible ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`block w-4 h-4 bg-white rounded-full shadow mx-1 transition-transform ${form.is_visible ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">Visível para alunos</span>
          </label>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">
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

export default function MaterialsTab({ cls }: { cls: SchoolClass }) {
  const { profile, hasRole } = useAdminAuth();
  const [items, setItems] = useState<ClassMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<ClassMaterial | null | 'new'>(undefined as unknown as null);
  const [showDrawer, setShowDrawer] = useState(false);

  const load = useCallback(() => {
    supabase.from('class_materials').select('*, creator:profiles(full_name)')
      .eq('class_id', cls.id).order('created_at', { ascending: false })
      .then(({ data }) => { setItems((data ?? []) as ClassMaterial[]); setLoading(false); });
  }, [cls.id]);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    await supabase.from('class_materials').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'teacher-area', recordId: id, description: 'Material excluído' });
    setItems((p) => p.filter((m) => m.id !== id));
  }

  const canEdit = (m: ClassMaterial) => m.created_by === profile?.id || hasRole('super_admin', 'admin', 'coordinator');

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-primary dark:text-brand-secondary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setDrawer(null); setShowDrawer(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white text-sm font-medium rounded-xl transition-colors">
          <FileText className="w-4 h-4" /> Novo Material
        </button>
      </div>

      {!items.length ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum material cadastrado.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((m) => (
            <div key={m.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-start justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-brand-primary/10 dark:bg-brand-secondary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{m.title}</p>
                    {m.subject && <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">{m.subject}</span>}
                    {!m.is_visible && <span className="flex items-center gap-1 text-xs text-gray-400"><EyeOff className="w-3 h-3" /> Oculto</span>}
                  </div>
                  {m.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{m.description}</p>}
                  {m.external_url && (
                    <a href={m.external_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-primary dark:text-brand-secondary hover:underline mt-1">
                      <ExternalLink className="w-3 h-3" /> Abrir link
                    </a>
                  )}
                </div>
              </div>
              {canEdit(m) && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setDrawer(m); setShowDrawer(true); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-brand-primary dark:hover:text-brand-secondary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(m.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showDrawer && (
        <MaterialDrawer
          material={drawer as ClassMaterial | null}
          classId={cls.id}
          onClose={() => setShowDrawer(false)}
          onSaved={(m) => {
            setItems((p) => drawer ? p.map((x) => x.id === m.id ? m : x) : [m, ...p]);
            setShowDrawer(false);
          }}
        />
      )}
    </div>
  );
}

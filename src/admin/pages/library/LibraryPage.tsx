import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { LibraryResource, ResourceType } from '../../types/admin.types';
import { RESOURCE_TYPE_LABELS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  Loader2, Plus, Pencil, Trash2, Library, X, Save,
  BookMarked, FileText, Video, Link2, File, ExternalLink, EyeOff, Search,
} from 'lucide-react';

const TYPES: ResourceType[] = ['book', 'article', 'video', 'link', 'document'];

const TYPE_ICON: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  book:     BookMarked,
  article:  FileText,
  video:    Video,
  link:     Link2,
  document: File,
};

const TYPE_COLOR: Record<ResourceType, string> = {
  book:     'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  article:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  video:    'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  link:     'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  document: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
};

const emptyForm = () => ({
  title: '', description: '', resource_type: 'link' as ResourceType,
  subject: '', external_url: '', is_visible: true,
});

// ── Drawer ────────────────────────────────────────────────────────────────────

function ResourceDrawer({
  resource, onClose, onSaved,
}: {
  resource: LibraryResource | null;
  onClose: () => void;
  onSaved: (r: LibraryResource) => void;
}) {
  const { profile } = useAdminAuth();
  const [form, setForm] = useState(resource ? {
    title:         resource.title,
    description:   resource.description ?? '',
    resource_type: resource.resource_type,
    subject:       resource.subject ?? '',
    external_url:  resource.external_url ?? '',
    is_visible:    resource.is_visible,
  } : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  async function save() {
    if (!form.title.trim()) { setError('Título é obrigatório.'); return; }
    setSaving(true); setError('');
    const payload = {
      created_by:    profile!.id,
      title:         form.title.trim(),
      description:   form.description || null,
      resource_type: form.resource_type,
      subject:       form.subject || null,
      external_url:  form.external_url || null,
      is_visible:    form.is_visible,
      updated_at:    new Date().toISOString(),
    };
    const { data, error: err } = resource
      ? await supabase.from('library_resources').update(payload).eq('id', resource.id).select('*').single()
      : await supabase.from('library_resources').insert(payload).select('*').single();
    if (err) { setError(err.message); setSaving(false); return; }
    onSaved(data as LibraryResource);
  }

  const cls = `w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] outline-none`;

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-[#003876] dark:bg-gray-800">
          <h2 className="font-semibold text-white">{resource ? 'Editar Recurso' : 'Novo Recurso'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => {
                const Icon = TYPE_ICON[t];
                return (
                  <button key={t} type="button"
                    onClick={() => setForm((p) => ({ ...p, resource_type: t }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.resource_type === t
                        ? 'border-[#003876] bg-[#003876] text-white dark:border-[#ffd700] dark:bg-[#ffd700] dark:text-gray-900'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                    }`}>
                    <Icon className="w-3.5 h-3.5" /> {RESOURCE_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Título *</label>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Ex: Introdução à Álgebra" className={cls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Disciplina</label>
              <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                placeholder="Ex: Matemática" className={cls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">URL / Link</label>
            <input value={form.external_url} onChange={(e) => setForm((p) => ({ ...p, external_url: e.target.value }))}
              placeholder="https://..." className={cls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Descrição</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3} placeholder="Breve descrição do recurso..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] outline-none resize-none" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button type="button" onClick={() => setForm((p) => ({ ...p, is_visible: !p.is_visible }))}
              className={`w-10 h-6 rounded-full transition-colors ${form.is_visible ? 'bg-[#003876]' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`block w-4 h-4 bg-white rounded-full shadow mx-1 transition-transform ${form.is_visible ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">Visível para alunos</span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#003876] hover:bg-[#002855] text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { profile, hasRole } = useAdminAuth();
  const [items,      setItems]      = useState<LibraryResource[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState<LibraryResource | null | undefined>(undefined);
  const [showDrawer, setShowDrawer] = useState(false);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState<ResourceType | 'all'>('all');

  const load = useCallback(() => {
    supabase.from('library_resources')
      .select('*, creator:profiles(full_name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setItems((data ?? []) as LibraryResource[]); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    await supabase.from('library_resources').delete().eq('id', id);
    setItems((p) => p.filter((r) => r.id !== id));
  }

  const canEdit = (r: LibraryResource) =>
    r.created_by === profile?.id || hasRole('super_admin', 'admin', 'coordinator');

  const filtered = items.filter((r) => {
    const matchType    = typeFilter === 'all' || r.resource_type === typeFilter;
    const matchSearch  = !search || r.title.toLowerCase().includes(search.toLowerCase()) ||
                         (r.subject ?? '').toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            <Library className="w-7 h-7 text-[#003876] dark:text-[#ffd700]" />
            Biblioteca Virtual
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Materiais e recursos de estudo para professores e alunos.
          </p>
        </div>
        {hasRole('super_admin', 'admin', 'coordinator', 'teacher') && (
          <button onClick={() => { setEditing(null); setShowDrawer(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#003876] hover:bg-[#002855] text-white text-sm font-medium rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Novo Recurso
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título ou disciplina..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] dark:focus:border-[#ffd700]" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === 'all' ? 'bg-[#003876] text-white dark:bg-[#ffd700] dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
            Todos
          </button>
          {TYPES.map((t) => {
            const Icon = TYPE_ICON[t];
            return (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-[#003876] text-white dark:bg-[#ffd700] dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}>
                <Icon className="w-3 h-3" /> {RESOURCE_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#003876] dark:text-[#ffd700]" />
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Library className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{items.length ? 'Nenhum recurso encontrado para os filtros aplicados.' : 'Nenhum recurso cadastrado.'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const Icon = TYPE_ICON[r.resource_type];
            return (
              <div key={r.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[r.resource_type]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLOR[r.resource_type]}`}>
                          {RESOURCE_TYPE_LABELS[r.resource_type]}
                        </span>
                        {r.subject && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{r.subject}</span>
                        )}
                        {!r.is_visible && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-400"><EyeOff className="w-3 h-3" /> Oculto</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {canEdit(r) && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditing(r); setShowDrawer(true); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(r.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {r.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{r.description}</p>
                )}

                {r.external_url && (
                  <a href={r.external_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#003876] dark:text-[#ffd700] hover:underline font-medium mt-auto">
                    <ExternalLink className="w-3 h-3" /> Abrir recurso
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showDrawer && (
        <ResourceDrawer
          resource={editing ?? null}
          onClose={() => setShowDrawer(false)}
          onSaved={(r) => {
            setItems((p) => editing ? p.map((x) => x.id === r.id ? r : x) : [r, ...p]);
            setShowDrawer(false);
          }}
        />
      )}
    </div>
  );
}

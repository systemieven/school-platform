import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  LibraryResource, ResourceType, ResourceSubtype, LibraryTargetType,
  SchoolSegment, SchoolClass,
} from '../../types/admin.types';
import {
  RESOURCE_TYPE_LABELS, RESOURCE_TYPE_ICONS, LIBRARY_TARGET_LABELS,
} from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  Loader2, Plus, Pencil, Trash2, Library, X, Save,
  BookMarked, FileText, Video, Link2, File, ExternalLink, EyeOff, Search,
  Upload, Youtube, Globe, Users, BookOpen, User, Play,
} from 'lucide-react';
import { SettingsCard } from '../../components/SettingsCard';
import { Toggle } from '../../components/Toggle';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPES: ResourceType[] = ['book', 'article', 'video', 'link', 'document'];

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  book: BookMarked, article: FileText, video: Video, link: Link2, document: File,
};

const TYPE_COLOR: Record<string, string> = {
  book:     'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  article:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  video:    'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  link:     'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  document: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
};

// Which subtypes are available per resource_type
const SUBTYPES: Record<ResourceType, { value: ResourceSubtype; label: string; icon: React.ComponentType<{ className?: string }> }[]> = {
  video:    [{ value: 'youtube', label: 'YouTube', icon: Youtube }, { value: 'video_upload', label: 'Upload', icon: Upload }],
  document: [{ value: 'link', label: 'Link externo', icon: Globe }, { value: 'pdf', label: 'PDF (upload)', icon: Upload }],
  image:    [] as never[], // handled as document subtype; won't appear as ResourceType
  book:     [{ value: 'link', label: 'Link externo', icon: Globe }],
  article:  [{ value: 'link', label: 'Link externo', icon: Globe }],
  link:     [{ value: 'link', label: 'URL', icon: Globe }],
};

const UPLOAD_ACCEPTS: Partial<Record<ResourceSubtype, string>> = {
  pdf:          'application/pdf',
  image:        'image/jpeg,image/png,image/webp',
  video_upload: 'video/mp4,video/quicktime,video/webm',
};

const STORAGE_BUCKET = 'library-resources';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : null;
}

function defaultSubtype(type: ResourceType): ResourceSubtype {
  if (type === 'video') return 'youtube';
  if (type === 'document') return 'pdf';
  return 'link';
}

function needsUpload(sub: ResourceSubtype) {
  return sub === 'pdf' || sub === 'image' || sub === 'video_upload';
}

// ── Drawer ────────────────────────────────────────────────────────────────────

interface DrawerProps {
  resource: LibraryResource | null;
  segments: SchoolSegment[];
  classes:  SchoolClass[];
  students: { id: string; full_name: string; enrollment_number: string }[];
  onClose:  () => void;
  onSaved:  (r: LibraryResource) => void;
}

type FormState = {
  title: string; description: string; resource_type: ResourceType;
  resource_subtype: ResourceSubtype; subject: string;
  external_url: string; is_visible: boolean;
  target_type: LibraryTargetType; target_ids: string[];
};

const emptyForm = (): FormState => ({
  title: '', description: '', resource_type: 'link', resource_subtype: 'link',
  subject: '', external_url: '', is_visible: true, target_type: 'all', target_ids: [],
});

function ResourceDrawer({ resource, segments, classes, students, onClose, onSaved }: DrawerProps) {
  const { profile } = useAdminAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(resource ? {
    title:            resource.title,
    description:      resource.description ?? '',
    resource_type:    resource.resource_type,
    resource_subtype: resource.resource_subtype ?? defaultSubtype(resource.resource_type),
    subject:          resource.subject ?? '',
    external_url:     resource.external_url ?? '',
    is_visible:       resource.is_visible,
    target_type:      (resource.target_type as LibraryTargetType) ?? 'all',
    target_ids:       [
      ...(resource.segment_ids ?? []),
      ...(resource.class_ids ?? []),
      ...(resource.student_ids ?? []),
    ],
  } : emptyForm());

  const [file,        setFile]       = useState<File | null>(null);
  const [uploading,   setUploading]  = useState(false);
  const [uploadPct,   setUploadPct]  = useState(0);
  const [saving,      setSaving]     = useState(false);
  const [error,       setError]      = useState('');
  const [dragOver,    setDragOver]   = useState(false);

  // Reset subtype when resource_type changes
  function setType(t: ResourceType) {
    setForm((p) => ({ ...p, resource_type: t, resource_subtype: defaultSubtype(t), target_ids: p.target_ids }));
    setFile(null);
  }

  function toggleTargetId(id: string) {
    setForm((p) => ({
      ...p,
      target_ids: p.target_ids.includes(id)
        ? p.target_ids.filter((x) => x !== id)
        : [...p.target_ids, id],
    }));
  }

  async function uploadFile(resourceId: string): Promise<string | null> {
    if (!file) return null;
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `${form.resource_subtype}/${resourceId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true });
    setUploading(false);
    if (upErr) { setError(`Upload falhou: ${upErr.message}`); return null; }
    setUploadPct(100);
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function save() {
    if (!form.title.trim()) { setError('Título é obrigatório.'); return; }
    if (needsUpload(form.resource_subtype) && !file && !resource?.file_url) {
      setError('Selecione um arquivo para upload.'); return;
    }
    setSaving(true); setError('');

    // Build target arrays from target_ids
    const segIds  = form.target_type === 'segment' ? form.target_ids : [];
    const clsIds  = form.target_type === 'class'   ? form.target_ids : [];
    const stuIds  = form.target_type === 'student' ? form.target_ids : [];

    // Base payload without file_url
    const payload: Record<string, unknown> = {
      created_by:       profile!.id,
      title:            form.title.trim(),
      description:      form.description || null,
      resource_type:    form.resource_type,
      resource_subtype: form.resource_subtype,
      subject:          form.subject || null,
      external_url:     needsUpload(form.resource_subtype) ? null : (form.external_url || null),
      is_visible:       form.is_visible,
      target_type:      form.target_type,
      segment_ids:      segIds,
      class_ids:        clsIds,
      student_ids:      stuIds,
      updated_at:       new Date().toISOString(),
    };

    // Insert/update record first to get the ID
    const { data, error: err } = resource
      ? await supabase.from('library_resources').update(payload).eq('id', resource.id).select('*').single()
      : await supabase.from('library_resources').insert(payload).select('*').single();

    if (err || !data) { setError(err?.message ?? 'Erro ao salvar.'); setSaving(false); return; }

    const saved = data as LibraryResource;

    // Upload file if provided
    if (file && needsUpload(form.resource_subtype)) {
      const fileUrl = await uploadFile(saved.id);
      if (!fileUrl) { setSaving(false); return; }
      await supabase.from('library_resources')
        .update({ file_url: fileUrl })
        .eq('id', saved.id);
      saved.file_url = fileUrl;
    }

    onSaved(saved);
  }

  const inp = `w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] outline-none`;
  const youtubeId = form.resource_subtype === 'youtube' && form.external_url
    ? getYouTubeId(form.external_url) : null;

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-[#003876] dark:bg-gray-800">
          <h2 className="font-semibold text-white flex items-center gap-2"><BookOpen className="w-4 h-4" />{resource ? 'Editar Recurso' : 'Novo Recurso'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

          {/* ── Recurso ── */}
          <SettingsCard title="Recurso" icon={File}>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Tipo de recurso</label>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => {
                  const Icon = TYPE_ICON[t];
                  return (
                    <button key={t} type="button" onClick={() => setType(t)}
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

            {SUBTYPES[form.resource_type]?.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Formato</label>
                <div className="flex gap-2">
                  {SUBTYPES[form.resource_type].map(({ value, label, icon: Icon }) => (
                    <button key={value} type="button"
                      onClick={() => { setForm((p) => ({ ...p, resource_subtype: value })); setFile(null); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.resource_subtype === value
                          ? 'border-[#003876] bg-[#003876]/10 text-[#003876] dark:border-[#ffd700] dark:bg-[#ffd700]/10 dark:text-[#ffd700]'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                      }`}>
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!needsUpload(form.resource_subtype) && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  {form.resource_subtype === 'youtube' ? 'URL do YouTube' : 'URL / Link'}
                </label>
                <input value={form.external_url}
                  onChange={(e) => setForm((p) => ({ ...p, external_url: e.target.value }))}
                  placeholder={form.resource_subtype === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'}
                  className={inp} />
                {youtubeId && (
                  <div className="mt-2 relative rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                    <iframe className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${youtubeId}`}
                      allowFullScreen title="preview" />
                  </div>
                )}
              </div>
            )}

            {needsUpload(form.resource_subtype) && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Arquivo ({form.resource_subtype === 'pdf' ? 'PDF' : form.resource_subtype === 'image' ? 'Imagem' : 'Vídeo'})
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f) setFile(f);
                  }}
                  onClick={() => fileRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-[#003876] bg-[#003876]/5 dark:border-[#ffd700] dark:bg-[#ffd700]/5'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}>
                  <Upload className="w-6 h-6 text-gray-400" />
                  <div className="text-center">
                    {file ? (
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</p>
                    ) : resource?.file_url ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Arquivo já enviado — clique para substituir</p>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Arraste o arquivo ou clique para selecionar</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {form.resource_subtype === 'pdf' ? 'PDF até 100 MB'
                        : form.resource_subtype === 'image' ? 'JPG, PNG, WebP até 20 MB'
                        : 'MP4, MOV, WebM até 500 MB'}
                    </p>
                  </div>
                  <input ref={fileRef} type="file" className="hidden"
                    accept={UPLOAD_ACCEPTS[form.resource_subtype]}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                </div>
                {uploading && (
                  <div className="mt-2 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="bg-[#003876] dark:bg-[#ffd700] h-1.5 rounded-full transition-all"
                      style={{ width: `${uploadPct}%` }} />
                  </div>
                )}
                {!file && resource?.file_url && form.resource_subtype === 'pdf' && (
                  <a href={resource.file_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs text-[#003876] dark:text-[#ffd700] hover:underline">
                    <ExternalLink className="w-3 h-3" /> Ver arquivo atual
                  </a>
                )}
              </div>
            )}
          </SettingsCard>

          {/* ── Informações ── */}
          <SettingsCard title="Informações" icon={FileText}>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Título *</label>
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Introdução à Álgebra" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Disciplina</label>
              <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                placeholder="Ex: Matemática" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Descrição</label>
              <textarea value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2} placeholder="Breve descrição..."
                className={`${inp} resize-none`} />
            </div>
          </SettingsCard>

          {/* ── Público-alvo ── */}
          <SettingsCard title="Público-alvo" icon={Users}>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'all',     label: 'Todos',             icon: Globe   },
                { value: 'segment', label: 'Segmento',          icon: BookOpen},
                { value: 'class',   label: 'Turma',             icon: Users   },
                { value: 'student', label: 'Aluno específico',  icon: User    },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button key={value} type="button"
                  onClick={() => setForm((p) => ({ ...p, target_type: value, target_ids: [] }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.target_type === value
                      ? 'border-[#003876] bg-[#003876] text-white dark:border-[#ffd700] dark:bg-[#ffd700] dark:text-gray-900'
                      : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {form.target_type === 'segment' && (
              <div className="flex flex-wrap gap-2">
                {segments.map((s) => (
                  <button key={s.id} type="button" onClick={() => toggleTargetId(s.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      form.target_ids.includes(s.id)
                        ? 'border-[#003876] bg-[#003876]/10 text-[#003876] dark:border-[#ffd700] dark:bg-[#ffd700]/10 dark:text-[#ffd700]'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                    }`}>{s.name}</button>
                ))}
              </div>
            )}

            {form.target_type === 'class' && (
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {classes.map((c) => (
                  <button key={c.id} type="button" onClick={() => toggleTargetId(c.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      form.target_ids.includes(c.id)
                        ? 'border-[#003876] bg-[#003876]/10 text-[#003876] dark:border-[#ffd700] dark:bg-[#ffd700]/10 dark:text-[#ffd700]'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                    }`}>{c.name} {c.year}</button>
                ))}
              </div>
            )}

            {form.target_type === 'student' && (
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                {students.map((s) => (
                  <button key={s.id} type="button" onClick={() => toggleTargetId(s.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      form.target_ids.includes(s.id)
                        ? 'border-[#003876] bg-[#003876]/10 text-[#003876] dark:border-[#ffd700] dark:bg-[#ffd700]/10 dark:text-[#ffd700]'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                    }`}>{s.full_name}</button>
                ))}
              </div>
            )}
          </SettingsCard>

          {/* ── Visibilidade ── */}
          <SettingsCard title="Visibilidade" icon={EyeOff}>
            <Toggle
              checked={form.is_visible}
              onChange={(v) => setForm((p) => ({ ...p, is_visible: v }))}
              label="Visível para alunos"
            />
          </SettingsCard>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={save} disabled={saving || uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#003876] hover:bg-[#002855] text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
            {(saving || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {uploading ? 'Enviando arquivo...' : saving ? 'Salvando...' : 'Salvar'}
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
  const [segments,   setSegments]   = useState<SchoolSegment[]>([]);
  const [classes,    setClasses]    = useState<SchoolClass[]>([]);
  const [students,   setStudents]   = useState<{ id: string; full_name: string; enrollment_number: string }[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState<LibraryResource | null | undefined>(undefined);
  const [showDrawer, setShowDrawer] = useState(false);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState<ResourceType | 'all'>('all');

  const load = useCallback(() => {
    Promise.all([
      supabase.from('library_resources').select('*, creator:profiles(full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('school_segments').select('id, name, slug, position, is_active, coordinator_ids')
        .eq('is_active', true).order('position'),
      supabase.from('school_classes').select('id, name, year, segment_id, shift, max_students, teacher_ids, is_active')
        .eq('is_active', true).order('name'),
      supabase.from('students').select('id, full_name, enrollment_number')
        .eq('status', 'active').order('full_name'),
    ]).then(([res, seg, cls, stu]) => {
      setItems((res.data ?? []) as LibraryResource[]);
      setSegments((seg.data ?? []) as SchoolSegment[]);
      setClasses((cls.data ?? []) as SchoolClass[]);
      setStudents((stu.data ?? []) as { id: string; full_name: string; enrollment_number: string }[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(r: LibraryResource) {
    // Delete file from storage if present
    if (r.file_url) {
      const path = r.file_url.split(`/${STORAGE_BUCKET}/`)[1];
      if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    }
    await supabase.from('library_resources').delete().eq('id', r.id);
    setItems((p) => p.filter((x) => x.id !== r.id));
  }

  const canEdit = (r: LibraryResource) =>
    r.created_by === profile?.id || hasRole('super_admin', 'admin', 'coordinator');

  const filtered = items.filter((r) => {
    const matchType   = typeFilter === 'all' || r.resource_type === typeFilter;
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) ||
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
            const Icon = TYPE_ICON[r.resource_type] ?? Link2;
            const ytId = r.resource_subtype === 'youtube' && r.external_url
              ? getYouTubeId(r.external_url) : null;
            const targetLabel = LIBRARY_TARGET_LABELS[r.target_type as LibraryTargetType] ?? 'Todos';
            return (
              <div key={r.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm flex flex-col gap-3">

                {/* YouTube thumbnail */}
                {ytId && (
                  <a href={r.external_url!} target="_blank" rel="noopener noreferrer"
                    className="relative block rounded-lg overflow-hidden group">
                    <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt={r.title}
                      className="w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                      <Play className="w-10 h-10 text-white drop-shadow" fill="white" />
                    </div>
                  </a>
                )}

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
                        {r.subject && <span className="text-xs text-gray-500 dark:text-gray-400">{r.subject}</span>}
                        <span className="text-xs text-gray-400">{targetLabel}</span>
                        {!r.is_visible && (
                          <span className="flex items-center gap-0.5 text-xs text-gray-400">
                            <EyeOff className="w-3 h-3" /> Oculto
                          </span>
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
                      <button onClick={() => remove(r)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {r.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{r.description}</p>
                )}

                {/* Link / file action */}
                {(r.external_url || r.file_url) && !ytId && (
                  <a href={r.file_url ?? r.external_url!} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-[#003876] dark:text-[#ffd700] hover:underline font-medium mt-auto">
                    <ExternalLink className="w-3 h-3" />
                    {r.resource_subtype === 'pdf' ? 'Abrir PDF'
                      : r.resource_subtype === 'image' ? 'Ver imagem'
                      : r.resource_subtype === 'video_upload' ? 'Reproduzir vídeo'
                      : 'Abrir recurso'}
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
          segments={segments}
          classes={classes}
          students={students}
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

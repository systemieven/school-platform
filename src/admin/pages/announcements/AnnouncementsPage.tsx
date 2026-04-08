import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type {
  Announcement, AnnouncementTarget, SchoolClass, SchoolSegment,
} from '../../types/admin.types';
import { ANNOUNCEMENT_TARGET_LABELS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { sendWhatsAppText } from '../../lib/whatsapp-api';
import {
  Loader2, Plus, Pencil, Trash2, Megaphone, X, Save,
  Users, Globe, BookOpen, Send, Eye, CheckCircle2, Calendar,
} from 'lucide-react';

const TARGETS: AnnouncementTarget[] = ['all', 'segment', 'class', 'role'];

const TARGET_ICON: Record<AnnouncementTarget, React.ComponentType<{ className?: string }>> = {
  all:     Globe,
  segment: BookOpen,
  class:   Users,
  role:    Users,
};

// ── Drawer ────────────────────────────────────────────────────────────────────

interface DrawerProps {
  announcement: Announcement | null;
  segments: SchoolSegment[];
  classes: SchoolClass[];
  onClose: () => void;
  onSaved: (a: Announcement) => void;
}

const emptyForm = () => ({
  title: '', body: '',
  target_type: 'all' as AnnouncementTarget,
  target_ids: [] as string[],
  target_roles: [] as string[],
  send_whatsapp: false,
  publish_at: new Date().toISOString().slice(0, 16),
  is_published: false,
});

function AnnouncementDrawer({ announcement, segments, classes, onClose, onSaved }: DrawerProps) {
  const { profile } = useAdminAuth();
  const [form, setForm] = useState(announcement ? {
    title:        announcement.title,
    body:         announcement.body,
    target_type:  announcement.target_type,
    target_ids:   announcement.target_ids,
    target_roles: announcement.target_roles,
    send_whatsapp: announcement.send_whatsapp,
    publish_at:   announcement.publish_at.slice(0, 16),
    is_published: announcement.is_published,
  } : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  function toggleTargetId(id: string) {
    setForm((p) => ({
      ...p,
      target_ids: p.target_ids.includes(id)
        ? p.target_ids.filter((x) => x !== id)
        : [...p.target_ids, id],
    }));
  }

  async function save(publish = false) {
    if (!form.title.trim()) { setError('Título é obrigatório.'); return; }
    if (!form.body.trim())  { setError('Conteúdo é obrigatório.'); return; }
    setSaving(true); setError('');

    const isPublishing = publish || form.is_published;
    const payload = {
      created_by:    profile!.id,
      title:         form.title.trim(),
      body:          form.body.trim(),
      target_type:   form.target_type,
      target_ids:    form.target_ids,
      target_roles:  form.target_roles,
      send_whatsapp: form.send_whatsapp,
      publish_at:    new Date(form.publish_at).toISOString(),
      is_published:  isPublishing,
      updated_at:    new Date().toISOString(),
    };

    const { data, error: err } = announcement
      ? await supabase.from('announcements').update(payload).eq('id', announcement.id).select('*').single()
      : await supabase.from('announcements').insert(payload).select('*').single();

    if (err) { setError(err.message); setSaving(false); return; }

    const saved = data as Announcement;

    // If publishing with WhatsApp, send to target recipients
    if (isPublishing && form.send_whatsapp && !announcement?.is_published) {
      await _sendWhatsApp(saved);
    }

    onSaved(saved);
  }

  async function _sendWhatsApp(ann: Announcement) {
    // Get phones based on target
    let query = supabase.from('students').select('guardian_phone, full_name').eq('status', 'active');

    if (ann.target_type === 'class' && ann.target_ids.length) {
      query = query.in('class_id', ann.target_ids);
    } else if (ann.target_type === 'segment' && ann.target_ids.length) {
      // Need to join via classes — fetch class ids first
      const { data: cls } = await supabase
        .from('school_classes').select('id').in('segment_id', ann.target_ids);
      const classIds = (cls ?? []).map((c: { id: string }) => c.id);
      if (classIds.length) query = query.in('class_id', classIds);
    }

    const { data: students } = await query;
    if (!students?.length) return;

    const text = `*${ann.title}*\n\n${ann.body}`;
    for (const s of students as { guardian_phone: string; full_name: string }[]) {
      if (!s.guardian_phone) continue;
      await sendWhatsAppText({
        phone:         s.guardian_phone,
        text,
        relatedModule: 'announcement',
        relatedRecordId: ann.id,
        recipientName:   s.full_name,
      });
    }
  }

  const cls = `w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] outline-none`;

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-[#003876] dark:bg-gray-800">
          <h2 className="font-semibold text-white">{announcement ? 'Editar Comunicado' : 'Novo Comunicado'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Título *</label>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Ex: Reunião de pais — 3º Bimestre" className={cls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Conteúdo *</label>
            <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              rows={5} placeholder="Escreva o comunicado aqui..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] outline-none resize-none" />
          </div>

          {/* Target */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Público-alvo</label>
            <div className="flex gap-2 flex-wrap">
              {TARGETS.map((t) => {
                const Icon = TARGET_ICON[t];
                return (
                  <button key={t} type="button"
                    onClick={() => setForm((p) => ({ ...p, target_type: t, target_ids: [] }))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      form.target_type === t
                        ? 'border-[#003876] bg-[#003876] text-white dark:border-[#ffd700] dark:bg-[#ffd700] dark:text-gray-900'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                    }`}>
                    <Icon className="w-3.5 h-3.5" /> {ANNOUNCEMENT_TARGET_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Segment picker */}
          {form.target_type === 'segment' && segments.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Segmentos</label>
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
            </div>
          )}

          {/* Class picker */}
          {form.target_type === 'class' && classes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Turmas</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {classes.map((c) => (
                  <button key={c.id} type="button" onClick={() => toggleTargetId(c.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      form.target_ids.includes(c.id)
                        ? 'border-[#003876] bg-[#003876]/10 text-[#003876] dark:border-[#ffd700] dark:bg-[#ffd700]/10 dark:text-[#ffd700]'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                    }`}>{c.name} {c.year}</button>
                ))}
              </div>
            </div>
          )}

          {/* Publish date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Data de publicação</label>
            <input type="datetime-local" value={form.publish_at}
              onChange={(e) => setForm((p) => ({ ...p, publish_at: e.target.value }))} className={cls} />
          </div>

          {/* WhatsApp toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
            <button type="button" onClick={() => setForm((p) => ({ ...p, send_whatsapp: !p.send_whatsapp }))}
              className={`w-10 h-6 rounded-full transition-colors ${form.send_whatsapp ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`block w-4 h-4 bg-white rounded-full shadow mx-1 transition-transform ${form.send_whatsapp ? 'translate-x-4' : ''}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Enviar por WhatsApp</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Envia o comunicado para os responsáveis ao publicar</p>
            </div>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
          <button onClick={() => save(false)} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl disabled:opacity-50 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar rascunho
          </button>
          <button onClick={() => save(true)} disabled={saving || form.is_published}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#003876] hover:bg-[#002855] text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {form.is_published ? 'Já publicado' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const { profile, hasRole } = useAdminAuth();
  const [items,      setItems]      = useState<Announcement[]>([]);
  const [segments,   setSegments]   = useState<SchoolSegment[]>([]);
  const [classes,    setClasses]    = useState<SchoolClass[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState<Announcement | null | undefined>(undefined);
  const [showDrawer, setShowDrawer] = useState(false);
  const [filter,     setFilter]     = useState<'all' | 'published' | 'draft'>('all');

  const canManage = hasRole('super_admin', 'admin', 'coordinator');

  const load = useCallback(async () => {
    const [annRes, segRes, clsRes] = await Promise.all([
      supabase.from('announcements')
        .select('*, creator:profiles(full_name), reads:announcement_reads(user_id)')
        .order('publish_at', { ascending: false }),
      supabase.from('school_segments').select('id, name').eq('is_active', true).order('position'),
      supabase.from('school_classes').select('id, name, year, segment_id').eq('is_active', true).order('name'),
    ]);
    setItems((annRes.data ?? []) as Announcement[]);
    setSegments((segRes.data ?? []) as SchoolSegment[]);
    setClasses((clsRes.data ?? []) as SchoolClass[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    await supabase.from('announcements').delete().eq('id', id);
    setItems((p) => p.filter((a) => a.id !== id));
  }

  async function togglePublish(ann: Announcement) {
    const { data } = await supabase
      .from('announcements')
      .update({ is_published: !ann.is_published, updated_at: new Date().toISOString() })
      .eq('id', ann.id).select('*').single();
    if (data) setItems((p) => p.map((x) => x.id === ann.id ? { ...x, is_published: !ann.is_published } : x));
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const filtered = items.filter((a) => {
    if (filter === 'published') return a.is_published;
    if (filter === 'draft')     return !a.is_published;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-[#003876] dark:text-[#ffd700]" />
            Comunicados
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Avisos e comunicados para responsáveis, professores e alunos.
          </p>
        </div>
        {canManage && (
          <button onClick={() => { setEditing(null); setShowDrawer(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#003876] hover:bg-[#002855] text-white text-sm font-medium rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Novo Comunicado
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-700">
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              filter === f
                ? 'border-[#003876] dark:border-[#ffd700] text-[#003876] dark:text-[#ffd700]'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}>
            {f === 'all' ? 'Todos' : f === 'published' ? 'Publicados' : 'Rascunhos'}
            <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs">
              {f === 'all' ? items.length : f === 'published' ? items.filter((a) => a.is_published).length : items.filter((a) => !a.is_published).length}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#003876] dark:text-[#ffd700]" />
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{items.length ? 'Nenhum comunicado nesta categoria.' : 'Nenhum comunicado criado.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const readCount  = (a.reads ?? []).length;
            const isMyOwn    = a.created_by === profile?.id;
            const canEdit    = isMyOwn || canManage;
            const TargetIcon = TARGET_ICON[a.target_type];
            return (
              <div key={a.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{a.title}</p>
                      {a.is_published ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Publicado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full text-xs font-medium">
                          Rascunho
                        </span>
                      )}
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[#003876]/10 dark:bg-[#ffd700]/10 text-[#003876] dark:text-[#ffd700] rounded-full text-xs">
                        <TargetIcon className="w-3 h-3" />
                        {ANNOUNCEMENT_TARGET_LABELS[a.target_type]}
                      </span>
                      {a.send_whatsapp && (
                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-xs">
                          WhatsApp
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2">{a.body}</p>

                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {fmtDate(a.publish_at)}
                      </span>
                      {readCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {readCount} leitura{readCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {a.creator && (
                        <span>por {(a.creator as { full_name: string }).full_name}</span>
                      )}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canManage && (
                        <button
                          onClick={() => togglePublish(a)}
                          title={a.is_published ? 'Despublicar' : 'Publicar'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            a.is_published
                              ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                              : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                          }`}>
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => { setEditing(a); setShowDrawer(true); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#003876] dark:hover:text-[#ffd700] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {canManage && (
                        <button onClick={() => remove(a.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showDrawer && (
        <AnnouncementDrawer
          announcement={editing ?? null}
          segments={segments}
          classes={classes}
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

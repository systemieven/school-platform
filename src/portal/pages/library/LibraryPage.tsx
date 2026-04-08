import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import {
  Loader2, Library, Search, ExternalLink, BookMarked, FileText, Video, Link2, File,
} from 'lucide-react';

interface Resource {
  id: string; title: string; description: string | null; resource_type: string;
  resource_subtype: string; subject: string | null; external_url: string | null;
  file_url: string | null; thumbnail_url: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  book: 'Livro', article: 'Artigo', video: 'Vídeo', link: 'Link', document: 'Documento',
};

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

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : null;
}

function ResourceCard({ r }: { r: Resource }) {
  const [open, setOpen] = useState(false);
  const Icon = TYPE_ICON[r.resource_type] ?? Link2;
  const colorCls = TYPE_COLOR[r.resource_type] ?? TYPE_COLOR.link;

  const youtubeId = r.resource_subtype === 'youtube' && r.external_url
    ? getYouTubeId(r.external_url) : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorCls}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{r.title}</p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colorCls}`}>
                {TYPE_LABELS[r.resource_type] ?? r.resource_type}
              </span>
              {r.subject && <span className="text-xs text-gray-500 dark:text-gray-400">{r.subject}</span>}
            </div>
            {r.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{r.description}</p>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex gap-2">
          {/* YouTube embed toggle */}
          {youtubeId && (
            <button onClick={() => setOpen((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
              <Video className="w-3 h-3" /> {open ? 'Fechar vídeo' : 'Assistir'}
            </button>
          )}

          {/* PDF/image inline toggle */}
          {(r.resource_subtype === 'pdf' || r.resource_subtype === 'image') && r.file_url && (
            <button onClick={() => setOpen((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors">
              <FileText className="w-3 h-3" /> {open ? 'Fechar' : 'Visualizar'}
            </button>
          )}

          {/* External link */}
          {r.external_url && r.resource_subtype !== 'youtube' && (
            <a href={r.external_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#003876]/10 dark:bg-[#ffd700]/10 text-[#003876] dark:text-[#ffd700] rounded-lg text-xs font-medium hover:bg-[#003876]/20 transition-colors">
              <ExternalLink className="w-3 h-3" /> Abrir
            </a>
          )}
        </div>
      </div>

      {/* Inline preview */}
      {open && youtubeId && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {open && r.resource_subtype === 'pdf' && r.file_url && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          <iframe src={r.file_url} className="w-full h-96" title={r.title} />
        </div>
      )}

      {open && r.resource_subtype === 'image' && r.file_url && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4">
          <img src={r.file_url} alt={r.title} className="w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

export default function PortalLibraryPage() {
  const { student } = useStudentAuth();
  const [items,      setItems]      = useState<Resource[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!student) { setLoading(false); return; }
    // Fetch resources: all + class-targeted (RLS handles segment/student)
    supabase.from('library_resources')
      .select('id, title, description, resource_type, resource_subtype, subject, external_url, file_url, thumbnail_url')
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setItems((data ?? []) as Resource[]); setLoading(false); });
  }, [student]);

  const types = [...new Set(items.map((r) => r.resource_type))];

  const filtered = items.filter((r) => {
    const matchType   = typeFilter === 'all' || r.resource_type === typeFilter;
    const matchSearch = !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.subject ?? '').toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <Library className="w-5 h-5 text-[#003876] dark:text-[#ffd700]" /> Biblioteca Virtual
      </h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou disciplina..."
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-[#003876] dark:focus:border-[#ffd700]" />
      </div>

      {types.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === 'all' ? 'bg-[#003876] text-white dark:bg-[#ffd700] dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
            Todos
          </button>
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-[#003876] text-white dark:bg-[#ffd700] dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#003876] dark:text-[#ffd700]" /></div>
      ) : !filtered.length ? (
        <div className="text-center py-12 text-gray-400">
          <Library className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{items.length ? 'Nenhum recurso encontrado.' : 'Nenhum material disponível.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => <ResourceCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}

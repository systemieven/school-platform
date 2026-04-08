import { useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import {
  Loader2, Save, Check, Link2, Upload, AlertCircle, ExternalLink,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { SettingsCard } from '../../components/SettingsCard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HeroFields {
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
  image: string;
}

interface HomeFields extends Omit<HeroFields, 'image'> {
  video_url: string;
  segments: { image: string; description: string }[];
}

interface ContatoFields extends HeroFields {
  phone: string;
  address: string;
  hours: string;
}

type PageKey =
  | 'home' | 'educacao_infantil' | 'fundamental_1' | 'fundamental_2'
  | 'ensino_medio' | 'contato' | 'visita' | 'matricula';

interface AllPages {
  home: HomeFields;
  educacao_infantil: HeroFields;
  fundamental_1: HeroFields;
  fundamental_2: HeroFields;
  ensino_medio: HeroFields;
  contato: ContatoFields;
  visita: HeroFields;
  matricula: HeroFields;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_HOME: HomeFields = {
  badge: 'Matrículas 2026 abertas',
  title: 'Educação que Transforma Vidas',
  highlight: 'Transforma',
  subtitle: 'Há mais de 20 anos formando cidadãos com excelência acadêmica e valores cristãos em Caruaru.',
  video_url: 'https://s3.ibotcloud.com.br/colegiobatista/imagens/site/video-inicio.mp4',
  segments: [
    { image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=1000', description: 'Desenvolvimento integral da criança' },
    { image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=1000', description: 'Base sólida para o futuro' },
    { image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=1000', description: 'Desenvolvimento do pensamento crítico' },
    { image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1000', description: 'Preparação para o futuro' },
  ],
};

const DEFAULT_PAGES: AllPages = {
  home: DEFAULT_HOME,
  educacao_infantil: { badge: 'Educação Infantil · 2 a 5 anos', title: 'Educação que Encanta e Transforma', highlight: 'Encanta', subtitle: 'Um ambiente acolhedor e estimulante para o desenvolvimento integral do seu filho.', image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=2070' },
  fundamental_1:    { badge: 'Fundamental I · 1º ao 5º ano',   title: 'Construindo as Bases do Futuro',      highlight: 'Bases',      subtitle: 'Bases sólidas para o futuro através de uma educação integral, inovadora e com valores cristãos.',                                            image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2070' },
  fundamental_2:    { badge: 'Fundamental II · 6º ao 9º ano',  title: 'Construindo o Futuro de cada jovem', highlight: 'Futuro',     subtitle: 'Preparando jovens para os desafios do futuro com excelência acadêmica e valores sólidos.',                                                  image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=2070' },
  ensino_medio:     { badge: 'Ensino Médio · 1º a 3º ano',     title: 'Sua rota para o Sucesso',            highlight: 'Sucesso',    subtitle: 'Excelência acadêmica e preparação completa para o sucesso no ENEM e vestibulares.',                                                       image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=2070' },
  contato:          { badge: 'Fale conosco', title: 'Entre em Contato', highlight: 'Contato', subtitle: 'Tire suas dúvidas, agende uma visita ou solicite informações sobre matrículas.', image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=2070', phone: '(81) 3721-4787', address: 'Rua Marcílio Dias, 99 | São Francisco, Caruaru/PE', hours: 'Segunda a Sexta: 7h às 17h' },
  visita:           { badge: 'Visita presencial',               title: 'Agende sua Visita',                 highlight: 'Visita',     subtitle: 'Conheça pessoalmente nossa estrutura, equipe pedagógica e tudo que o Colégio Batista tem a oferecer.',                                     image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2070' },
  matricula:        { badge: 'Matrículas 2026 abertas',         title: 'Matricule seu Filho',               highlight: 'Filho',      subtitle: 'Garanta a vaga do seu filho em uma das melhores escolas de Caruaru.',                                                                      image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=2070' },
};

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

const SUB_TABS: { key: PageKey; label: string }[] = [
  { key: 'home',              label: 'Home' },
  { key: 'educacao_infantil', label: 'Infantil' },
  { key: 'fundamental_1',    label: 'Fund. I' },
  { key: 'fundamental_2',    label: 'Fund. II' },
  { key: 'ensino_medio',     label: 'Médio' },
  { key: 'contato',          label: 'Contato' },
  { key: 'visita',           label: 'Visita' },
  { key: 'matricula',        label: 'Matrícula' },
];

// ── Shared style constants ────────────────────────────────────────────────────

const inputCls     = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003876]/30 focus:border-[#003876] bg-white dark:bg-gray-800 dark:border-gray-700';
const textareaCls  = `${inputCls} resize-none`;
const labelCls     = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

// ── ImageField — dual-mode URL / Upload ───────────────────────────────────────

interface ImageFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  storageKey: string;   // used as filename prefix in the bucket
  hint?: string;
}

function ImageField({ label, value, onChange, storageKey, hint }: ImageFieldProps) {
  const [mode, setMode]           = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadErr('Formato não suportado. Use JPG, PNG ou WebP.');
      return;
    }
    setUploading(true);
    setUploadErr(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2400,
        useWebWorker: true,
      });
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${storageKey}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('site-images')
        .upload(path, compressed, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('site-images').getPublicUrl(path);
      onChange(data.publicUrl);
    } catch {
      setUploadErr('Erro ao enviar a imagem. Verifique sua conexão e tente novamente.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Label + mode toggle */}
      <div className="flex items-center justify-between">
        <label className={labelCls + ' mb-0'}>{label}</label>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
          {(['url', 'upload'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setUploadErr(null); }}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200',
                mode === m
                  ? 'bg-[#003876] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              ].join(' ')}
            >
              {m === 'url'
                ? <><Link2 className="w-3 h-3" /> Link</>
                : <><Upload className="w-3 h-3" /> Upload</>}
            </button>
          ))}
        </div>
      </div>

      {hint && <p className="text-xs text-gray-400">{hint}</p>}

      {/* URL mode */}
      {mode === 'url' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <label
          className={[
            'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 text-center transition-all',
            uploading
              ? 'border-gray-200 bg-gray-50 dark:bg-gray-800/40 cursor-wait opacity-70'
              : dragOver
              ? 'border-[#003876] bg-[#003876]/5 cursor-pointer'
              : 'border-gray-200 dark:border-gray-700 hover:border-[#003876]/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer',
          ].join(' ')}
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file && !uploading) handleFile(file);
          }}
        >
          {uploading ? (
            <>
              <Loader2 className="w-7 h-7 text-[#003876] animate-spin" />
              <span className="text-sm text-gray-500">Comprimindo e enviando…</span>
            </>
          ) : (
            <>
              <Upload className="w-7 h-7 text-gray-300" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Clique ou arraste uma imagem
              </span>
              <span className="text-xs text-gray-400">
                JPG, PNG ou WebP · máx. 10 MB · recomendado proporção 16:9
              </span>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {/* Upload error */}
      {uploadErr && (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {uploadErr}
        </p>
      )}

      {/* Preview — always shown when value exists */}
      {value && (
        <div className="relative rounded-xl overflow-hidden h-28 bg-gray-100 dark:bg-gray-800 group">
          <img
            src={value}
            alt="preview"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Abrir imagem em nova aba"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// ── HeroFieldsBlock ───────────────────────────────────────────────────────────

function HeroFieldsBlock({
  data,
  pageKey,
  onChange,
}: {
  data: HeroFields;
  pageKey: string;
  onChange: (d: HeroFields) => void;
}) {
  const set = (key: keyof HeroFields, value: string) => onChange({ ...data, [key]: value });

  return (
    <SettingsCard title="Hero da Página">
      <div>
        <label className={labelCls}>Badge</label>
        <input type="text" value={data.badge} onChange={(e) => set('badge', e.target.value)} placeholder="Ex: Matrículas 2026 abertas" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Título</label>
        <input type="text" value={data.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex: Educação que Transforma Vidas" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Palavra em Destaque <span className="font-normal text-gray-400">(itálico dourado)</span></label>
        <p className="text-xs text-gray-400 mb-1.5">Deve ser exatamente como está escrita no Título acima.</p>
        <input type="text" value={data.highlight} onChange={(e) => set('highlight', e.target.value)} placeholder="Ex: Transforma" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Subtítulo</label>
        <textarea rows={3} value={data.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Descrição exibida abaixo do título" className={textareaCls} />
      </div>

      <ImageField
        label="Imagem de Fundo"
        value={data.image}
        onChange={(v) => set('image', v)}
        storageKey={`${pageKey}_hero`}
      />
    </SettingsCard>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AppearanceSettingsPanel() {
  const [pages, setPages]         = useState<AllPages>(DEFAULT_PAGES);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [original, setOriginal]   = useState('');
  const [activeTab, setActiveTab] = useState<PageKey>('home');

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'appearance')
      .then(({ data: rows }) => {
        if (!rows) { setLoading(false); return; }
        const merged = { ...DEFAULT_PAGES };
        rows.forEach((r) => {
          const key = r.key as PageKey;
          if (!(key in merged)) return;
          try {
            const val = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
            if (val && typeof val === 'object') merged[key] = { ...DEFAULT_PAGES[key], ...val } as never;
          } catch { /* keep default */ }
        });
        setPages(merged);
        setOriginal(JSON.stringify(merged));
        setLoading(false);
      });
  }, []);

  const hasChanges = JSON.stringify(pages) !== original;

  async function handleSave() {
    setSaving(true);
    const value = pages[activeTab];
    await supabase
      .from('system_settings')
      .upsert({ category: 'appearance', key: activeTab, value }, { onConflict: 'category,key' });
    setOriginal(JSON.stringify(pages));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function updatePage<K extends PageKey>(key: K, data: AllPages[K]) {
    setPages((prev) => ({ ...prev, [key]: data }));
  }

  function updateHome(partial: Partial<HomeFields>) {
    setPages((prev) => ({ ...prev, home: { ...prev.home, ...partial } }));
  }

  function updateSegment(index: number, partial: Partial<{ image: string; description: string }>) {
    setPages((prev) => {
      const segments = [...prev.home.segments];
      segments[index] = { ...segments[index], ...partial };
      return { ...prev, home: { ...prev.home, segments } };
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#003876] animate-spin" />
      </div>
    );
  }

  const home    = pages.home;
  const contato = pages.contato;

  return (
    <div className="p-6 space-y-5">

      {/* ── Sub-tab bar ── */}
      <div className="flex flex-wrap gap-1 border-b border-gray-100 dark:border-gray-700 -mx-6 px-6 pb-0">
        {SUB_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'bg-[#003876] text-white border-[#003876]'
                : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-200 dark:hover:text-gray-300',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Home ── */}
      {activeTab === 'home' && (
        <>
          <SettingsCard title="Hero da Página">
            <div>
              <label className={labelCls}>Badge</label>
              <input type="text" value={home.badge} onChange={(e) => updateHome({ badge: e.target.value })} placeholder="Ex: Matrículas 2026 abertas" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Título</label>
              <input type="text" value={home.title} onChange={(e) => updateHome({ title: e.target.value })} placeholder="Ex: Educação que Transforma Vidas" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Palavra em Destaque <span className="font-normal text-gray-400">(itálico dourado)</span></label>
              <p className="text-xs text-gray-400 mb-1.5">Deve ser exatamente como está escrita no Título acima.</p>
              <input type="text" value={home.highlight} onChange={(e) => updateHome({ highlight: e.target.value })} placeholder="Ex: Transforma" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Subtítulo</label>
              <textarea rows={3} value={home.subtitle} onChange={(e) => updateHome({ subtitle: e.target.value })} placeholder="Descrição exibida abaixo do título" className={textareaCls} />
            </div>

            <div>
              <label className={labelCls}>URL do Vídeo de Fundo</label>
              <p className="text-xs text-gray-400 mb-1.5">Somente link — upload de vídeo não é suportado pelo tamanho dos arquivos.</p>
              <input type="text" value={home.video_url} onChange={(e) => updateHome({ video_url: e.target.value })} placeholder="https://..." className={inputCls} />
            </div>
          </SettingsCard>

          <SettingsCard title="Cards dos Segmentos" description="4 cards exibidos na seção de segmentos da Home. Edite a imagem e a descrição de cada um.">
            <div className="space-y-5 pt-1">
              {home.segments.map((seg, i) => (
                <div key={i} className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                  <p className="text-xs font-semibold text-[#003876] dark:text-blue-400">
                    {['Educação Infantil', 'Fundamental I', 'Fundamental II', 'Ensino Médio'][i]}
                  </p>
                  <ImageField
                    label="Imagem do card"
                    value={seg.image}
                    onChange={(v) => updateSegment(i, { image: v })}
                    storageKey={`home_segment_${i}`}
                  />
                  <div>
                    <label className={labelCls}>Descrição curta</label>
                    <input
                      type="text"
                      value={seg.description}
                      onChange={(e) => updateSegment(i, { description: e.target.value })}
                      placeholder="Ex: Desenvolvimento integral da criança"
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>
        </>
      )}

      {/* ── Segment pages ── */}
      {(activeTab === 'educacao_infantil' || activeTab === 'fundamental_1' ||
        activeTab === 'fundamental_2'    || activeTab === 'ensino_medio'   ||
        activeTab === 'visita'           || activeTab === 'matricula') && (
        <HeroFieldsBlock
          data={pages[activeTab] as HeroFields}
          pageKey={activeTab}
          onChange={(d) => updatePage(activeTab, d as AllPages[typeof activeTab])}
        />
      )}

      {/* ── Contato ── */}
      {activeTab === 'contato' && (
        <>
          <HeroFieldsBlock
            data={contato}
            pageKey="contato"
            onChange={(d) => updatePage('contato', { ...contato, ...d })}
          />

          <SettingsCard title="Informações de Contato" description="Exibidas no sidebar da página de contato.">
            <div>
              <label className={labelCls}>Telefone</label>
              <input type="text" value={contato.phone} onChange={(e) => updatePage('contato', { ...contato, phone: e.target.value })} placeholder="(81) 3721-4787" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Endereço</label>
              <p className="text-xs text-gray-400 mb-1.5">Separe as linhas com " | " — ex: Rua X, 99 | Bairro, Cidade/UF</p>
              <textarea rows={2} value={contato.address} onChange={(e) => updatePage('contato', { ...contato, address: e.target.value })} placeholder="Rua Marcílio Dias, 99 | São Francisco, Caruaru/PE" className={textareaCls} />
            </div>

            <div>
              <label className={labelCls}>Horário de Atendimento</label>
              <input type="text" value={contato.hours} onChange={(e) => updatePage('contato', { ...contato, hours: e.target.value })} placeholder="Segunda a Sexta: 7h às 17h" className={inputCls} />
            </div>
          </SettingsCard>
        </>
      )}

      {/* ── Floating save button ── */}
      <div className={[
        'fixed bottom-6 right-8 z-30 transition-all duration-300',
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none',
      ].join(' ')}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={[
            'inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300',
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-[#003876] text-white hover:bg-[#002855] shadow-[#003876]/25 disabled:opacity-50',
          ].join(' ')}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

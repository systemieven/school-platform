import { useEffect, useState } from 'react';
import { Loader2, Save, Check } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

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

type PageKey = 'home' | 'educacao_infantil' | 'fundamental_1' | 'fundamental_2' | 'ensino_medio' | 'contato' | 'visita' | 'matricula';

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

const DEFAULT_HERO: HeroFields = { badge: '', title: '', highlight: '', subtitle: '', image: '' };

const DEFAULT_PAGES: AllPages = {
  home: DEFAULT_HOME,
  educacao_infantil: { badge: 'Educação Infantil · 2 a 5 anos', title: 'Educação que Encanta e Transforma', highlight: 'Encanta', subtitle: 'Um ambiente acolhedor e estimulante para o desenvolvimento integral do seu filho.', image: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=2070' },
  fundamental_1: { badge: 'Fundamental I · 1º ao 5º ano', title: 'Construindo as Bases do Futuro', highlight: 'Bases', subtitle: 'Bases sólidas para o futuro através de uma educação integral, inovadora e com valores cristãos.', image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2070' },
  fundamental_2: { badge: 'Fundamental II · 6º ao 9º ano', title: 'Construindo o Futuro de cada jovem', highlight: 'Futuro', subtitle: 'Preparando jovens para os desafios do futuro com excelência acadêmica e valores sólidos.', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=2070' },
  ensino_medio: { badge: 'Ensino Médio · 1º a 3º ano', title: 'Sua rota para o Sucesso', highlight: 'Sucesso', subtitle: 'Excelência acadêmica e preparação completa para o sucesso no ENEM e vestibulares.', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=2070' },
  contato: { badge: 'Fale conosco', title: 'Entre em Contato', highlight: 'Contato', subtitle: 'Tire suas dúvidas, agende uma visita ou solicite informações sobre matrículas.', image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=2070', phone: '(81) 3721-4787', address: 'Rua Marcílio Dias, 99 | São Francisco, Caruaru/PE', hours: 'Segunda a Sexta: 7h às 17h' },
  visita: { badge: 'Visita presencial', title: 'Agende sua Visita', highlight: 'Visita', subtitle: 'Conheça pessoalmente nossa estrutura, equipe pedagógica e tudo que o Colégio Batista tem a oferecer.', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2070' },
  matricula: { badge: 'Matrículas 2026 abertas', title: 'Matricule seu Filho', highlight: 'Filho', subtitle: 'Garanta a vaga do seu filho em uma das melhores escolas de Caruaru.', image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=2070' },
};

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

const SUB_TABS: { key: PageKey; label: string }[] = [
  { key: 'home',             label: 'Home' },
  { key: 'educacao_infantil',label: 'Infantil' },
  { key: 'fundamental_1',    label: 'Fund. I' },
  { key: 'fundamental_2',    label: 'Fund. II' },
  { key: 'ensino_medio',     label: 'Médio' },
  { key: 'contato',          label: 'Contato' },
  { key: 'visita',           label: 'Visita' },
  { key: 'matricula',        label: 'Matrícula' },
];

// ── Shared style constants ────────────────────────────────────────────────────

const sectionCard  = 'bg-gray-50 dark:bg-gray-900/30 rounded-2xl p-5 space-y-4';
const sectionTitle = 'text-xs font-semibold tracking-[0.12em] uppercase text-gray-400 mb-4';
const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003876]/30 focus:border-[#003876] bg-white dark:bg-gray-800 dark:border-gray-700';
const textareaCls = `${inputCls} resize-none`;
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

// ── Sub-components ────────────────────────────────────────────────────────────

function ImageField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className={inputCls}
      />
      {value && (
        <img
          src={value}
          alt="preview"
          className="mt-2 object-cover h-24 w-full rounded-lg border border-gray-200 dark:border-gray-700"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}

function HeroFields({ data, onChange }: { data: HeroFields; onChange: (d: HeroFields) => void }) {
  const set = (key: keyof HeroFields, value: string) => onChange({ ...data, [key]: value });
  return (
    <div className={sectionCard}>
      <p className={sectionTitle}>Hero da Página</p>

      <div>
        <label className={labelCls}>Badge</label>
        <input type="text" value={data.badge} onChange={(e) => set('badge', e.target.value)} placeholder="Ex: Matrículas 2026 abertas" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Título</label>
        <input type="text" value={data.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex: Educação que Transforma Vidas" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Palavra em Destaque (italic dourado)</label>
        <p className="text-xs text-gray-400 mb-1.5">Deve ser uma palavra exata contida no Título acima. Ela será exibida em itálico com cor dourada.</p>
        <input type="text" value={data.highlight} onChange={(e) => set('highlight', e.target.value)} placeholder="Ex: Transforma" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Subtítulo</label>
        <textarea rows={3} value={data.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Descrição exibida abaixo do título" className={textareaCls} />
      </div>

      <ImageField label="Imagem de Fundo" value={data.image} onChange={(v) => set('image', v)} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AppearanceSettingsPanel() {
  const [pages, setPages]       = useState<AllPages>(DEFAULT_PAGES);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [original, setOriginal] = useState<string>('');
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
            if (val && typeof val === 'object') {
              // Deep merge with defaults to ensure all fields exist
              merged[key] = { ...DEFAULT_PAGES[key], ...val } as never;
            }
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
    const key = activeTab;
    const value = pages[key];
    await supabase
      .from('system_settings')
      .upsert({ category: 'appearance', key, value }, { onConflict: 'category,key' });
    // Update original for this key
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
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? 'bg-[#003876] text-white border-[#003876]'
                : 'text-gray-500 hover:text-gray-700 border-transparent hover:border-gray-200 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}

      {activeTab === 'home' && (
        <>
          {/* Hero fields (without image, has video instead) */}
          <div className={sectionCard}>
            <p className={sectionTitle}>Hero da Página</p>

            <div>
              <label className={labelCls}>Badge</label>
              <input type="text" value={home.badge} onChange={(e) => updateHome({ badge: e.target.value })} placeholder="Ex: Matrículas 2026 abertas" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Título</label>
              <input type="text" value={home.title} onChange={(e) => updateHome({ title: e.target.value })} placeholder="Ex: Educação que Transforma Vidas" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Palavra em Destaque (italic dourado)</label>
              <p className="text-xs text-gray-400 mb-1.5">Deve ser uma palavra exata contida no Título acima. Ela será exibida em itálico com cor dourada.</p>
              <input type="text" value={home.highlight} onChange={(e) => updateHome({ highlight: e.target.value })} placeholder="Ex: Transforma" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Subtítulo</label>
              <textarea rows={3} value={home.subtitle} onChange={(e) => updateHome({ subtitle: e.target.value })} placeholder="Descrição exibida abaixo do título" className={textareaCls} />
            </div>

            <div>
              <label className={labelCls}>URL do Vídeo de Fundo</label>
              <input type="text" value={home.video_url} onChange={(e) => updateHome({ video_url: e.target.value })} placeholder="https://..." className={inputCls} />
            </div>
          </div>

          {/* Segment cards */}
          <div className={sectionCard}>
            <p className={sectionTitle}>Cards dos Segmentos</p>
            <p className="text-xs text-gray-400 -mt-2 mb-3">4 cards exibidos na seção de segmentos da Home. Edite imagem e descrição de cada um.</p>
            <div className="space-y-6">
              {home.segments.map((seg, i) => (
                <div key={i} className="space-y-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Card {i + 1}</p>
                  <ImageField
                    label="Imagem"
                    value={seg.image}
                    onChange={(v) => updateSegment(i, { image: v })}
                  />
                  <div>
                    <label className={labelCls}>Descrição</label>
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
          </div>
        </>
      )}

      {activeTab === 'educacao_infantil' && (
        <HeroFields
          data={pages.educacao_infantil}
          onChange={(d) => updatePage('educacao_infantil', d)}
        />
      )}

      {activeTab === 'fundamental_1' && (
        <HeroFields
          data={pages.fundamental_1}
          onChange={(d) => updatePage('fundamental_1', d)}
        />
      )}

      {activeTab === 'fundamental_2' && (
        <HeroFields
          data={pages.fundamental_2}
          onChange={(d) => updatePage('fundamental_2', d)}
        />
      )}

      {activeTab === 'ensino_medio' && (
        <HeroFields
          data={pages.ensino_medio}
          onChange={(d) => updatePage('ensino_medio', d)}
        />
      )}

      {activeTab === 'contato' && (
        <>
          <HeroFields
            data={contato}
            onChange={(d) => updatePage('contato', { ...contato, ...d })}
          />

          <div className={sectionCard}>
            <p className={sectionTitle}>Informações de Contato (sidebar)</p>

            <div>
              <label className={labelCls}>Telefone</label>
              <input
                type="text"
                value={contato.phone}
                onChange={(e) => updatePage('contato', { ...contato, phone: e.target.value })}
                placeholder="(81) 3721-4787"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Endereço</label>
              <p className="text-xs text-gray-400 mb-1.5">Separe as linhas com " | " (ex: Rua X, 99 | Bairro, Cidade/UF)</p>
              <textarea
                rows={3}
                value={contato.address}
                onChange={(e) => updatePage('contato', { ...contato, address: e.target.value })}
                placeholder="Rua Marcílio Dias, 99 | São Francisco, Caruaru/PE"
                className={textareaCls}
              />
            </div>

            <div>
              <label className={labelCls}>Horário de Atendimento</label>
              <input
                type="text"
                value={contato.hours}
                onChange={(e) => updatePage('contato', { ...contato, hours: e.target.value })}
                placeholder="Segunda a Sexta: 7h às 17h"
                className={inputCls}
              />
            </div>
          </div>
        </>
      )}

      {activeTab === 'visita' && (
        <HeroFields
          data={pages.visita}
          onChange={(d) => updatePage('visita', d)}
        />
      )}

      {activeTab === 'matricula' && (
        <HeroFields
          data={pages.matricula}
          onChange={(d) => updatePage('matricula', d)}
        />
      )}

      {/* ── Floating save button ── */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-[#003876] text-white hover:bg-[#002855] shadow-[#003876]/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

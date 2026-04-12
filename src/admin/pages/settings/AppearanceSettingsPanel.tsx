import { useEffect, useState } from 'react';
import {
  Loader2, Save, Check,
  Home, Baby, BookOpen, BookMarked, GraduationCap, MessageSquare,
  CalendarCheck, ClipboardList, Info, Building2, Plus, Trash2, GripVertical,
  Image as ImageIcon, Video, Eye, EyeOff, Clock, Shuffle, ListOrdered,
  Play, Layers,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { SettingsCard } from '../../components/SettingsCard';
import ImageField from '../../components/ImageField';
import {
  InputField, TextareaField, SectionLabel, SectionDivider,
  INPUT_CLS, LABEL_CLS,
} from '../../components/FormField';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HeroFields {
  badge: string;
  title: string;
  highlight: string;
  subtitle: string;
  image: string;
}

// ── Slideshow types ──────────────────────────────────────────────────────────

export type TransitionEffect = 'crossfade' | 'slide' | 'zoom' | 'blur' | 'flip';

export interface HeroScene {
  id: string;
  media_type: 'image' | 'video';
  media_url: string;
  duration: number;       // seconds (0 = use global default)
  blue_mask: boolean;
}

export interface HeroSlideshowConfig {
  default_duration: number;
  order: 'sequential' | 'random';
  transition: TransitionEffect;
  transition_duration: number; // ms
}

const TRANSITION_OPTIONS: { value: TransitionEffect; label: string; desc: string }[] = [
  { value: 'crossfade', label: 'Crossfade',  desc: 'Transição suave de opacidade' },
  { value: 'slide',     label: 'Deslizar',   desc: 'Desliza horizontalmente' },
  { value: 'zoom',      label: 'Zoom',       desc: 'Zoom in com fade' },
  { value: 'blur',      label: 'Desfoque',   desc: 'Desfoca e revela a próxima' },
  { value: 'flip',      label: 'Flip',       desc: 'Gira em perspectiva 3D' },
];

const DEFAULT_SLIDESHOW: HeroSlideshowConfig = {
  default_duration: 8,
  order: 'sequential',
  transition: 'crossfade',
  transition_duration: 1200,
};

interface HomeFields extends Omit<HeroFields, 'image'> {
  video_url: string;
  scenes: HeroScene[];
  slideshow: HeroSlideshowConfig;
  segments: { image: string; description: string }[];
}

type ContatoFields = HeroFields;

type PageKey =
  | 'home' | 'educacao_infantil' | 'fundamental_1' | 'fundamental_2'
  | 'ensino_medio' | 'contato' | 'visita' | 'matricula'
  | 'sobre' | 'estrutura';

interface AllPages {
  home: HomeFields;
  educacao_infantil: HeroFields;
  fundamental_1: HeroFields;
  fundamental_2: HeroFields;
  ensino_medio: HeroFields;
  contato: ContatoFields;
  visita: HeroFields;
  matricula: HeroFields;
  sobre: HeroFields;
  estrutura: HeroFields;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_HOME: HomeFields = {
  badge: 'Matrículas 2026 abertas',
  title: 'Educação que Transforma Vidas',
  highlight: 'Transforma',
  subtitle: '',
  video_url: '',
  scenes: [],
  slideshow: { ...DEFAULT_SLIDESHOW },
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
  fundamental_1:    { badge: 'Fundamental I · 1º ao 5º ano',   title: 'Construindo as Bases do Futuro',      highlight: 'Bases',      subtitle: '',                                            image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2070' },
  fundamental_2:    { badge: 'Fundamental II · 6º ao 9º ano',  title: 'Construindo o Futuro de cada jovem', highlight: 'Futuro',     subtitle: 'Preparando jovens para os desafios do futuro com excelência acadêmica e valores sólidos.',                                                  image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=2070' },
  ensino_medio:     { badge: 'Ensino Médio · 1º a 3º ano',     title: 'Sua rota para o Sucesso',            highlight: 'Sucesso',    subtitle: 'Excelência acadêmica e preparação completa para o sucesso no ENEM e vestibulares.',                                                       image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=2070' },
  contato:          { badge: 'Fale conosco', title: 'Entre em Contato', highlight: 'Contato', subtitle: 'Tire suas dúvidas, agende uma visita ou solicite informações sobre matrículas.', image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=2070' },
  visita:           { badge: 'Visita presencial',               title: 'Agende sua Visita',                 highlight: 'Visita',     subtitle: 'Conheça pessoalmente nossa estrutura, equipe pedagógica e tudo que temos a oferecer.',                                     image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2070' },
  matricula:        { badge: 'Matrículas 2026 abertas',         title: 'Matricule seu Filho',               highlight: 'Filho',      subtitle: 'Garanta a vaga do seu filho.',                                                                      image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=2070' },
  sobre:            { badge: 'Conheça nossa história',          title: 'Sobre Nós',           highlight: 'Nós',    subtitle: '',                                                             image: '' },
  estrutura:        { badge: 'Conheça nossos espaços',          title: 'Nossa Estrutura',                   highlight: 'Estrutura',  subtitle: 'Ambientes modernos e acolhedores projetados para o melhor aprendizado.',                                                                     image: '' },
};

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

const SUB_TABS: { key: PageKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'home',              label: 'Home',      icon: Home },
  { key: 'educacao_infantil', label: 'Infantil',  icon: Baby },
  { key: 'fundamental_1',    label: 'Fund. I',    icon: BookOpen },
  { key: 'fundamental_2',    label: 'Fund. II',   icon: BookMarked },
  { key: 'ensino_medio',     label: 'Médio',      icon: GraduationCap },
  { key: 'contato',          label: 'Contato',    icon: MessageSquare },
  { key: 'visita',           label: 'Visita',     icon: CalendarCheck },
  { key: 'matricula',        label: 'Matrícula',  icon: ClipboardList },
  { key: 'sobre',            label: 'Sobre',      icon: Info },
  { key: 'estrutura',        label: 'Estrutura',  icon: Building2 },
];

// Style aliases from shared FormField
const inputCls  = INPUT_CLS;
const labelCls  = LABEL_CLS;

// ── Sortable Scene Card ──────────────────────────────────────────────────────

function SortableSceneCard({
  scene,
  onUpdate,
  onRemove,
}: {
  scene: HeroScene;
  onUpdate: (partial: Partial<HeroScene>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700/60">
        {/* Drag handle */}
        <button type="button" {...attributes} {...listeners} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Media type toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
          {(['image', 'video'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onUpdate({ media_type: t, media_url: '' })}
              className={[
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200',
                scene.media_type === t ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {t === 'image' ? <><ImageIcon className="w-3 h-3" /> Imagem</> : <><Video className="w-3 h-3" /> Vídeo</>}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Mask toggle */}
        <button
          type="button"
          onClick={() => onUpdate({ blue_mask: !scene.blue_mask })}
          title={scene.blue_mask ? 'Máscara azul ativa' : 'Sem máscara'}
          className={[
            'p-1.5 rounded-lg text-xs transition-all',
            scene.blue_mask
              ? 'bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/30 dark:text-blue-300'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
          ].join(' ')}
        >
          {scene.blue_mask ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        {/* Remove */}
        <button type="button" onClick={onRemove} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Media input */}
        {scene.media_type === 'image' ? (
          <ImageField
            label="Imagem"
            value={scene.media_url}
            onChange={(v) => onUpdate({ media_url: v })}
            storageKey={`home_scene_${scene.id}`}
            hint="JPG, PNG ou WebP · proporção 16:9 recomendada"
          />
        ) : (
          <div>
            <label className={labelCls}>URL do vídeo</label>
            <p className="text-xs text-gray-400 mb-1.5">YouTube, Vimeo ou link direto (MP4). Upload de vídeo não é suportado.</p>
            <input
              type="text"
              value={scene.media_url}
              onChange={(e) => onUpdate({ media_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=... ou link .mp4"
              className={inputCls}
            />
          </div>
        )}

        {/* Duration */}
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-gray-400 shrink-0" />
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 shrink-0">Duração (s)</label>
          <input
            type="number"
            min={0}
            max={120}
            value={scene.duration}
            onChange={(e) => onUpdate({ duration: Math.max(0, Number(e.target.value)) })}
            className={`${inputCls} w-24`}
          />
          <span className="text-xs text-gray-400">0 = padrão global</span>
        </div>
      </div>

      {/* Preview thumbnail */}
      {scene.media_url && scene.media_type === 'image' && (
        <div className="mx-4 mb-4 rounded-lg overflow-hidden h-20 bg-gray-100 dark:bg-gray-800 relative group">
          <img src={scene.media_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          {scene.blue_mask && <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/60 via-brand-primary/40 to-brand-primary-dark/30" />}
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
    <SettingsCard collapseId={`appearance.${pageKey}.hero`} title="Hero da Página">
      {/* ── Textos ── */}
      <SectionLabel>Textos</SectionLabel>
      <InputField label="Badge" value={data.badge}
        onChange={(e) => set('badge', e.target.value)}
        placeholder="Ex: Matrículas 2026 abertas" maxLength={40} />

      <InputField label="Título" value={data.title}
        onChange={(e) => set('title', e.target.value)}
        placeholder="Ex: Educação que Transforma Vidas" maxLength={80} />

      <InputField label="Palavra em Destaque" value={data.highlight}
        onChange={(e) => set('highlight', e.target.value)}
        placeholder="Ex: Transforma"
        hint="Deve ser exatamente como escrita no Título acima. Será exibida em itálico dourado." />

      <TextareaField label="Subtítulo" rows={3} value={data.subtitle}
        onChange={(e) => set('subtitle', e.target.value)}
        placeholder="Descrição exibida abaixo do título" maxLength={160} />

      <SectionDivider />

      {/* ── Mídia ── */}
      <SectionLabel>Mídia</SectionLabel>
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



  // ── Scene helpers ──
  function addScene() {
    const scene: HeroScene = {
      id: crypto.randomUUID(),
      media_type: 'image',
      media_url: '',
      duration: 0,
      blue_mask: true,
    };
    updateHome({ scenes: [...(home.scenes ?? []), scene] });
  }

  function removeScene(id: string) {
    updateHome({ scenes: (home.scenes ?? []).filter((s) => s.id !== id) });
  }

  function updateScene(id: string, partial: Partial<HeroScene>) {
    updateHome({
      scenes: (home.scenes ?? []).map((s) => (s.id === id ? { ...s, ...partial } : s)),
    });
  }

  function handleSceneDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const scenes = home.scenes ?? [];
    const oldIdx = scenes.findIndex((s) => s.id === active.id);
    const newIdx = scenes.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    updateHome({ scenes: arrayMove(scenes, oldIdx, newIdx) });
  }

  function updateSlideshow(partial: Partial<HeroSlideshowConfig>) {
    updateHome({ slideshow: { ...(home.slideshow ?? DEFAULT_SLIDESHOW), ...partial } });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
      </div>
    );
  }

  const home    = pages.home;
  const contato = pages.contato;

  return (
    <div className="p-6 space-y-5">

      {/* ── Sub-tab bar ── */}
      <div className="flex flex-wrap gap-1.5 -mx-6 px-6 pb-1">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all duration-200',
              activeTab === key
                ? 'bg-brand-secondary text-brand-primary shadow-md shadow-brand-secondary/20'
                : 'text-brand-primary dark:text-brand-secondary hover:bg-brand-primary/10 dark:hover:bg-brand-secondary/10',
            ].join(' ')}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Home ── */}
      {activeTab === 'home' && (
        <>
          <SettingsCard collapseId="appearance.home.hero" title="Hero da Página" icon={Layers}>
            {/* ── Textos ── */}
            <SectionLabel>Textos</SectionLabel>
            <InputField label="Badge" value={home.badge}
              onChange={(e) => updateHome({ badge: e.target.value })}
              placeholder="Ex: Matrículas 2026 abertas" maxLength={40} />

            <InputField label="Título" value={home.title}
              onChange={(e) => updateHome({ title: e.target.value })}
              placeholder="Ex: Educação que Transforma Vidas" maxLength={80} />

            <InputField label="Palavra em Destaque" value={home.highlight}
              onChange={(e) => updateHome({ highlight: e.target.value })}
              placeholder="Ex: Transforma"
              hint="Deve ser exatamente como escrita no Título acima. Será exibida em itálico dourado." />

            <TextareaField label="Subtítulo" rows={3} value={home.subtitle}
              onChange={(e) => updateHome({ subtitle: e.target.value })}
              placeholder="Descrição exibida abaixo do título" maxLength={160} />

            <SectionDivider />

            {/* ── Mídia ── */}
            <SectionLabel>Mídia</SectionLabel>
            <InputField label="URL do Vídeo de Fundo (fallback)" value={home.video_url}
              onChange={(e) => updateHome({ video_url: e.target.value })}
              placeholder="https://..."
              hint="Usado quando nenhuma cena estiver configurada no slideshow abaixo." />
          </SettingsCard>

          {/* ── Slideshow ── */}
          <SettingsCard collapseId="appearance.home.slideshow" title="Slideshow da Hero" icon={Play} description="Configure cenas com imagens ou vídeos para exibição em sequência na hero.">
            {/* ── Configurações ── */}
            <SectionLabel>Configurações</SectionLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl">
              <div>
                <label className={labelCls}>Duração padrão (s)</label>
                <input
                  type="number"
                  min={2}
                  max={60}
                  value={(home.slideshow ?? DEFAULT_SLIDESHOW).default_duration}
                  onChange={(e) => updateSlideshow({ default_duration: Math.max(2, Number(e.target.value)) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Transição (ms)</label>
                <input
                  type="number"
                  min={200}
                  max={3000}
                  step={100}
                  value={(home.slideshow ?? DEFAULT_SLIDESHOW).transition_duration}
                  onChange={(e) => updateSlideshow({ transition_duration: Math.max(200, Number(e.target.value)) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Ordem</label>
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
                  {([
                    { v: 'sequential' as const, icon: ListOrdered, tip: 'Sequencial' },
                    { v: 'random' as const, icon: Shuffle, tip: 'Aleatória' },
                  ]).map(({ v, icon: I, tip }) => (
                    <button
                      key={v}
                      type="button"
                      title={tip}
                      onClick={() => updateSlideshow({ order: v })}
                      className={[
                        'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
                        (home.slideshow ?? DEFAULT_SLIDESHOW).order === v ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-700',
                      ].join(' ')}
                    >
                      <I className="w-3.5 h-3.5" /> {tip}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Efeito de transição</label>
                <select
                  value={(home.slideshow ?? DEFAULT_SLIDESHOW).transition}
                  onChange={(e) => updateSlideshow({ transition: e.target.value as TransitionEffect })}
                  className={inputCls}
                >
                  {TRANSITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <SectionDivider />

            {/* ── Transição ── */}
            <div>
              <SectionLabel>Transição</SectionLabel>
              <div className="grid grid-cols-5 gap-2">
                {TRANSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateSlideshow({ transition: opt.value })}
                    className={[
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 text-center',
                      (home.slideshow ?? DEFAULT_SLIDESHOW).transition === opt.value
                        ? 'border-brand-primary bg-brand-primary/5 shadow-md shadow-brand-primary/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
                    ].join(' ')}
                  >
                    <div className={[
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      (home.slideshow ?? DEFAULT_SLIDESHOW).transition === opt.value ? 'bg-brand-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500',
                    ].join(' ')}>
                      {opt.value === 'crossfade' && <Layers className="w-4 h-4" />}
                      {opt.value === 'slide' && <Play className="w-4 h-4" />}
                      {opt.value === 'zoom' && <ImageIcon className="w-4 h-4" />}
                      {opt.value === 'blur' && <Eye className="w-4 h-4" />}
                      {opt.value === 'flip' && <Video className="w-4 h-4" />}
                    </div>
                    <span className={`text-xs font-medium ${(home.slideshow ?? DEFAULT_SLIDESHOW).transition === opt.value ? 'text-brand-primary' : 'text-gray-600 dark:text-gray-400'}`}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-gray-400 leading-tight">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <SectionDivider />

            {/* ── Cenas ── */}
            <div className="space-y-3">
              <SectionLabel>Cenas</SectionLabel>
              <div className="flex items-center justify-between">
                <label className={labelCls + ' mb-0'}>Cenas ({(home.scenes ?? []).length})</label>
                <button type="button" onClick={addScene} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary-dark transition-colors shadow-sm">
                  <Plus className="w-3.5 h-3.5" /> Adicionar cena
                </button>
              </div>

              {(home.scenes ?? []).length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <Layers className="w-8 h-8 text-gray-300" />
                  <p className="text-sm text-gray-500">Nenhuma cena adicionada</p>
                  <p className="text-xs text-gray-400">O vídeo de fundo (fallback) será exibido enquanto não houver cenas.</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSceneDragEnd}>
                  <SortableContext items={(home.scenes ?? []).map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {(home.scenes ?? []).map((scene) => (
                        <SortableSceneCard
                          key={scene.id}
                          scene={scene}
                          onUpdate={(p) => updateScene(scene.id, p)}
                          onRemove={() => removeScene(scene.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
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
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-brand-primary/25 disabled:opacity-50',
          ].join(' ')}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

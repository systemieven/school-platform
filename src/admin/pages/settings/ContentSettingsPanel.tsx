import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import {
  Save, Loader2, Check,
  Star, Building2, BarChart3, Layers, Image as ImageIcon,
  Home, Baby, BookOpen, BookMarked, GraduationCap, Info,
  BookHeart, Target, Award, Milestone,
} from 'lucide-react';
import IconPicker from '../../components/IconPicker';
import ImageField from '../../components/ImageField';
import {
  InputField, TextareaField, SectionLabel, SectionDivider,
  ArrayItemCard, AddButton,
} from '../../components/FormField';

// ── Types ────────────────────────────────────────────────────────────────────
interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
  stat: string;
  statLabel: string;
}

interface InfraItem {
  icon: string;
  title: string;
  items: string[];
}

interface StatItem {
  value: string;
  label: string;
}

interface PillarItem {
  icon: string;
  title: string;
  desc: string;
  stat: string;
  statLabel: string;
}

interface ActivityItem {
  icon: string;
  title: string;
  desc: string;
}

interface ProgramItem {
  icon: string;
  title: string;
  items: string[];
}

interface CampoItem {
  img: string;
  title: string;
  desc: string;
}

interface ResultadoItem {
  value: string;
  label: string;
}

interface HorarioTime {
  label: string;
  time: string;
}

interface HorarioTurno {
  title: string;
  times: HorarioTime[];
}

interface SegmentData {
  pillars?: PillarItem[];
  activities?: ActivityItem[];
  campos?: CampoItem[];
  campos_title?: string;
  differentials?: ProgramItem[];
  programa?: ProgramItem[];
  resultados?: ResultadoItem[];
  resultados_title?: string;
  horarios?: HorarioTurno[];
  horarios_title?: string;
}

interface SegmentCardItem {
  title: string;
  description: string;
  image: string;
  ages: string;
  to: string;
}

// ── Sobre types ──
interface TimelineItem { year: string; title: string; desc: string; }
interface MVVItem { icon: string; title: string; desc: string; }
interface DiferencialItem { icon: string; title: string; desc: string; }

interface SobreContent {
  historia_title?: string;
  historia_text?: string;
  timeline?: TimelineItem[];
  mvv?: MVVItem[];
  numeros_title?: string;
  numeros?: ResultadoItem[];
  diferenciais_title?: string;
  diferenciais?: DiferencialItem[];
  cta_title?: string;
  cta_subtitle?: string;
}

// ── Estrutura types ──
interface EstruturaCategoryItem { image: string; title: string; desc: string; }
interface EstruturaCategory { name: string; icon: string; items: EstruturaCategoryItem[]; }
interface EstruturaHighlight { icon: string; title: string; desc: string; }

interface EstruturaContent {
  categories?: EstruturaCategory[];
  destaques_title?: string;
  destaques?: EstruturaHighlight[];
  cta_title?: string;
  cta_subtitle?: string;
}

interface ContentState {
  home_features: FeatureItem[];
  home_infrastructure: InfraItem[];
  home_stats: StatItem[];
  home_segments: SegmentCardItem[];
  segment_educacao_infantil: SegmentData;
  segment_fundamental1: SegmentData;
  segment_fundamental2: SegmentData;
  segment_ensino_medio: SegmentData;
  page_sobre: SobreContent;
  page_estrutura: EstruturaContent;
}

type ContentKey = keyof ContentState;

const CONTENT_KEYS: ContentKey[] = [
  'home_features',
  'home_infrastructure',
  'home_stats',
  'home_segments',
  'segment_educacao_infantil',
  'segment_fundamental1',
  'segment_fundamental2',
  'segment_ensino_medio',
  'page_sobre',
  'page_estrutura',
];

const EMPTY_STATE: ContentState = {
  home_features: [],
  home_infrastructure: [],
  home_stats: [],
  home_segments: [],
  segment_educacao_infantil: { pillars: [], activities: [], campos: [], campos_title: 'Campos de Experiências', resultados: [], resultados_title: 'Nossos Números', horarios: [], horarios_title: 'Rotina Escolar' },
  segment_fundamental1: { pillars: [], differentials: [], campos: [], campos_title: 'Projetos Interdisciplinares', resultados: [], resultados_title: 'Nossos Resultados', horarios: [], horarios_title: 'Rotina Escolar' },
  segment_fundamental2: { pillars: [], programa: [], activities: [], campos: [], campos_title: 'Atividades Extracurriculares', resultados: [], resultados_title: 'Resultados Acadêmicos', horarios: [], horarios_title: 'Horários Escolares' },
  segment_ensino_medio: { pillars: [], programa: [], campos: [], campos_title: 'Projetos e Laboratórios', resultados: [], resultados_title: 'Nosso Histórico', horarios: [], horarios_title: 'Horários Escolares' },
  page_sobre: { historia_title: 'Nossa História', historia_text: '', timeline: [], mvv: [], numeros_title: 'Nossos Números', numeros: [], diferenciais_title: 'Nossos Diferenciais', diferenciais: [], cta_title: 'Venha Conhecer Nossa Escola', cta_subtitle: '' },
  page_estrutura: { categories: [], destaques_title: 'Destaques da Estrutura', destaques: [], cta_title: 'Venha Conhecer Nossa Estrutura', cta_subtitle: '' },
};

// ── Sub-tabs ────────────────────────────────────────────────────────────────
type ContentTab = 'home' | 'infantil' | 'fund1' | 'fund2' | 'medio' | 'sobre' | 'estrutura';

const SUB_TABS: { key: ContentTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'home',       label: 'Home',       icon: Home },
  { key: 'infantil',   label: 'Infantil',   icon: Baby },
  { key: 'fund1',      label: 'Fund. I',    icon: BookOpen },
  { key: 'fund2',      label: 'Fund. II',   icon: BookMarked },
  { key: 'medio',      label: 'Médio',      icon: GraduationCap },
  { key: 'sobre',      label: 'Sobre',      icon: Info },
  { key: 'estrutura',  label: 'Estrutura',  icon: Building2 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function removeAt<T>(arr: T[], idx: number): T[] {
  return arr.filter((_, i) => i !== idx);
}

// ── Panel ────────────────────────────────────────────────────────────────────
export default function ContentSettingsPanel() {
  const [state, setState] = useState<ContentState>(deepClone(EMPTY_STATE));
  const [original, setOriginal] = useState<ContentState>(deepClone(EMPTY_STATE));
  const [settingIds, setSettingIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<ContentTab>('home');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load ──
  useEffect(() => {
    supabase
      .from('system_settings')
      .select('id, key, value')
      .eq('category', 'content')
      .in('key', CONTENT_KEYS as string[])
      .then(({ data }) => {
        if (data && data.length > 0) {
          const loaded = deepClone(EMPTY_STATE);
          const ids: Record<string, string> = {};
          for (const row of data) {
            const k = row.key as ContentKey;
            if (k in loaded) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (loaded as any)[k] = row.value;
              ids[k] = row.id as string;
            }
          }
          setState(loaded);
          setOriginal(deepClone(loaded));
          setSettingIds(ids);
        }
        setLoading(false);
      });
  }, []);

  // ── Change detection ──
  const hasChanges = JSON.stringify(state) !== JSON.stringify(original);

  // ── Updaters ──
  function updateKey<K extends ContentKey>(key: K, value: ContentState[K]) {
    setState((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }

  function updateFeature(idx: number, field: keyof FeatureItem, value: string) {
    const arr = [...state.home_features];
    arr[idx] = { ...arr[idx], [field]: value };
    updateKey('home_features', arr);
  }

  function updateInfra(idx: number, field: keyof InfraItem, value: string | string[]) {
    const arr = [...state.home_infrastructure];
    arr[idx] = { ...arr[idx], [field]: value } as InfraItem;
    updateKey('home_infrastructure', arr);
  }

  function updateStat(idx: number, field: keyof StatItem, value: string) {
    const arr = [...state.home_stats];
    arr[idx] = { ...arr[idx], [field]: value };
    updateKey('home_stats', arr);
  }

  function updateHomeSegment(index: number, partial: Partial<SegmentCardItem>) {
    const arr = [...state.home_segments];
    arr[index] = { ...arr[index], ...partial };
    updateKey('home_segments', arr);
  }

  function updateSegment(segKey: ContentKey, data: SegmentData) {
    updateKey(segKey, data as ContentState[typeof segKey]);
  }

  // ── Save ──
  async function handleSave() {
    setSaving(true);
    let hasError = false;

    for (const key of CONTENT_KEYS) {
      const value = state[key];
      if (settingIds[key]) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: value as unknown as Record<string, unknown> })
          .eq('id', settingIds[key]);
        if (error) hasError = true;
      } else {
        const { data, error } = await supabase
          .from('system_settings')
          .insert({ category: 'content' as const, key, value: value as unknown as Record<string, unknown> })
          .select('id')
          .single();
        if (error) hasError = true;
        if (data) setSettingIds((ids) => ({ ...ids, [key]: (data as { id: string }).id }));
      }
    }

    setSaving(false);
    if (!hasError) {
      setOriginal(deepClone(state));
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
      logAudit({
        action: 'update',
        module: 'settings.content',
        description: 'Conteudo dinamico atualizado',
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

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
          <SettingsCard collapseId="content-features" title="Funcionalidades" icon={Star}
            description="Seção 'Por que escolher' — cards com ícone, título, descrição e estatística">
            <div className="space-y-3">
              {state.home_features.map((feat, i) => (
                <ArrayItemCard key={i} index={i + 1} onRemove={() => updateKey('home_features', removeAt(state.home_features, i))}>
                  <IconPicker label="Ícone" value={feat.icon}
                    onChange={(v) => updateFeature(i, 'icon', v)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField label="Título" value={feat.title}
                      onChange={(e) => updateFeature(i, 'title', e.target.value)} />
                    <InputField label="Estatística" value={feat.stat} placeholder="Ex: 90%+"
                      onChange={(e) => updateFeature(i, 'stat', e.target.value)}
                      hint="Número exibido em destaque" />
                  </div>
                  <TextareaField label="Descrição" value={feat.desc}
                    onChange={(e) => updateFeature(i, 'desc', e.target.value)}
                    maxLength={200} />
                  <InputField label="Label da Estatística" value={feat.statLabel}
                    placeholder="Ex: aprovação em vestibulares"
                    onChange={(e) => updateFeature(i, 'statLabel', e.target.value)} />
                </ArrayItemCard>
              ))}
            </div>
            <AddButton label="Adicionar funcionalidade" onClick={() =>
              updateKey('home_features', [...state.home_features, { icon: '', title: '', desc: '', stat: '', statLabel: '' }])
            } />
          </SettingsCard>

          <SettingsCard collapseId="content-infrastructure" title="Infraestrutura" icon={Building2}
            description="Cards de infraestrutura com ícone, título e lista de itens">
            <div className="space-y-3">
              {state.home_infrastructure.map((infra, i) => (
                <ArrayItemCard key={i} index={i + 1} onRemove={() => updateKey('home_infrastructure', removeAt(state.home_infrastructure, i))}>
                  <IconPicker label="Ícone" value={infra.icon}
                    onChange={(v) => updateInfra(i, 'icon', v)} />
                  <InputField label="Título" value={infra.title}
                    onChange={(e) => updateInfra(i, 'title', e.target.value)} />
                  <TextareaField label="Itens (um por linha)" rows={3}
                    value={infra.items.join('\n')}
                    onChange={(e) => updateInfra(i, 'items', e.target.value.split('\n'))}
                    hint="Cada linha será um bullet point" />
                </ArrayItemCard>
              ))}
            </div>
            <AddButton label="Adicionar bloco" onClick={() =>
              updateKey('home_infrastructure', [...state.home_infrastructure, { icon: '', title: '', items: [] }])
            } />
          </SettingsCard>

          <SettingsCard collapseId="content-stats" title="Estatísticas" icon={BarChart3}
            description="Números exibidos no hero da home">
            <div className="space-y-3">
              {state.home_stats.map((stat, i) => (
                <ArrayItemCard key={i} index={i + 1} onRemove={() => updateKey('home_stats', removeAt(state.home_stats, i))}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField label="Valor" value={stat.value} placeholder="Ex: 920+"
                      onChange={(e) => updateStat(i, 'value', e.target.value)} />
                    <InputField label="Label" value={stat.label} placeholder="Ex: ENEM"
                      onChange={(e) => updateStat(i, 'label', e.target.value)} />
                  </div>
                </ArrayItemCard>
              ))}
            </div>
            <AddButton label="Adicionar estatística" onClick={() =>
              updateKey('home_stats', [...state.home_stats, { value: '', label: '' }])
            } />
          </SettingsCard>

          <SettingsCard collapseId="content-home-segments" title="Cards dos Segmentos" icon={Layers}
            description="Cards exibidos na seção de segmentos da Home com imagem, título, faixa etária e link.">
            <div className="space-y-3">
              {state.home_segments.map((seg, i) => (
                <ArrayItemCard key={i} index={i + 1} onRemove={() => updateKey('home_segments', removeAt(state.home_segments, i))}>
                  <ImageField
                    label="Imagem do card"
                    value={seg.image}
                    onChange={(v) => updateHomeSegment(i, { image: v })}
                    storageKey={`home_segment_${i}`}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField
                      label="Título"
                      value={seg.title}
                      onChange={(e) => updateHomeSegment(i, { title: e.target.value })}
                      placeholder="Ex: Educação Infantil"
                      maxLength={40}
                    />
                    <InputField
                      label="Faixa etária"
                      value={seg.ages}
                      onChange={(e) => updateHomeSegment(i, { ages: e.target.value })}
                      placeholder="Ex: 2 a 5 anos"
                      maxLength={20}
                    />
                  </div>
                  <InputField
                    label="Descrição curta"
                    value={seg.description}
                    onChange={(e) => updateHomeSegment(i, { description: e.target.value })}
                    placeholder="Ex: Desenvolvimento integral da criança"
                    maxLength={80}
                  />
                  <InputField
                    label="Link (rota)"
                    value={seg.to}
                    onChange={(e) => updateHomeSegment(i, { to: e.target.value })}
                    placeholder="Ex: /educacao-infantil"
                    hint="Caminho da página que o card abre ao ser clicado"
                    maxLength={60}
                  />
                </ArrayItemCard>
              ))}
            </div>
            <AddButton label="Adicionar segmento" onClick={() =>
              updateKey('home_segments', [...state.home_segments, { title: '', description: '', image: '', ages: '', to: '' }])
            } />
          </SettingsCard>
        </>
      )}

      {/* ── Educacao Infantil ── */}
      {activeTab === 'infantil' && (
        <>
          <SegmentCard
            collapseId="content-seg-infantil"
            title="Educacao Infantil"
            icon={Baby}
            segKey="segment_educacao_infantil"
            data={state.segment_educacao_infantil}
            onChange={(d) => updateSegment('segment_educacao_infantil', d)}
          />
          <CamposSettingsCard
            collapseId="content-campos-infantil"
            data={state.segment_educacao_infantil}
            onChange={(d) => updateSegment('segment_educacao_infantil', d)}
          />
        </>
      )}

      {/* ── Ensino Fundamental I ── */}
      {activeTab === 'fund1' && (
        <>
          <SegmentCard
            collapseId="content-seg-fund1"
            title="Ensino Fundamental I"
            icon={BookOpen}
            segKey="segment_fundamental1"
            data={state.segment_fundamental1}
            onChange={(d) => updateSegment('segment_fundamental1', d)}
          />
          <CamposSettingsCard
            collapseId="content-campos-fund1"
            data={state.segment_fundamental1}
            onChange={(d) => updateSegment('segment_fundamental1', d)}
          />
        </>
      )}

      {/* ── Ensino Fundamental II ── */}
      {activeTab === 'fund2' && (
        <>
          <SegmentCard
            collapseId="content-seg-fund2"
            title="Ensino Fundamental II"
            icon={BookMarked}
            segKey="segment_fundamental2"
            data={state.segment_fundamental2}
            onChange={(d) => updateSegment('segment_fundamental2', d)}
          />
          <CamposSettingsCard
            collapseId="content-campos-fund2"
            data={state.segment_fundamental2}
            onChange={(d) => updateSegment('segment_fundamental2', d)}
          />
        </>
      )}

      {/* ── Ensino Medio ── */}
      {activeTab === 'medio' && (
        <>
          <SegmentCard
            collapseId="content-seg-medio"
            title="Ensino Medio"
            icon={GraduationCap}
            segKey="segment_ensino_medio"
            data={state.segment_ensino_medio}
            onChange={(d) => updateSegment('segment_ensino_medio', d)}
          />
          <CamposSettingsCard
            collapseId="content-campos-medio"
            data={state.segment_ensino_medio}
            onChange={(d) => updateSegment('segment_ensino_medio', d)}
          />
        </>
      )}

      {/* ── Sobre ── */}
      {activeTab === 'sobre' && (
        <SobreContentEditor
          data={state.page_sobre}
          onChange={(d) => updateKey('page_sobre', d)}
        />
      )}

      {/* ── Estrutura ── */}
      {activeTab === 'estrutura' && (
        <EstruturaContentEditor
          data={state.page_estrutura}
          onChange={(d) => updateKey('page_estrutura', d)}
        />
      )}

      {/* ── Floating save ── */}
      <div className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
        hasChanges || saving || saved ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-brand-primary/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ── Segment Card ─────────────────────────────────────────────────────────────

interface SegmentCardProps {
  collapseId: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  segKey: string;
  data: SegmentData;
  onChange: (data: SegmentData) => void;
}

function SegmentCard({ collapseId, title, icon, data, onChange }: SegmentCardProps) {
  const pillars = data.pillars ?? [];
  const activities = data.activities ?? [];
  const differentials = data.differentials ?? [];
  const programa = data.programa ?? [];
  const resultados = data.resultados ?? [];
  const horarios = data.horarios ?? [];

  // ── Pillar helpers ──
  function updatePillar(idx: number, field: keyof PillarItem, value: string) {
    const arr = [...pillars];
    arr[idx] = { ...arr[idx], [field]: value };
    onChange({ ...data, pillars: arr });
  }
  function removePillar(idx: number) {
    onChange({ ...data, pillars: removeAt(pillars, idx) });
  }
  function addPillar() {
    onChange({ ...data, pillars: [...pillars, { icon: '', title: '', desc: '', stat: '', statLabel: '' }] });
  }

  // ── Activity helpers ──
  function updateActivity(idx: number, field: keyof ActivityItem, value: string) {
    const arr = [...activities];
    arr[idx] = { ...arr[idx], [field]: value };
    onChange({ ...data, activities: arr });
  }
  function removeActivity(idx: number) {
    onChange({ ...data, activities: removeAt(activities, idx) });
  }
  function addActivity() {
    onChange({ ...data, activities: [...activities, { icon: '', title: '', desc: '' }] });
  }

  // ── Program / Differentials helpers ──
  const programKey = differentials.length > 0 ? 'differentials' : 'programa';
  const programList = differentials.length > 0 ? differentials : programa;

  function updateProgram(idx: number, field: string, value: string | string[]) {
    const arr = [...programList];
    arr[idx] = { ...arr[idx], [field]: value } as ProgramItem;
    onChange({ ...data, [programKey]: arr });
  }
  function removeProgram(idx: number) {
    onChange({ ...data, [programKey]: removeAt(programList, idx) });
  }
  function addProgram() {
    onChange({ ...data, [programKey]: [...programList, { icon: '', title: '', items: [] }] });
  }

  // ── Resultado helpers ──
  function updateResultado(idx: number, field: keyof ResultadoItem, value: string) {
    const arr = [...resultados];
    arr[idx] = { ...arr[idx], [field]: value };
    onChange({ ...data, resultados: arr });
  }
  function removeResultado(idx: number) {
    onChange({ ...data, resultados: removeAt(resultados, idx) });
  }
  function addResultado() {
    onChange({ ...data, resultados: [...resultados, { value: '', label: '' }] });
  }

  // ── Horario helpers ──
  function updateHorarioTitle(idx: number, value: string) {
    const arr = [...horarios];
    arr[idx] = { ...arr[idx], title: value };
    onChange({ ...data, horarios: arr });
  }
  function updateHorarioTime(turnoIdx: number, timeIdx: number, field: keyof HorarioTime, value: string) {
    const arr = [...horarios];
    const times = [...arr[turnoIdx].times];
    times[timeIdx] = { ...times[timeIdx], [field]: value };
    arr[turnoIdx] = { ...arr[turnoIdx], times };
    onChange({ ...data, horarios: arr });
  }
  function addHorarioTime(turnoIdx: number) {
    const arr = [...horarios];
    arr[turnoIdx] = { ...arr[turnoIdx], times: [...arr[turnoIdx].times, { label: '', time: '' }] };
    onChange({ ...data, horarios: arr });
  }
  function removeHorarioTime(turnoIdx: number, timeIdx: number) {
    const arr = [...horarios];
    arr[turnoIdx] = { ...arr[turnoIdx], times: removeAt(arr[turnoIdx].times, timeIdx) };
    onChange({ ...data, horarios: arr });
  }
  function removeHorario(idx: number) {
    onChange({ ...data, horarios: removeAt(horarios, idx) });
  }
  function addHorario() {
    onChange({ ...data, horarios: [...horarios, { title: '', times: [{ label: '', time: '' }] }] });
  }

  const hasProgram = programList.length > 0;

  return (
    <SettingsCard collapseId={collapseId} title={title} icon={icon}>
      {/* ── Pilares ── */}
      <SectionLabel>Pilares</SectionLabel>
      <div className="space-y-3">
        {pillars.map((p, i) => (
          <ArrayItemCard key={i} index={i + 1} onRemove={() => removePillar(i)}>
            <IconPicker label="Ícone" value={p.icon}
              onChange={(v) => updatePillar(i, 'icon', v)} />
            <InputField label="Título" value={p.title}
              onChange={(e) => updatePillar(i, 'title', e.target.value)} />
            <TextareaField label="Descrição" value={p.desc}
              onChange={(e) => updatePillar(i, 'desc', e.target.value)}
              maxLength={200} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField label="Estatística" value={p.stat} placeholder="Ex: 100%"
                onChange={(e) => updatePillar(i, 'stat', e.target.value)} />
              <InputField label="Label da Estatística" value={p.statLabel}
                onChange={(e) => updatePillar(i, 'statLabel', e.target.value)} />
            </div>
          </ArrayItemCard>
        ))}
      </div>
      <AddButton label="Adicionar pilar" onClick={addPillar} />

      {/* ── Atividades ── */}
      {(activities.length > 0 || !hasProgram) && (
        <>
          <SectionDivider />
          <SectionLabel>Atividades</SectionLabel>
          <div className="space-y-3">
            {activities.map((a, i) => (
              <ArrayItemCard key={i} index={i + 1} onRemove={() => removeActivity(i)}>
                <IconPicker label="Ícone" value={a.icon}
                  onChange={(v) => updateActivity(i, 'icon', v)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField label="Título" value={a.title}
                    onChange={(e) => updateActivity(i, 'title', e.target.value)} />
                  <InputField label="Descrição" value={a.desc}
                    onChange={(e) => updateActivity(i, 'desc', e.target.value)} />
                </div>
              </ArrayItemCard>
            ))}
          </div>
          <AddButton label="Adicionar atividade" onClick={addActivity} />
        </>
      )}

      {/* ── Programa / Diferenciais ── */}
      {(hasProgram || differentials.length > 0) && (
        <>
          <SectionDivider />
          <SectionLabel>{differentials.length > 0 ? 'Diferenciais' : 'Programa'}</SectionLabel>
          <div className="space-y-3">
            {programList.map((p, i) => (
              <ArrayItemCard key={i} index={i + 1} onRemove={() => removeProgram(i)}>
                <IconPicker label="Ícone" value={p.icon}
                  onChange={(v) => updateProgram(i, 'icon', v)} />
                <InputField label="Título" value={p.title}
                  onChange={(e) => updateProgram(i, 'title', e.target.value)} />
                <TextareaField label="Itens (um por linha)" rows={3}
                  value={p.items.join('\n')}
                  onChange={(e) => updateProgram(i, 'items', e.target.value.split('\n'))}
                  hint="Cada linha será um bullet point" />
              </ArrayItemCard>
            ))}
          </div>
          <AddButton label={`Adicionar ${differentials.length > 0 ? 'diferencial' : 'bloco do programa'}`} onClick={addProgram} />
        </>
      )}

      {/* ── Resultados / Estatísticas em destaque ── */}
      <SectionDivider />
      <SectionLabel>Resultados em Destaque</SectionLabel>
      <InputField
        label="Título da seção"
        value={data.resultados_title ?? ''}
        onChange={(e) => onChange({ ...data, resultados_title: e.target.value })}
        placeholder="Ex: Nosso Histórico"
        hint="Título exibido no banner de resultados da página pública. Aparece sobre fundo azul escuro."
        maxLength={60}
      />
      <div className="space-y-3">
        {resultados.map((r, i) => (
          <ArrayItemCard key={i} index={i + 1} onRemove={() => removeResultado(i)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField label="Valor" value={r.value} placeholder="Ex: 90%+"
                onChange={(e) => updateResultado(i, 'value', e.target.value)}
                maxLength={10} />
              <InputField label="Descrição" value={r.label} placeholder="Ex: Aprovação em vestibulares"
                onChange={(e) => updateResultado(i, 'label', e.target.value)}
                maxLength={40} />
            </div>
          </ArrayItemCard>
        ))}
      </div>
      <AddButton label="Adicionar resultado" onClick={addResultado} />

      {/* ── Horarios ── */}
      <SectionDivider />
      <SectionLabel>Horários</SectionLabel>
      <InputField
        label="Título da seção"
        value={data.horarios_title ?? ''}
        onChange={(e) => onChange({ ...data, horarios_title: e.target.value })}
        placeholder="Ex: Horários Escolares"
        hint="Título exibido na seção de horários da página pública."
        maxLength={40}
      />
      <div className="space-y-3">
        {horarios.map((turno, ti) => (
          <ArrayItemCard key={ti} index={ti + 1} onRemove={() => removeHorario(ti)}>
            <InputField label="Nome do Turno" value={turno.title} placeholder="Ex: Turno Matutino"
              onChange={(e) => updateHorarioTitle(ti, e.target.value)} />
            <div className="space-y-2 mt-2">
              {turno.times.map((t, hi) => (
                <div key={hi} className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <InputField label="Label" value={t.label} placeholder="Ex: Entrada"
                      onChange={(e) => updateHorarioTime(ti, hi, 'label', e.target.value)} />
                    <InputField label="Horário" value={t.time} placeholder="Ex: 7h00"
                      onChange={(e) => updateHorarioTime(ti, hi, 'time', e.target.value)} />
                  </div>
                  <button type="button" className="mt-5 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    onClick={() => removeHorarioTime(ti, hi)} title="Remover horário">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              <button type="button"
                className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium mt-1"
                onClick={() => addHorarioTime(ti)}>
                + Adicionar horário
              </button>
            </div>
          </ArrayItemCard>
        ))}
      </div>
      <AddButton label="Adicionar turno" onClick={addHorario} />
    </SettingsCard>
  );
}

// ── Campos / Seção de Imagens (card separado) ────────────────────────────────

interface CamposSettingsCardProps {
  collapseId: string;
  data: SegmentData;
  onChange: (data: SegmentData) => void;
}

function CamposSettingsCard({ collapseId, data, onChange }: CamposSettingsCardProps) {
  const campos = data.campos ?? [];

  function updateCampo(idx: number, field: keyof CampoItem, value: string) {
    const arr = [...campos];
    arr[idx] = { ...arr[idx], [field]: value };
    onChange({ ...data, campos: arr });
  }
  function removeCampo(idx: number) {
    onChange({ ...data, campos: removeAt(campos, idx) });
  }
  function addCampo() {
    onChange({ ...data, campos: [...campos, { img: '', title: '', desc: '' }] });
  }

  return (
    <SettingsCard collapseId={collapseId} title="Seção de Imagens" icon={ImageIcon}
      description="Cards com imagem, título e descrição exibidos na página pública deste segmento.">
      <InputField
        label="Título da seção"
        value={data.campos_title ?? ''}
        onChange={(e) => onChange({ ...data, campos_title: e.target.value })}
        placeholder="Ex: Campos de Experiências"
        hint="Nome exibido como título desta seção na página pública. Cada segmento pode ter um nome diferente."
        maxLength={60}
      />
      <div className="space-y-3">
        {campos.map((c, i) => (
          <ArrayItemCard key={i} index={i + 1} onRemove={() => removeCampo(i)}>
            <ImageField
              label="Imagem"
              value={c.img}
              onChange={(url) => updateCampo(i, 'img', url)}
              storageKey={`content_campo_${collapseId}_${i}`}
              hint="Recomendado: 600×800px, proporção 3:4 (retrato)"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField label="Título" value={c.title}
                onChange={(e) => updateCampo(i, 'title', e.target.value)} />
              <InputField label="Descrição" value={c.desc}
                onChange={(e) => updateCampo(i, 'desc', e.target.value)}
                maxLength={120} />
            </div>
          </ArrayItemCard>
        ))}
      </div>
      <AddButton label="Adicionar card" onClick={addCampo} />
    </SettingsCard>
  );
}

// ── Sobre Content Editor ────────────────────────────────────────────────────

function SobreContentEditor({ data, onChange }: { data: SobreContent; onChange: (d: SobreContent) => void }) {
  const timeline = data.timeline ?? [];
  const mvv = data.mvv ?? [];
  const numeros = data.numeros ?? [];
  const diferenciais = data.diferenciais ?? [];

  return (
    <>
      {/* ── História ── */}
      <SettingsCard collapseId="content-sobre-historia" title="História" icon={Milestone}
        description="Linha do tempo com marcos da história da instituição.">
        <InputField label="Título da seção" value={data.historia_title ?? ''}
          onChange={(e) => onChange({ ...data, historia_title: e.target.value })}
          placeholder="Ex: Nossa História" maxLength={60} />
        <TextareaField label="Texto introdutório" value={data.historia_text ?? ''}
          onChange={(e) => onChange({ ...data, historia_text: e.target.value })}
          hint="Parágrafo exibido antes da linha do tempo." rows={3} />
        <SectionDivider />
        <SectionLabel>Linha do Tempo</SectionLabel>
        <div className="space-y-3">
          {timeline.map((item, i) => (
            <ArrayItemCard key={i} index={i + 1} onRemove={() => onChange({ ...data, timeline: removeAt(timeline, i) })}>
              <InputField label="Ano" value={item.year}
                onChange={(e) => { const arr = [...timeline]; arr[i] = { ...arr[i], year: e.target.value }; onChange({ ...data, timeline: arr }); }}
                placeholder="Ex: 2003" maxLength={10} />
              <InputField label="Título" value={item.title}
                onChange={(e) => { const arr = [...timeline]; arr[i] = { ...arr[i], title: e.target.value }; onChange({ ...data, timeline: arr }); }}
                placeholder="Ex: Fundação" />
              <TextareaField label="Descrição" value={item.desc}
                onChange={(e) => { const arr = [...timeline]; arr[i] = { ...arr[i], desc: e.target.value }; onChange({ ...data, timeline: arr }); }}
                maxLength={300} rows={2} />
            </ArrayItemCard>
          ))}
        </div>
        <AddButton label="Adicionar marco" onClick={() =>
          onChange({ ...data, timeline: [...timeline, { year: '', title: '', desc: '' }] })
        } />
      </SettingsCard>

      {/* ── Missão, Visão e Valores ── */}
      <SettingsCard collapseId="content-sobre-mvv" title="Missão, Visão e Valores" icon={Target}
        description="Cards com ícone, título e descrição (recomendado: 3 cards).">
        <div className="space-y-3">
          {mvv.map((item, i) => (
            <ArrayItemCard key={i} index={i + 1} onRemove={() => onChange({ ...data, mvv: removeAt(mvv, i) })}>
              <IconPicker label="Ícone" value={item.icon}
                onChange={(v) => { const arr = [...mvv]; arr[i] = { ...arr[i], icon: v }; onChange({ ...data, mvv: arr }); }} />
              <InputField label="Título" value={item.title}
                onChange={(e) => { const arr = [...mvv]; arr[i] = { ...arr[i], title: e.target.value }; onChange({ ...data, mvv: arr }); }}
                placeholder="Ex: Missão" />
              <TextareaField label="Descrição" value={item.desc}
                onChange={(e) => { const arr = [...mvv]; arr[i] = { ...arr[i], desc: e.target.value }; onChange({ ...data, mvv: arr }); }}
                maxLength={300} rows={3} />
            </ArrayItemCard>
          ))}
        </div>
        <AddButton label="Adicionar card" onClick={() =>
          onChange({ ...data, mvv: [...mvv, { icon: '', title: '', desc: '' }] })
        } />
      </SettingsCard>

      {/* ── Números ── */}
      <SettingsCard collapseId="content-sobre-numeros" title="Números" icon={BarChart3}
        description="Estatísticas exibidas em destaque (fundo azul escuro).">
        <InputField label="Título da seção" value={data.numeros_title ?? ''}
          onChange={(e) => onChange({ ...data, numeros_title: e.target.value })}
          placeholder="Ex: Nossos Números" maxLength={60} />
        <div className="space-y-3">
          {numeros.map((item, i) => (
            <ArrayItemCard key={i} index={i + 1} onRemove={() => onChange({ ...data, numeros: removeAt(numeros, i) })}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField label="Valor" value={item.value} placeholder="Ex: 20+"
                  onChange={(e) => { const arr = [...numeros]; arr[i] = { ...arr[i], value: e.target.value }; onChange({ ...data, numeros: arr }); }}
                  maxLength={10} />
                <InputField label="Descrição" value={item.label} placeholder="Ex: Anos de experiência"
                  onChange={(e) => { const arr = [...numeros]; arr[i] = { ...arr[i], label: e.target.value }; onChange({ ...data, numeros: arr }); }}
                  maxLength={40} />
              </div>
            </ArrayItemCard>
          ))}
        </div>
        <AddButton label="Adicionar número" onClick={() =>
          onChange({ ...data, numeros: [...numeros, { value: '', label: '' }] })
        } />
      </SettingsCard>

      {/* ── Diferenciais ── */}
      <SettingsCard collapseId="content-sobre-diferenciais" title="Diferenciais" icon={Award}
        description="Cards com ícone, título e descrição dos diferenciais da escola.">
        <InputField label="Título da seção" value={data.diferenciais_title ?? ''}
          onChange={(e) => onChange({ ...data, diferenciais_title: e.target.value })}
          placeholder="Ex: Nossos Diferenciais" maxLength={60} />
        <div className="space-y-3">
          {diferenciais.map((item, i) => (
            <ArrayItemCard key={i} index={i + 1} onRemove={() => onChange({ ...data, diferenciais: removeAt(diferenciais, i) })}>
              <IconPicker label="Ícone" value={item.icon}
                onChange={(v) => { const arr = [...diferenciais]; arr[i] = { ...arr[i], icon: v }; onChange({ ...data, diferenciais: arr }); }} />
              <InputField label="Título" value={item.title}
                onChange={(e) => { const arr = [...diferenciais]; arr[i] = { ...arr[i], title: e.target.value }; onChange({ ...data, diferenciais: arr }); }} />
              <TextareaField label="Descrição" value={item.desc}
                onChange={(e) => { const arr = [...diferenciais]; arr[i] = { ...arr[i], desc: e.target.value }; onChange({ ...data, diferenciais: arr }); }}
                maxLength={200} rows={2} />
            </ArrayItemCard>
          ))}
        </div>
        <AddButton label="Adicionar diferencial" onClick={() =>
          onChange({ ...data, diferenciais: [...diferenciais, { icon: '', title: '', desc: '' }] })
        } />
      </SettingsCard>

      {/* ── CTA ── */}
      <SettingsCard collapseId="content-sobre-cta" title="CTA (Chamada Final)" icon={BookHeart}
        description="Título e subtítulo da seção de chamada para ação no final da página.">
        <InputField label="Título" value={data.cta_title ?? ''}
          onChange={(e) => onChange({ ...data, cta_title: e.target.value })}
          placeholder="Ex: Venha Conhecer Nossa Escola" maxLength={80} />
        <TextareaField label="Subtítulo" value={data.cta_subtitle ?? ''}
          onChange={(e) => onChange({ ...data, cta_subtitle: e.target.value })}
          rows={2} maxLength={200} />
      </SettingsCard>
    </>
  );
}

// ── Estrutura Content Editor ────────────────────────────────────────────────

function EstruturaContentEditor({ data, onChange }: { data: EstruturaContent; onChange: (d: EstruturaContent) => void }) {
  const categories = data.categories ?? [];
  const destaques = data.destaques ?? [];

  // ── Category helpers ──
  function updateCategory(idx: number, partial: Partial<EstruturaCategory>) {
    const arr = [...categories];
    arr[idx] = { ...arr[idx], ...partial };
    onChange({ ...data, categories: arr });
  }
  function removeCategory(idx: number) {
    onChange({ ...data, categories: removeAt(categories, idx) });
  }
  function addCategory() {
    onChange({ ...data, categories: [...categories, { name: '', icon: '', items: [] }] });
  }

  // ── Item helpers (within a category) ──
  function updateCategoryItem(catIdx: number, itemIdx: number, partial: Partial<EstruturaCategoryItem>) {
    const arr = [...categories];
    const items = [...arr[catIdx].items];
    items[itemIdx] = { ...items[itemIdx], ...partial };
    arr[catIdx] = { ...arr[catIdx], items };
    onChange({ ...data, categories: arr });
  }
  function removeCategoryItem(catIdx: number, itemIdx: number) {
    const arr = [...categories];
    arr[catIdx] = { ...arr[catIdx], items: removeAt(arr[catIdx].items, itemIdx) };
    onChange({ ...data, categories: arr });
  }
  function addCategoryItem(catIdx: number) {
    const arr = [...categories];
    arr[catIdx] = { ...arr[catIdx], items: [...arr[catIdx].items, { image: '', title: '', desc: '' }] };
    onChange({ ...data, categories: arr });
  }

  return (
    <>
      {/* ── Galeria de Espaços ── */}
      <SettingsCard collapseId="content-estrutura-gallery" title="Galeria de Espaços" icon={ImageIcon}
        description="Categorias com imagens dos espaços da escola. Cada categoria agrupa fotos relacionadas.">
        <div className="space-y-4">
          {categories.map((cat, ci) => (
            <ArrayItemCard key={ci} index={ci + 1} onRemove={() => removeCategory(ci)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField label="Nome da categoria" value={cat.name}
                  onChange={(e) => updateCategory(ci, { name: e.target.value })}
                  placeholder="Ex: Salas de Aula" />
                <IconPicker label="Ícone" value={cat.icon}
                  onChange={(v) => updateCategory(ci, { icon: v })} />
              </div>

              <SectionDivider />
              <SectionLabel>Fotos desta categoria</SectionLabel>
              <div className="space-y-3">
                {cat.items.map((item, ii) => (
                  <div key={ii} className="relative bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                    <button type="button"
                      className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      onClick={() => removeCategoryItem(ci, ii)} title="Remover foto">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <ImageField
                      label={`Foto ${ii + 1}`}
                      value={item.image}
                      onChange={(url) => updateCategoryItem(ci, ii, { image: url })}
                      storageKey={`estrutura_cat${ci}_item${ii}`}
                      hint="Recomendado: 800×600px, proporção 4:3 (paisagem)"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <InputField label="Título" value={item.title}
                        onChange={(e) => updateCategoryItem(ci, ii, { title: e.target.value })}
                        placeholder="Ex: Sala de Robótica" />
                      <InputField label="Descrição" value={item.desc}
                        onChange={(e) => updateCategoryItem(ci, ii, { desc: e.target.value })}
                        placeholder="Ex: Equipada com kits LEGO Education"
                        maxLength={120} />
                    </div>
                  </div>
                ))}
              </div>
              <button type="button"
                className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium mt-2"
                onClick={() => addCategoryItem(ci)}>
                + Adicionar foto
              </button>
            </ArrayItemCard>
          ))}
        </div>
        <AddButton label="Adicionar categoria" onClick={addCategory} />
      </SettingsCard>

      {/* ── Destaques ── */}
      <SettingsCard collapseId="content-estrutura-destaques" title="Destaques" icon={Star}
        description="Cards de destaque exibidos abaixo da galeria (ícone, título, descrição).">
        <InputField label="Título da seção" value={data.destaques_title ?? ''}
          onChange={(e) => onChange({ ...data, destaques_title: e.target.value })}
          placeholder="Ex: Destaques da Estrutura" maxLength={60} />
        <div className="space-y-3">
          {destaques.map((item, i) => (
            <ArrayItemCard key={i} index={i + 1} onRemove={() => onChange({ ...data, destaques: removeAt(destaques, i) })}>
              <IconPicker label="Ícone" value={item.icon}
                onChange={(v) => { const arr = [...destaques]; arr[i] = { ...arr[i], icon: v }; onChange({ ...data, destaques: arr }); }} />
              <InputField label="Título" value={item.title}
                onChange={(e) => { const arr = [...destaques]; arr[i] = { ...arr[i], title: e.target.value }; onChange({ ...data, destaques: arr }); }} />
              <TextareaField label="Descrição" value={item.desc}
                onChange={(e) => { const arr = [...destaques]; arr[i] = { ...arr[i], desc: e.target.value }; onChange({ ...data, destaques: arr }); }}
                maxLength={200} rows={2} />
            </ArrayItemCard>
          ))}
        </div>
        <AddButton label="Adicionar destaque" onClick={() =>
          onChange({ ...data, destaques: [...destaques, { icon: '', title: '', desc: '' }] })
        } />
      </SettingsCard>

      {/* ── CTA ── */}
      <SettingsCard collapseId="content-estrutura-cta" title="CTA (Chamada Final)" icon={BookHeart}
        description="Título e subtítulo da chamada para ação no final da página.">
        <InputField label="Título" value={data.cta_title ?? ''}
          onChange={(e) => onChange({ ...data, cta_title: e.target.value })}
          placeholder="Ex: Venha Conhecer Nossa Estrutura" maxLength={80} />
        <TextareaField label="Subtítulo" value={data.cta_subtitle ?? ''}
          onChange={(e) => onChange({ ...data, cta_subtitle: e.target.value })}
          rows={2} maxLength={200} />
      </SettingsCard>
    </>
  );
}

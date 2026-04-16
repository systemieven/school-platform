/**
 * AcademicoSettingsPanel
 *
 * Painel da aba "Acadêmico" em /admin/configuracoes.
 * 3 seções: Períodos Letivos, Fórmula de Média, Alertas de Frequência.
 *
 * v2 changes:
 * - Section A: icon buttons (Bimestre / Trimestre / Semestre) + inline CRUD for periods
 * - Section B: inline CRUD list — one row per segment, expand to edit/create formula
 * - Section C: custom range sliders (bordered circle thumb) + standard system toggle button
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import {
  CalendarDays, Calendar, CalendarRange,
  Calculator, Bell, Loader2, Save, Check,
  Plus, Trash2, ChevronUp, Pencil, HeartPulse,
  GraduationCap, BookOpen, BookOpenCheck, Baby,
} from 'lucide-react';

// ── Segment icon map ─────────────────────────────────────────────────────────

function getSegmentIcon(name: string): React.ComponentType<{ className?: string }> {
  const n = name.toLowerCase();
  if (n.includes('infantil'))                                return Baby;
  if ((n.includes('fundamental') && n.includes(' i') && !n.includes('ii')) ||
      n.includes('fundamental 1'))                          return BookOpen;
  if (n.includes('fundamental ii') || n.includes('fundamental 2')) return BookOpenCheck;
  if (n.includes('médio') || n.includes('medio'))           return GraduationCap;
  return GraduationCap;
}

// ── Types ───────────────────────────────────────────────────────────────────

type PeriodType = 'bimestre' | 'trimestre' | 'semestre';

interface PeriodDate {
  period: number;
  start_date: string;
  end_date: string;
}

interface FormulaRow {
  segment_id: string;
  school_year: number;
  formula_type: string;
  config: Record<string, unknown>;
  passing_grade: number;
  recovery_grade: number;
  min_attendance_pct: number;
  grade_scale: string;
}

interface Segment {
  id: string;
  name: string;
}

const PERIOD_LABEL: Record<PeriodType, string> = {
  bimestre: 'Bimestre',
  trimestre: 'Trimestre',
  semestre: 'Semestre',
};

function defaultFormula(segId: string): FormulaRow {
  return {
    segment_id: segId,
    school_year: new Date().getFullYear(),
    formula_type: 'simple',
    config: {},
    passing_grade: 7,
    recovery_grade: 5,
    min_attendance_pct: 75,
    grade_scale: 'numeric',
  };
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AcademicoSettingsPanel() {
  const [loading, setLoading] = useState(true);

  // ── A. Períodos Letivos
  const [periodType, setPeriodType]         = useState<PeriodType>('bimestre');
  const [periodDates, setPeriodDates]       = useState<PeriodDate[]>([]);
  const [initialPeriodType, setInitialPeriodType] = useState<PeriodType>('bimestre');
  const [initialPeriodDates, setInitialPeriodDates] = useState('[]');

  // ── B. Fórmula de Média — inline CRUD
  const [segments, setSegments]             = useState<Segment[]>([]);
  const [formulaRows, setFormulaRows]       = useState<FormulaRow[]>([]);
  const [expandedSegId, setExpandedSegId]   = useState<string | null>(null);
  const [formulaDraft, setFormulaDraft]     = useState<FormulaRow | null>(null);
  const [formulaSaving, setFormulaSaving]   = useState(false);
  const [formulaSaved, setFormulaSaved]     = useState<string | null>(null);
  const [formulaError, setFormulaError]     = useState('');

  // ── C. Alertas de Frequência
  const [warningThreshold, setWarningThreshold]   = useState('80');
  const [criticalThreshold, setCriticalThreshold] = useState('75');
  const [autoWhatsApp, setAutoWhatsApp]           = useState(false);
  const [initialWarning, setInitialWarning]   = useState('80');
  const [initialCritical, setInitialCritical] = useState('75');
  const [initialAutoWa, setInitialAutoWa]     = useState(false);

  // ── D. Ficha de Saúde
  const [healthCertSegments, setHealthCertSegments]   = useState<string[]>([]);
  const [healthAlertDays, setHealthAlertDays]         = useState(30);
  const [healthAllowGuardianUpdates, setHealthAllowGuardianUpdates] = useState(true);
  const [healthRequiredFields, setHealthRequiredFields] = useState<string[]>(['blood_type']);
  const [initialHealthCertSegments, setInitialHealthCertSegments] = useState('[]');
  const [initialHealthAlertDays, setInitialHealthAlertDays]       = useState(30);
  const [initialHealthAllowGuardian, setInitialHealthAllowGuardian] = useState(true);
  const [initialHealthRequiredFields, setInitialHealthRequiredFields] = useState('["blood_type"]');
  // ── Global save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const hasChanges =
    periodType !== initialPeriodType ||
    JSON.stringify(periodDates) !== initialPeriodDates ||
    warningThreshold !== initialWarning ||
    criticalThreshold !== initialCritical ||
    autoWhatsApp !== initialAutoWa ||
    JSON.stringify(healthCertSegments) !== initialHealthCertSegments ||
    healthAlertDays !== initialHealthAlertDays ||
    healthAllowGuardianUpdates !== initialHealthAllowGuardian ||
    JSON.stringify(healthRequiredFields) !== initialHealthRequiredFields;

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);

    const [settingsRes, segmentsRes] = await Promise.all([
      supabase.from('system_settings').select('*').eq('category', 'academico'),
      supabase.from('school_segments').select('id, name').eq('is_active', true).order('position'),
    ]);

    const ss   = (settingsRes.data ?? []) as { key: string; value: string }[];
    const segs = (segmentsRes.data ?? []) as Segment[];
    setSegments(segs);

    // Period type
    const pt = (ss.find((s) => s.key === 'period_type')?.value || 'bimestre') as PeriodType;
    setPeriodType(pt);
    setInitialPeriodType(pt);

    // Period dates
    let dates: PeriodDate[] = [];
    const datesRaw = ss.find((s) => s.key === 'period_dates');
    if (datesRaw) {
      try { dates = JSON.parse(datesRaw.value) as PeriodDate[]; } catch { /* keep empty */ }
    }
    setPeriodDates(dates);
    setInitialPeriodDates(JSON.stringify(dates));

    // Alerts
    const warn   = ss.find((s) => s.key === 'alert_warning_pct')?.value  || '80';
    const crit   = ss.find((s) => s.key === 'alert_critical_pct')?.value || '75';
    const autoWa = ss.find((s) => s.key === 'alert_auto_whatsapp')?.value === 'true';
    setWarningThreshold(warn);
    setCriticalThreshold(crit);
    setAutoWhatsApp(autoWa);
    setInitialWarning(warn);
    setInitialCritical(crit);
    setInitialAutoWa(autoWa);

    // Health settings
    const hCertSegsRaw = ss.find((s) => s.key === 'health.require_certificate_segments')?.value ?? '[]';
    const hAlertDays   = Number(ss.find((s) => s.key === 'health.certificate_alert_days')?.value ?? '30');
    const hAllowGuard  = ss.find((s) => s.key === 'health.allow_guardian_updates')?.value !== 'false';
    const hReqFields   = ss.find((s) => s.key === 'health.required_fields')?.value ?? '["blood_type"]';
    let parsedCertSegs: string[] = [];
    let parsedReqFields: string[] = ['blood_type'];
    try { parsedCertSegs  = JSON.parse(hCertSegsRaw) as string[]; } catch { /* keep empty */ }
    try { parsedReqFields = JSON.parse(hReqFields) as string[]; }   catch { /* keep default */ }
    setHealthCertSegments(parsedCertSegs);
    setHealthAlertDays(hAlertDays);
    setHealthAllowGuardianUpdates(hAllowGuard);
    setHealthRequiredFields(parsedReqFields);
    setInitialHealthCertSegments(JSON.stringify(parsedCertSegs));
    setInitialHealthAlertDays(hAlertDays);
    setInitialHealthAllowGuardian(hAllowGuard);
    setInitialHealthRequiredFields(JSON.stringify(parsedReqFields));

    // Formulas — load all for current year
    if (segs.length) {
      const year = new Date().getFullYear();
      const { data: fData } = await supabase
        .from('grade_formulas')
        .select('*')
        .in('segment_id', segs.map((s) => s.id))
        .eq('school_year', year);

      setFormulaRows((fData ?? []).map((d) => ({
        segment_id:       d.segment_id as string,
        school_year:      d.school_year as number,
        formula_type:     d.formula_type as string,
        config:           (d.config as Record<string, unknown>) ?? {},
        passing_grade:    Number(d.passing_grade),
        recovery_grade:   Number(d.recovery_grade),
        min_attendance_pct: Number(d.min_attendance_pct),
        grade_scale:      d.grade_scale as string,
      })));
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Period helpers ─────────────────────────────────────────────────────────

  function addPeriod() {
    setPeriodDates((prev) => [
      ...prev,
      { period: prev.length + 1, start_date: '', end_date: '' },
    ]);
  }

  function removePeriod(idx: number) {
    setPeriodDates((prev) =>
      prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, period: i + 1 })),
    );
  }

  function updatePeriodDate(idx: number, field: 'start_date' | 'end_date', value: string) {
    setPeriodDates((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  // ── Formula helpers ────────────────────────────────────────────────────────

  function toggleFormulaRow(segId: string) {
    if (expandedSegId === segId) {
      setExpandedSegId(null);
      setFormulaDraft(null);
      setFormulaError('');
      return;
    }
    const existing = formulaRows.find((r) => r.segment_id === segId);
    setFormulaDraft({ ...(existing ?? defaultFormula(segId)) });
    setExpandedSegId(segId);
    setFormulaError('');
  }

  async function saveFormula(draft: FormulaRow) {
    setFormulaSaving(true);
    setFormulaError('');
    try {
      const { error } = await supabase.from('grade_formulas').upsert(
        {
          segment_id:         draft.segment_id,
          school_year:        draft.school_year,
          formula_type:       draft.formula_type,
          config:             draft.config,
          passing_grade:      draft.passing_grade,
          recovery_grade:     draft.recovery_grade,
          min_attendance_pct: draft.min_attendance_pct,
          grade_scale:        draft.grade_scale,
          updated_at:         new Date().toISOString(),
        },
        { onConflict: 'segment_id,school_year' },
      );
      if (error) throw error;
      logAudit({ action: 'update', module: 'settings', description: 'Fórmula de média atualizada' });
      setFormulaRows((prev) => {
        const exists = prev.find((r) => r.segment_id === draft.segment_id);
        return exists
          ? prev.map((r) => r.segment_id === draft.segment_id ? draft : r)
          : [...prev, draft];
      });
      setFormulaSaved(draft.segment_id);
      setTimeout(() => {
        setFormulaSaved(null);
        setExpandedSegId(null);
        setFormulaDraft(null);
      }, 900);
    } catch (e) {
      setFormulaError(String(e));
    } finally {
      setFormulaSaving(false);
    }
  }

  async function deleteFormula(segId: string) {
    const year = new Date().getFullYear();
    await supabase
      .from('grade_formulas')
      .delete()
      .eq('segment_id', segId)
      .eq('school_year', year);
    setFormulaRows((prev) => prev.filter((r) => r.segment_id !== segId));
    if (expandedSegId === segId) {
      setExpandedSegId(null);
      setFormulaDraft(null);
    }
  }

  // ── Health settings helpers ───────────────────────────────────────────────

  function toggleHealthCertSegment(id: string) {
    setHealthCertSegments((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function toggleHealthRequiredField(f: string) {
    setHealthRequiredFields((prev) =>
      prev.includes(f) ? prev.filter((s) => s !== f) : [...prev, f],
    );
  }

  // ── Global save (periods + alerts + health) ─────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const promises: PromiseLike<unknown>[] = [];

    if (periodType !== initialPeriodType || JSON.stringify(periodDates) !== initialPeriodDates) {
      promises.push(
        supabase.from('system_settings').upsert(
          { category: 'academico', key: 'period_type', value: periodType },
          { onConflict: 'category,key' },
        ).then(),
        supabase.from('system_settings').upsert(
          { category: 'academico', key: 'period_dates', value: JSON.stringify(periodDates) },
          { onConflict: 'category,key' },
        ).then(),
      );
      logAudit({ action: 'update', module: 'settings', description: 'Períodos letivos atualizados' });
    }

    if (warningThreshold !== initialWarning || criticalThreshold !== initialCritical || autoWhatsApp !== initialAutoWa) {
      promises.push(
        supabase.from('system_settings').upsert(
          { category: 'academico', key: 'alert_warning_pct', value: warningThreshold },
          { onConflict: 'category,key' },
        ).then(),
        supabase.from('system_settings').upsert(
          { category: 'academico', key: 'alert_critical_pct', value: criticalThreshold },
          { onConflict: 'category,key' },
        ).then(),
        supabase.from('system_settings').upsert(
          { category: 'academico', key: 'alert_auto_whatsapp', value: String(autoWhatsApp) },
          { onConflict: 'category,key' },
        ).then(),
      );
      logAudit({ action: 'update', module: 'settings', description: 'Alertas de frequência atualizados' });
    }

    const healthChanged =
      JSON.stringify(healthCertSegments) !== initialHealthCertSegments ||
      healthAlertDays !== initialHealthAlertDays ||
      healthAllowGuardianUpdates !== initialHealthAllowGuardian ||
      JSON.stringify(healthRequiredFields) !== initialHealthRequiredFields;

    if (healthChanged) {
      promises.push(
        supabase.from('system_settings').upsert(
          { category: 'academico', key: 'health.require_certificate_segments', value: JSON.stringify(healthCertSegments) },
          { onConflict: 'category,key' },
        ).then(),
        supabase.from('system_settings').upsert(
          { category: 'academico', key: 'health.certificate_alert_days', value: String(healthAlertDays) },
          { onConflict: 'category,key' },
        ).then(),
        supabase.from('system_settings').upsert(
          { category: 'academico', key: 'health.allow_guardian_updates', value: String(healthAllowGuardianUpdates) },
          { onConflict: 'category,key' },
        ).then(),
        supabase.from('system_settings').upsert(
          { category: 'academico', key: 'health.required_fields', value: JSON.stringify(healthRequiredFields) },
          { onConflict: 'category,key' },
        ).then(),
      );
      logAudit({ action: 'update', module: 'settings', description: 'Ficha de saúde atualizada' });
    }

    await Promise.all(promises);

    setInitialPeriodType(periodType);
    setInitialPeriodDates(JSON.stringify(periodDates));
    setInitialWarning(warningThreshold);
    setInitialCritical(criticalThreshold);
    setInitialAutoWa(autoWhatsApp);
    if (healthChanged) {
      setInitialHealthCertSegments(JSON.stringify(healthCertSegments));
      setInitialHealthAlertDays(healthAlertDays);
      setInitialHealthAllowGuardian(healthAllowGuardianUpdates);
      setInitialHealthRequiredFields(JSON.stringify(healthRequiredFields));
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const inputCls   = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none';
  const labelCls   = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

  // Slider no padrão do sistema (mesmo do horário de funcionamento):
  // círculo branco com anel via box-shadow + barra de progresso com gradiente.
  const THUMB_CLS = `absolute inset-x-0 w-full h-full appearance-none bg-transparent cursor-pointer
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
    [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]
    [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
    [&::-webkit-slider-thumb]:active:scale-110 [&::-webkit-slider-thumb]:transition-transform
    [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
    [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0
    [&::-moz-range-thumb]:shadow-[0_0_0_3px_#003876,0_2px_6px_rgba(0,0,0,0.25)]`;

  function PercentSlider({
    label, value, onChange, valueColor,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    valueColor: string;
  }) {
    const clamped = Math.max(0, Math.min(100, value));
    const pct = clamped;
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </span>
          <span className={`font-display text-xl font-bold tabular-nums ${valueColor}`}>
            {clamped}<span className="text-xs font-normal text-gray-400 ml-0.5">%</span>
          </span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute inset-x-0 h-2 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div
            className="absolute h-2 rounded-full bg-gradient-to-r from-brand-primary to-blue-500 pointer-events-none"
            style={{ width: `${pct}%` }}
          />
          <input
            type="range" min={0} max={100} step={1}
            value={clamped}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className={THUMB_CLS}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 px-0.5">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    );
  }

  function DaysSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const MIN = 1, MAX = 90;
    const pct = ((Math.max(MIN, Math.min(MAX, value)) - MIN) / (MAX - MIN)) * 100;
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Antecedência para Alerta de Vencimento
          </span>
          <span className="font-display text-xl font-bold tabular-nums text-brand-primary dark:text-brand-secondary">
            {value}<span className="text-xs font-normal text-gray-400 ml-0.5">dias</span>
          </span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute inset-x-0 h-2 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div
            className="absolute h-2 rounded-full bg-gradient-to-r from-brand-primary to-blue-500 pointer-events-none"
            style={{ width: `${pct}%` }}
          />
          <input
            type="range" min={MIN} max={MAX} step={1}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className={THUMB_CLS}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 px-0.5">
          <span>1 dia</span>
          <span>45 dias</span>
          <span>90 dias</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">

      {/* ── A. Períodos Letivos ── */}
      <SettingsCard
        title="Períodos Letivos"
        description="Defina o tipo de período e as datas de cada um"
        icon={CalendarDays}
        collapseId="academic-periods"
      >
        {/* Period type — icon buttons */}
        <div>
          <label className={labelCls}>Tipo de Período</label>
          <div className="flex gap-2">
            {(
              [
                { type: 'bimestre' as PeriodType,  Icon: CalendarDays,  label: 'Bimestre'  },
                { type: 'trimestre' as PeriodType, Icon: Calendar,      label: 'Trimestre' },
                { type: 'semestre' as PeriodType,  Icon: CalendarRange, label: 'Semestre'  },
              ] as const
            ).map(({ type, Icon, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => setPeriodType(type)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  periodType === type
                    ? 'bg-brand-primary border-brand-primary text-white shadow-sm'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-brand-primary hover:text-brand-primary'
                }`}
              >
                <Icon className={`w-4 h-4 ${periodType === type ? 'text-brand-secondary' : 'text-brand-secondary opacity-70'}`} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Periods inline CRUD */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={`${labelCls} mb-0`}>Períodos do Ano Letivo</label>
            <button
              type="button"
              onClick={addPeriod}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:text-brand-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar período
            </button>
          </div>

          {periodDates.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-5 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              Nenhum período cadastrado. Clique em "Adicionar período" para começar.
            </p>
          )}

          {periodDates.map((pd, idx) => (
            <div
              key={idx}
              className="flex items-end gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700"
            >
              <div className="w-32 shrink-0">
                <label className={labelCls}>Período</label>
                <div className="h-[42px] flex items-center">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {pd.period}° {PERIOD_LABEL[periodType]}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <label className={labelCls}>Início</label>
                <input
                  type="date"
                  value={pd.start_date}
                  onChange={(e) => updatePeriodDate(idx, 'start_date', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Fim</label>
                <input
                  type="date"
                  value={pd.end_date}
                  onChange={(e) => updatePeriodDate(idx, 'end_date', e.target.value)}
                  className={inputCls}
                />
              </div>
              <button
                type="button"
                onClick={() => removePeriod(idx)}
                className="mb-0.5 p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Remover período"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* ── B. Fórmula de Média ── */}
      <SettingsCard
        title="Fórmula de Média"
        description="Configure como a média final é calculada por segmento"
        icon={Calculator}
        collapseId="academic-formula"
      >
        {!segments.length ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum segmento cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {segments.map((seg) => {
              const row        = formulaRows.find((r) => r.segment_id === seg.id);
              const isExpanded = expandedSegId === seg.id;
              const isSaved    = formulaSaved === seg.id;
              const draft      = isExpanded ? formulaDraft : null;

              return (
                <div
                  key={seg.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Row header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                        {seg.name}
                      </p>
                      {row ? (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {row.formula_type === 'simple'
                            ? 'Média Simples'
                            : row.formula_type === 'weighted'
                              ? 'Média Ponderada'
                              : 'Por Período'}
                          {' · '}Mínima: {row.passing_grade}
                          {' · '}{row.grade_scale === 'numeric' ? 'Numérica' : 'Conceitual'}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-500 mt-0.5">Não configurado</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {row && (
                        <button
                          type="button"
                          onClick={() => deleteFormula(seg.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Excluir fórmula"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleFormulaRow(seg.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10 transition-colors"
                        title={isExpanded ? 'Recolher' : row ? 'Editar fórmula' : 'Configurar fórmula'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {isExpanded && draft && (
                    <div className="px-4 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>Tipo de Fórmula</label>
                          <select
                            value={draft.formula_type}
                            onChange={(e) => setFormulaDraft((f) => f ? { ...f, formula_type: e.target.value } : f)}
                            className={inputCls}
                          >
                            <option value="simple">Média Simples</option>
                            <option value="weighted">Média Ponderada</option>
                            <option value="by_period">Por Período</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Escala de Notas</label>
                          <select
                            value={draft.grade_scale}
                            onChange={(e) => setFormulaDraft((f) => f ? { ...f, grade_scale: e.target.value } : f)}
                            className={inputCls}
                          >
                            <option value="numeric">Numérica (0–10)</option>
                            <option value="conceptual">Conceitual (A–E)</option>
                          </select>
                        </div>
                      </div>

                      {draft.formula_type === 'weighted' && (
                        <div>
                          <label className={labelCls}>Pesos por Período (JSON)</label>
                          <input
                            value={
                              typeof draft.config.weights === 'string'
                                ? draft.config.weights
                                : JSON.stringify(draft.config.weights ?? {})
                            }
                            onChange={(e) =>
                              setFormulaDraft((f) =>
                                f ? { ...f, config: { ...f.config, weights: e.target.value } } : f,
                              )
                            }
                            placeholder='Ex: {"P1":2,"P2":2,"P3":3,"P4":3}'
                            className={inputCls}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className={labelCls}>Nota Mínima</label>
                          <input
                            type="number" min="0" max="10" step="0.5"
                            value={draft.passing_grade}
                            onChange={(e) =>
                              setFormulaDraft((f) =>
                                f ? { ...f, passing_grade: parseFloat(e.target.value) || 0 } : f,
                              )
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Nota Recuperação</label>
                          <input
                            type="number" min="0" max="10" step="0.5"
                            value={draft.recovery_grade}
                            onChange={(e) =>
                              setFormulaDraft((f) =>
                                f ? { ...f, recovery_grade: parseFloat(e.target.value) || 0 } : f,
                              )
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Frequência Mínima (%)</label>
                          <input
                            type="number" min="0" max="100" step="1"
                            value={draft.min_attendance_pct}
                            onChange={(e) =>
                              setFormulaDraft((f) =>
                                f ? { ...f, min_attendance_pct: parseFloat(e.target.value) || 0 } : f,
                              )
                            }
                            className={inputCls}
                          />
                        </div>
                      </div>

                      {formulaError && (
                        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                          {formulaError}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedSegId(null);
                            setFormulaDraft(null);
                            setFormulaError('');
                          }}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => draft && saveFormula(draft)}
                          disabled={formulaSaving}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all ${
                            isSaved
                              ? 'bg-emerald-500'
                              : 'bg-brand-primary hover:bg-brand-primary-dark disabled:opacity-50'
                          }`}
                        >
                          {formulaSaving
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : isSaved
                              ? <Check className="w-4 h-4" />
                              : <Calculator className="w-4 h-4" />}
                          {formulaSaving ? 'Salvando…' : isSaved ? 'Salvo!' : 'Salvar Fórmula'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SettingsCard>

      {/* ── C. Alertas de Frequência ── */}
      <SettingsCard
        title="Alertas de Frequência"
        description="Defina thresholds para alertar responsáveis sobre faltas"
        icon={Bell}
        collapseId="academic-alerts"
      >
        <div className="space-y-6">

          {/* Two sliders side by side */}
          <div className="grid grid-cols-2 gap-6">
            <PercentSlider
              label="Alerta (amarelo)"
              value={Number(warningThreshold)}
              onChange={(v) => setWarningThreshold(String(v))}
              valueColor="text-amber-500"
            />
            <PercentSlider
              label="Crítico (vermelho)"
              value={Number(criticalThreshold)}
              onChange={(v) => setCriticalThreshold(String(v))}
              valueColor="text-red-500"
            />
          </div>

          {/* Auto WhatsApp — standard system toggle */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setAutoWhatsApp((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                autoWhatsApp ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  autoWhatsApp ? 'translate-x-5' : ''
                }`}
              />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Enviar alertas automáticos via WhatsApp
            </span>
          </div>
        </div>
      </SettingsCard>

      {/* ── D. Ficha de Saúde ── */}
      <SettingsCard
        title="Ficha de Saúde"
        description="Configure requisitos de atestado e permissões do portal do responsável"
        icon={HeartPulse}
        collapseId="academic-health"
      >
        <div className="space-y-5">

          {/* Require cert per segment */}
          <div>
            <label className={labelCls}>Exigir Atestado de Aptidão por Segmento</label>
            {segments.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum segmento cadastrado.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-1">
                {segments.map((seg) => {
                  const active = healthCertSegments.includes(seg.id);
                  const SegIcon = getSegmentIcon(seg.name);
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => toggleHealthCertSegment(seg.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        active
                          ? 'bg-brand-primary border-brand-primary text-white shadow-sm'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-brand-primary hover:text-brand-primary'
                      }`}
                    >
                      <SegIcon className={`w-4 h-4 ${active ? 'text-brand-secondary' : 'text-brand-secondary opacity-70'}`} />
                      {seg.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Alert days — slider */}
          <DaysSlider value={healthAlertDays} onChange={setHealthAlertDays} />

          {/* Required fields */}
          <div>
            <label className={labelCls}>Campos Obrigatórios na Ficha</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {[
                { key: 'blood_type', label: 'Tipo Sanguíneo' },
                { key: 'emergency_contact', label: 'Contato de Emergência' },
                { key: 'health_plan', label: 'Plano de Saúde' },
              ].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => toggleHealthRequiredField(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    healthRequiredFields.includes(key)
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-primary'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Allow guardian updates */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setHealthAllowGuardianUpdates((v) => !v)}
              className={`relative w-10 h-5 rounded-full transition-colors ${healthAllowGuardianUpdates ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${healthAllowGuardianUpdates ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Permitir atualizações pelo portal do responsável
            </span>
          </div>
        </div>
      </SettingsCard>

      {/* ── Floating save button (periods + alerts) ── */}
      <div
        className={`fixed bottom-6 right-8 z-30 transition-all duration-300 ${
          hasChanges || saving || saved
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <button
          onClick={handleSave}
          disabled={saving || (!hasChanges && !saved)}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl transition-all duration-300 ${
            saved
              ? 'bg-emerald-500 text-white shadow-emerald-500/25'
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-brand-primary/25 disabled:opacity-50'
          }`}
        >
          {saving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : saved
              ? <Check className="w-4 h-4" />
              : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

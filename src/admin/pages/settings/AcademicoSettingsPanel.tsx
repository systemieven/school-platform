/**
 * AcademicoSettingsPanel
 *
 * Painel da aba "Acadêmico" em /admin/configuracoes.
 * 3 seções: Períodos Letivos, Fórmula de Média, Alertas de Frequência.
 * Self-contained — carrega/salva direto no Supabase.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import {
  CalendarDays, Calculator, Bell, Loader2, Save, Check,
} from 'lucide-react';

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

const PERIOD_COUNTS: Record<PeriodType, number> = { bimestre: 4, trimestre: 3, semestre: 2 };

// ── Component ───────────────────────────────────────────────────────────────

export default function AcademicoSettingsPanel() {
  const [loading, setLoading] = useState(true);

  // ── A. Períodos Letivos
  const [periodType, setPeriodType] = useState<PeriodType>('bimestre');
  const [periodDates, setPeriodDates] = useState<PeriodDate[]>([]);
  const [initialPeriodType, setInitialPeriodType] = useState<PeriodType>('bimestre');
  const [initialPeriodDates, setInitialPeriodDates] = useState('[]');

  // ── B. Fórmula de Média
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState('');
  const [formula, setFormula] = useState<FormulaRow>({
    segment_id: '', school_year: new Date().getFullYear(),
    formula_type: 'simple', config: {}, passing_grade: 7,
    recovery_grade: 5, min_attendance_pct: 75, grade_scale: 'numeric',
  });
  const [initialFormula, setInitialFormula] = useState('');

  // ── C. Alertas de Frequência
  const [warningThreshold, setWarningThreshold] = useState('80');
  const [criticalThreshold, setCriticalThreshold] = useState('75');
  const [autoWhatsApp, setAutoWhatsApp] = useState(false);
  const [initialWarning, setInitialWarning] = useState('80');
  const [initialCritical, setInitialCritical] = useState('75');
  const [initialAutoWa, setInitialAutoWa] = useState(false);

  // ── Save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasChanges =
    periodType !== initialPeriodType ||
    JSON.stringify(periodDates) !== initialPeriodDates ||
    JSON.stringify(formula) !== initialFormula ||
    warningThreshold !== initialWarning ||
    criticalThreshold !== initialCritical ||
    autoWhatsApp !== initialAutoWa;

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);

    const [settingsRes, segmentsRes] = await Promise.all([
      supabase.from('system_settings').select('*').eq('category', 'academico'),
      supabase.from('school_segments').select('id, name').eq('is_active', true).order('position'),
    ]);

    const ss = (settingsRes.data ?? []) as { key: string; value: string }[];
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
    if (!dates.length) {
      dates = Array.from({ length: PERIOD_COUNTS[pt] }, (_, i) => ({ period: i + 1, start_date: '', end_date: '' }));
    }
    setPeriodDates(dates);
    setInitialPeriodDates(JSON.stringify(dates));

    // Alerts
    const warn = ss.find((s) => s.key === 'alert_warning_pct')?.value || '80';
    const crit = ss.find((s) => s.key === 'alert_critical_pct')?.value || '75';
    const autoWa = ss.find((s) => s.key === 'alert_auto_whatsapp')?.value === 'true';
    setWarningThreshold(warn);
    setCriticalThreshold(crit);
    setAutoWhatsApp(autoWa);
    setInitialWarning(warn);
    setInitialCritical(crit);
    setInitialAutoWa(autoWa);

    // Formula — load for first segment
    if (segs.length) {
      setSelectedSegment(segs[0].id);
      await loadFormula(segs[0].id);
    }

    setLoading(false);
  }, []);

  async function loadFormula(segId: string) {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from('grade_formulas')
      .select('*')
      .eq('segment_id', segId)
      .eq('school_year', year)
      .maybeSingle();

    const f: FormulaRow = data
      ? {
          segment_id: data.segment_id as string,
          school_year: data.school_year as number,
          formula_type: data.formula_type as string,
          config: (data.config as Record<string, unknown>) ?? {},
          passing_grade: Number(data.passing_grade),
          recovery_grade: Number(data.recovery_grade),
          min_attendance_pct: Number(data.min_attendance_pct),
          grade_scale: data.grade_scale as string,
        }
      : {
          segment_id: segId, school_year: year,
          formula_type: 'simple', config: {}, passing_grade: 7,
          recovery_grade: 5, min_attendance_pct: 75, grade_scale: 'numeric',
        };
    setFormula(f);
    setInitialFormula(JSON.stringify(f));
  }

  useEffect(() => { load(); }, [load]);

  // When period type changes, rebuild dates array
  function handlePeriodTypeChange(pt: PeriodType) {
    setPeriodType(pt);
    const count = PERIOD_COUNTS[pt];
    setPeriodDates((prev) => {
      const next: PeriodDate[] = [];
      for (let i = 0; i < count; i++) {
        next.push(prev[i] || { period: i + 1, start_date: '', end_date: '' });
      }
      return next;
    });
  }

  // When segment changes, load its formula
  async function handleSegmentChange(segId: string) {
    setSelectedSegment(segId);
    await loadFormula(segId);
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const promises: PromiseLike<unknown>[] = [];

    // Save period settings
    if (periodType !== initialPeriodType || JSON.stringify(periodDates) !== initialPeriodDates) {
      promises.push(
        supabase.from('system_settings').upsert({ category: 'academico', key: 'period_type', value: periodType }, { onConflict: 'category,key' }).then(),
        supabase.from('system_settings').upsert({ category: 'academico', key: 'period_dates', value: JSON.stringify(periodDates) }, { onConflict: 'category,key' }).then(),
      );
      logAudit({ action: 'update', module: 'settings', description: 'Períodos letivos atualizados' });
    }

    // Save formula
    if (JSON.stringify(formula) !== initialFormula) {
      const { segment_id, school_year, formula_type, config, passing_grade, recovery_grade, min_attendance_pct, grade_scale } = formula;
      promises.push(
        supabase.from('grade_formulas').upsert({
          segment_id, school_year, formula_type, config,
          passing_grade, recovery_grade, min_attendance_pct, grade_scale,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'segment_id,school_year' }).then(),
      );
      logAudit({ action: 'update', module: 'settings', description: 'Fórmula de média atualizada' });
    }

    // Save alert settings
    if (warningThreshold !== initialWarning || criticalThreshold !== initialCritical || autoWhatsApp !== initialAutoWa) {
      promises.push(
        supabase.from('system_settings').upsert({ category: 'academico', key: 'alert_warning_pct', value: warningThreshold }, { onConflict: 'category,key' }).then(),
        supabase.from('system_settings').upsert({ category: 'academico', key: 'alert_critical_pct', value: criticalThreshold }, { onConflict: 'category,key' }).then(),
        supabase.from('system_settings').upsert({ category: 'academico', key: 'alert_auto_whatsapp', value: String(autoWhatsApp) }, { onConflict: 'category,key' }).then(),
      );
      logAudit({ action: 'update', module: 'settings', description: 'Alertas de frequência atualizados' });
    }

    await Promise.all(promises);

    setInitialPeriodType(periodType);
    setInitialPeriodDates(JSON.stringify(periodDates));
    setInitialFormula(JSON.stringify(formula));
    setInitialWarning(warningThreshold);
    setInitialCritical(criticalThreshold);
    setInitialAutoWa(autoWhatsApp);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 focus:border-brand-primary outline-none';
  const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* ── A. Períodos Letivos ── */}
      <SettingsCard
        title="Períodos Letivos"
        description="Defina o tipo de período e as datas de cada um"
        icon={CalendarDays}
        collapseId="academic-periods"
      >
        <div>
          <label className={labelCls}>Tipo de Período</label>
          <select value={periodType} onChange={(e) => handlePeriodTypeChange(e.target.value as PeriodType)} className={inputCls}>
            <option value="bimestre">Bimestre (4 períodos)</option>
            <option value="trimestre">Trimestre (3 períodos)</option>
            <option value="semestre">Semestre (2 períodos)</option>
          </select>
        </div>
        <div className="space-y-3">
          {periodDates.map((pd, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className={labelCls}>{idx + 1}° {periodType === 'bimestre' ? 'Bimestre' : periodType === 'trimestre' ? 'Trimestre' : 'Semestre'}</label>
                <div className="h-[42px] flex items-center text-sm text-gray-600 dark:text-gray-300 font-medium">
                  Período {idx + 1}
                </div>
              </div>
              <div>
                <label className={labelCls}>Início</label>
                <input
                  type="date"
                  value={pd.start_date}
                  onChange={(e) => {
                    const next = [...periodDates];
                    next[idx] = { ...next[idx], start_date: e.target.value };
                    setPeriodDates(next);
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Fim</label>
                <input
                  type="date"
                  value={pd.end_date}
                  onChange={(e) => {
                    const next = [...periodDates];
                    next[idx] = { ...next[idx], end_date: e.target.value };
                    setPeriodDates(next);
                  }}
                  className={inputCls}
                />
              </div>
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
          <>
            <div>
              <label className={labelCls}>Segmento</label>
              <select value={selectedSegment} onChange={(e) => handleSegmentChange(e.target.value)} className={inputCls}>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Tipo de Fórmula</label>
                <select
                  value={formula.formula_type}
                  onChange={(e) => setFormula((f) => ({ ...f, formula_type: e.target.value }))}
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
                  value={formula.grade_scale}
                  onChange={(e) => setFormula((f) => ({ ...f, grade_scale: e.target.value }))}
                  className={inputCls}
                >
                  <option value="numeric">Numérica (0–10)</option>
                  <option value="conceptual">Conceitual (A–E)</option>
                </select>
              </div>
            </div>

            {formula.formula_type === 'weighted' && (
              <div>
                <label className={labelCls}>Pesos por Período (JSON)</label>
                <input
                  value={typeof formula.config.weights === 'string' ? formula.config.weights : JSON.stringify(formula.config.weights ?? {})}
                  onChange={(e) => setFormula((f) => ({ ...f, config: { ...f.config, weights: e.target.value } }))}
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
                  value={formula.passing_grade}
                  onChange={(e) => setFormula((f) => ({ ...f, passing_grade: parseFloat(e.target.value) || 0 }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nota Recuperação</label>
                <input
                  type="number" min="0" max="10" step="0.5"
                  value={formula.recovery_grade}
                  onChange={(e) => setFormula((f) => ({ ...f, recovery_grade: parseFloat(e.target.value) || 0 }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Frequência Mínima (%)</label>
                <input
                  type="number" min="0" max="100" step="1"
                  value={formula.min_attendance_pct}
                  onChange={(e) => setFormula((f) => ({ ...f, min_attendance_pct: parseFloat(e.target.value) || 0 }))}
                  className={inputCls}
                />
              </div>
            </div>
          </>
        )}
      </SettingsCard>

      {/* ── C. Alertas de Frequência ── */}
      <SettingsCard
        title="Alertas de Frequência"
        description="Defina thresholds para alertar responsáveis sobre faltas"
        icon={Bell}
        collapseId="academic-alerts"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Alerta (amarelo) — %</label>
            <input
              type="number" min="0" max="100" step="1"
              value={warningThreshold}
              onChange={(e) => setWarningThreshold(e.target.value)}
              placeholder="80"
              className={inputCls}
            />
            <p className="text-[10px] text-gray-400 mt-1">Dispara alerta quando a frequência cai abaixo deste valor.</p>
          </div>
          <div>
            <label className={labelCls}>Crítico (vermelho) — %</label>
            <input
              type="number" min="0" max="100" step="1"
              value={criticalThreshold}
              onChange={(e) => setCriticalThreshold(e.target.value)}
              placeholder="75"
              className={inputCls}
            />
            <p className="text-[10px] text-gray-400 mt-1">Dispara alerta crítico — risco de reprovação por falta.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <div
            className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors ${autoWhatsApp ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            onClick={() => setAutoWhatsApp((v) => !v)}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${autoWhatsApp ? 'translate-x-5' : ''}`} />
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Enviar alertas automáticos via WhatsApp</span>
        </div>
      </SettingsCard>

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
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-brand-primary/25 disabled:opacity-50'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

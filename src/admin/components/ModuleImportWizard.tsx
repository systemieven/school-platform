/**
 * ModuleImportWizard — Wizard generico de importacao em 4 passos.
 *
 * Usado pela Central de Migracao (OP-1) e pelas paginas dedicadas de cada
 * modulo. Cada modulo fornece um `ModuleImportConfig` em
 * `admin/lib/import-configs/*` com fields, aliases, validacao e builder.
 *
 * Lock por modulo: antes de montar o wizard, consulta `module_imports`.
 * Se status='completed', exibe banner bloqueando ate desbloqueio via
 * /admin/migracao (super_admin only).
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, ArrowLeft, ArrowRight, FileSpreadsheet, Check, X,
  AlertTriangle, Loader2, Download, Save, Trash2, Wand2, Sparkles, Lock,
  ClipboardList,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { parseSpreadsheet, downloadImportTemplate } from '../lib/import';
import {
  autoDetectMappingFor,
  autoDetectExtraColumn,
  type ModuleImportConfig,
  type MappingConfidence,
  type ImportContext,
  type ImportReport,
  type ValidationContext,
} from '../lib/import-wizard';
import type { ImportTemplate, ImportTemplateMapping } from '../types/admin.types';

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none';

const BASE_STEPS = [
  { num: 1, label: 'Upload' },
  { num: 2, label: 'Mapeamento' },
  { num: 3, label: 'Validação' },
  { num: 4, label: 'Importação' },
];

const STEPS_WITH_REVIEW = [
  { num: 1, label: 'Upload' },
  { num: 2, label: 'Mapeamento' },
  { num: 3, label: 'Validação' },
  { num: 4, label: 'Revisar' },
  { num: 5, label: 'Importação' },
];

const BATCH_SIZE = 50;

interface ValidationResult {
  rowIndex: number;
  row: Record<string, string>;
  valid: boolean;
  errors: string[];
  isDuplicate: boolean;
  included: boolean;
}

interface LockRow {
  status: 'available' | 'completed';
  records_imported: number;
  completed_at: string | null;
  unlock_reason: string | null;
}

interface Props<Ctx extends ImportContext = ImportContext> {
  config: ModuleImportConfig<Ctx>;
}

export default function ModuleImportWizard<Ctx extends ImportContext = ImportContext>({
  config,
}: Props<Ctx>) {
  const navigate = useNavigate();
  const { profile } = useAdminAuth();

  // Lock state ---------------------------------------------------------------
  const [lockLoading, setLockLoading] = useState(true);
  const [lock, setLock] = useState<LockRow | null>(null);

  useEffect(() => {
    (async () => {
      setLockLoading(true);
      const { data } = await supabase
        .from('module_imports')
        .select('status, records_imported, completed_at, unlock_reason')
        .eq('module_key', config.moduleKey)
        .maybeSingle();
      setLock((data as LockRow | null) ?? null);
      setLockLoading(false);
    })();
  }, [config.moduleKey]);

  // Wizard state -------------------------------------------------------------
  const hasReviewStep = !!(config.perRowOverrides && config.perRowOverrides.length > 0);
  const STEPS = hasReviewStep ? STEPS_WITH_REVIEW : BASE_STEPS;
  const IMPORT_STEP = hasReviewStep ? 5 : 4;

  const [step, setStep] = useState(1);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [extraMapping, setExtraMapping] = useState<Record<string, string>>({});
  const [autoConfidence, setAutoConfidence] = useState<Record<string, MappingConfidence>>({});

  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [validating, setValidating] = useState(false);

  // Per-row overrides (step "Revisar")
  const [rowOverrides, setRowOverrides] = useState<Record<number, Record<string, string>>>({});

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState('');

  const [dragging, setDragging] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('import_templates')
      .select('*')
      .eq('target_table', config.targetTable)
      .order('created_at', { ascending: false });
    if (data) setTemplates(data as ImportTemplate[]);
  }, [config.targetTable]);

  // ── Step 1: Parse file ───────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setParseError('');
    try {
      const result = await parseSpreadsheet(file);
      if (result.headers.length === 0) {
        setParseError('Planilha vazia ou sem cabeçalho.');
        setParsing(false);
        return;
      }
      setHeaders(result.headers);
      setRows(result.rows);
      setFileName(file.name);

      // Init mapping + run autodetect
      const initMap: Record<string, string> = {};
      config.fields.forEach((f) => { initMap[f.key] = ''; });
      const detected = autoDetectMappingFor(
        config.fields, config.fieldAliases, config.fieldPatterns, result.headers, result.rows,
      );
      const conf: Record<string, MappingConfidence> = {};
      for (const [k, v] of Object.entries(detected)) {
        initMap[k] = v.column;
        conf[k] = v.confidence;
      }
      setMapping(initMap);
      setAutoConfidence(conf);

      // Extra columns (turma etc.)
      const initExtras: Record<string, string> = {};
      for (const ex of config.extraColumns ?? []) {
        initExtras[ex.key] = autoDetectExtraColumn(ex.aliases, result.headers);
      }
      setExtraMapping(initExtras);

      await loadTemplates();
      setStep(2);
    } catch {
      setParseError('Erro ao ler o arquivo. Verifique se é um xlsx ou csv válido.');
    }
    setParsing(false);
  }, [config, loadTemplates]);

  const onFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Autodetect & templates ───────────────────────────────────────────────

  const handleAutoDetect = useCallback(() => {
    const initMap: Record<string, string> = {};
    config.fields.forEach((f) => { initMap[f.key] = ''; });
    const detected = autoDetectMappingFor(
      config.fields, config.fieldAliases, config.fieldPatterns, headers, rows,
    );
    const conf: Record<string, MappingConfidence> = {};
    for (const [k, v] of Object.entries(detected)) {
      initMap[k] = v.column;
      conf[k] = v.confidence;
    }
    setMapping(initMap);
    setAutoConfidence(conf);
    const initExtras: Record<string, string> = {};
    for (const ex of config.extraColumns ?? []) {
      initExtras[ex.key] = autoDetectExtraColumn(ex.aliases, headers);
    }
    setExtraMapping(initExtras);
  }, [config, headers, rows]);

  const applyTemplate = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const newMap: Record<string, string> = {};
    config.fields.forEach((f) => { newMap[f.key] = ''; });
    const newExtras: Record<string, string> = {};
    for (const ex of config.extraColumns ?? []) newExtras[ex.key] = '';

    tpl.mapping.forEach((m: ImportTemplateMapping) => {
      if (m.field.startsWith('__') && m.field.endsWith('__')) {
        const key = m.field.slice(2, -2);
        if (key in newExtras) newExtras[key] = m.column;
      } else if (m.field in newMap) {
        newMap[m.field] = m.column;
      }
    });
    setMapping(newMap);
    setExtraMapping(newExtras);
    setAutoConfidence({});
  }, [templates, config]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    const arr: ImportTemplateMapping[] = Object.entries(mapping)
      .filter(([, c]) => c)
      .map(([field, column], i) => ({ column, field, position: i }));
    for (const [key, col] of Object.entries(extraMapping)) {
      if (col) arr.push({ column: col, field: `__${key}__`, position: arr.length });
    }
    await supabase.from('import_templates').insert({
      name: templateName.trim(),
      target_table: config.targetTable,
      mapping: arr,
      created_by: profile?.id ?? null,
      is_shared: true,
    });
    setTemplateName('');
    await loadTemplates();
    setSavingTemplate(false);
  }, [templateName, mapping, extraMapping, config.targetTable, profile, loadTemplates]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    await supabase.from('import_templates').delete().eq('id', id);
    if (selectedTemplateId === id) setSelectedTemplateId('');
    await loadTemplates();
  }, [selectedTemplateId, loadTemplates]);

  // ── Step 2 → 3: Validate ────────────────────────────────────────────────

  const requiredMapped = config.fields.filter((f) => f.required).every((f) => !!mapping[f.key]);

  const handleValidate = useCallback(async () => {
    setValidating(true);

    const existingKeys = config.loadExistingKeys ? await config.loadExistingKeys() : new Set<string>();

    // Build file-keys frequency (for dup-within-file detection)
    const fileKeyCounts = new Map<string, number>();
    if (config.getRowKey) {
      for (const row of rows) {
        const k = config.getRowKey(row, mapping);
        if (k) fileKeyCounts.set(k, (fileKeyCounts.get(k) ?? 0) + 1);
      }
    }

    const seenFileKeys = new Set<string>();
    const results: ValidationResult[] = rows.map((row, i) => {
      const extras: Record<string, string> = {};
      for (const ex of config.extraColumns ?? []) {
        const col = extraMapping[ex.key];
        extras[ex.key] = col ? (row[col] ?? '') : '';
      }

      const key = config.getRowKey ? config.getRowKey(row, mapping) : '';
      const isDup = !!(key && (existingKeys.has(key) || (fileKeyCounts.get(key) ?? 0) > 1));

      const ctx: ValidationContext = { existingKeys, fileKeys: seenFileKeys };
      const errors = config.validateRow(row, mapping, extras, ctx);

      if (key) seenFileKeys.add(key);

      return { rowIndex: i, row, valid: errors.length === 0, errors, isDuplicate: isDup, included: errors.length === 0 };
    });

    setValidationResults(results);
    setExpandedRows(new Set());

    // Seed per-row overrides with defaults (apenas para linhas validas)
    if (config.perRowOverrides && config.perRowOverrides.length > 0) {
      const seed: Record<number, Record<string, string>> = {};
      for (const r of results) {
        if (!r.valid) continue;
        const ov: Record<string, string> = {};
        for (const o of config.perRowOverrides) {
          ov[o.key] = o.defaultValue ?? '';
        }
        seed[r.rowIndex] = ov;
      }
      setRowOverrides(seed);
    }

    setValidating(false);
    setStep(3);
  }, [config, rows, mapping, extraMapping]);

  const toggleRow = (idx: number) => {
    setValidationResults((prev) => prev.map((r) => (r.rowIndex === idx ? { ...r, included: !r.included } : r)));
  };

  const toggleExpand = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const validCount = validationResults.filter((r) => r.valid && r.included).length;
  const errorCount = validationResults.filter((r) => !r.valid).length;
  const duplicateCount = validationResults.filter((r) => r.isDuplicate).length;

  // ── Step 4: Import ──────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    setImporting(true);
    setImportError('');
    setReport(null);

    const toImport = validationResults.filter((r) => r.valid && r.included);
    setImportTotal(toImport.length);
    setImportProgress(0);
    setStep(hasReviewStep ? 5 : 4);

    try {
      const ctx = (config.preImport
        ? await config.preImport(toImport.length)
        : ({} as Ctx)) as Ctx;

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
        const batch = toImport.slice(i, i + BATCH_SIZE);
        const records = batch.map((item, bIdx) => {
          const mappedRow: Record<string, string> = {};
          for (const [field, column] of Object.entries(mapping)) {
            if (column) mappedRow[field] = item.row[column] ?? '';
          }
          const extras: Record<string, string> = {};
          for (const ex of config.extraColumns ?? []) {
            const col = extraMapping[ex.key];
            extras[ex.key] = col ? (item.row[col] ?? '') : '';
          }
          const overrides = rowOverrides[item.rowIndex] ?? {};
          return config.buildRecord(mappedRow, extras, i + bIdx, ctx, overrides);
        });

        if (config.insertBatch) {
          const r = await config.insertBatch(records);
          imported += r.inserted;
          errors += r.errors;
        } else {
          const { error: insertErr, data: inserted } = await supabase
            .from(config.targetTable)
            .insert(records)
            .select('id');
          if (insertErr) {
            errors += batch.length;
          } else {
            imported += inserted?.length ?? 0;
            skipped += batch.length - (inserted?.length ?? 0);
          }
        }

        setImportProgress(Math.min(i + BATCH_SIZE, toImport.length));
      }

      setReport({ imported, skipped, errors });

      // Lock module on success
      if (imported > 0 && errors === 0) {
        await supabase
          .from('module_imports')
          .update({
            status: 'completed',
            records_imported: imported,
            completed_at: new Date().toISOString(),
            completed_by: profile?.id ?? null,
          })
          .eq('module_key', config.moduleKey);
      }

      await logAudit({
        action: 'import',
        module: config.moduleKey,
        description: `${imported} ${config.labelPlural} importados`,
      });
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Erro desconhecido na importação');
    }
    setImporting(false);
  }, [validationResults, mapping, extraMapping, rowOverrides, config, profile, hasReviewStep]);

  // ── Template download ───────────────────────────────────────────────────

  const handleDownloadTemplate = useCallback(() => {
    const fields = Object.entries(mapping)
      .filter(([, col]) => col)
      .map(([field, col]) => ({ column: col, field }));
    if (fields.length === 0) {
      downloadImportTemplate(
        config.fields.map((f) => ({ column: f.label, field: f.key })),
        `${config.templateFileName}.xlsx`,
      );
    } else {
      downloadImportTemplate(fields, `${config.templateFileName}.xlsx`);
    }
  }, [mapping, config]);

  const getNameValue = (row: Record<string, string>) => {
    const primary = config.fields.find((f) => f.required);
    const col = primary ? mapping[primary.key] : '';
    return col ? (row[col] || '—') : '—';
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (lockLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  // Completed lock — block re-import
  if (lock?.status === 'completed') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(config.backPath)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          <FileSpreadsheet className="w-6 h-6 text-brand-primary dark:text-brand-secondary" />
          <h1 className="text-xl font-display font-bold text-gray-900 dark:text-white">
            Importar {config.labelPlural.charAt(0).toUpperCase() + config.labelPlural.slice(1)}
          </h1>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-semibold text-amber-900 dark:text-amber-200">
                Este módulo já foi importado
              </h2>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                {lock.records_imported} {config.labelPlural} foram importados
                {lock.completed_at ? ` em ${new Date(lock.completed_at).toLocaleDateString('pt-BR')}` : ''}.
                Para evitar duplicidade, o módulo foi travado. Um super_admin pode desbloqueá-lo na
                Central de Migração.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/migracao')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
          >
            Ir para Central de Migração
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(config.backPath)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <Icon className="w-6 h-6 text-brand-primary dark:text-brand-secondary" />
        <h1 className="text-xl font-display font-bold text-gray-900 dark:text-white">
          Importar {config.labelPlural.charAt(0).toUpperCase() + config.labelPlural.slice(1)}
        </h1>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                step === s.num
                  ? 'bg-brand-primary text-white dark:bg-brand-secondary dark:text-gray-900'
                  : step > s.num
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
              }`}
            >
              {step > s.num ? <Check className="w-4 h-4" /> : s.num}
            </div>
            <span
              className={`text-sm font-medium hidden sm:inline ${
                step === s.num ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-200 dark:bg-gray-600" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Enviar Planilha</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onFileDrop}
            className={`flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
              dragging
                ? 'border-brand-primary bg-brand-primary/5 dark:border-brand-secondary dark:bg-brand-secondary/5'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {parsing ? (
              <Loader2 className="w-10 h-10 text-brand-primary dark:text-brand-secondary animate-spin" />
            ) : (
              <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {parsing ? 'Lendo planilha...' : 'Arraste um arquivo .xlsx ou .csv aqui, ou clique para selecionar'}
            </p>
            <input id="file-input" type="file" accept=".xlsx,.csv" className="hidden" onChange={onFileSelect} />
          </div>
          {parseError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {parseError}
            </div>
          )}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-primary dark:text-brand-secondary hover:bg-brand-primary/5 dark:hover:bg-brand-secondary/5 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar Template
          </button>
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 2 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mapeamento de Colunas</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {fileName} — {rows.length} linhas • {headers.length} colunas detectadas
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleAutoDetect}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-primary/10 text-brand-primary dark:bg-brand-secondary/10 dark:text-brand-secondary hover:bg-brand-primary/20 dark:hover:bg-brand-secondary/20 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Detectar Automaticamente
              </button>
              <button
                disabled
                title="Disponível após configurar um Agente de IA em Config → Agentes"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 dark:bg-purple-900/10 text-purple-400 dark:text-purple-600 cursor-not-allowed opacity-60"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Mapear com IA
              </button>
            </div>
          </div>

          {Object.keys(autoConfidence).length > 0 && (() => {
            const high = Object.values(autoConfidence).filter((c) => c === 'high').length;
            const low = Object.values(autoConfidence).filter((c) => c === 'low').length;
            return (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-xs text-emerald-700 dark:text-emerald-400">
                <Wand2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Detecção automática: <strong>{high}</strong> campo{high !== 1 ? 's' : ''} com alta confiança
                  {low > 0 && <>, <strong>{low}</strong> para verificar</>}. Revise antes de continuar.
                </span>
              </div>
            );
          })()}

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Template salvo</label>
              <select value={selectedTemplateId} onChange={(e) => applyTemplate(e.target.value)} className={INPUT_CLASS}>
                <option value="">— Nenhum —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {selectedTemplateId && (
              <button
                onClick={() => handleDeleteTemplate(selectedTemplateId)}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Excluir template"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 px-3 pb-1">
              <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Campo do sistema</span>
              <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Coluna no arquivo</span>
            </div>
            {config.fields.map((field) => {
              const currentColumn = mapping[field.key] ?? '';
              const conf = autoConfidence[field.key];
              const showHigh = conf === 'high' && !!currentColumn;
              const showLow = conf === 'low' && !!currentColumn;
              return (
                <div
                  key={field.key}
                  className={`grid grid-cols-2 gap-3 items-center p-3 rounded-lg ${
                    field.required && !currentColumn
                      ? 'bg-red-50/60 dark:bg-red-900/10'
                      : 'bg-gray-50 dark:bg-gray-700/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </span>
                    {showHigh && (
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <Check className="w-2.5 h-2.5" /> Auto
                      </span>
                    )}
                    {showLow && (
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertTriangle className="w-2.5 h-2.5" /> Verificar
                      </span>
                    )}
                  </div>
                  <select
                    value={currentColumn}
                    onChange={(e) => {
                      setMapping((m) => ({ ...m, [field.key]: e.target.value }));
                      setAutoConfidence((c) => { const n = { ...c }; delete n[field.key]; return n; });
                    }}
                    className={`${INPUT_CLASS} ${field.required && !currentColumn ? 'border-red-300 dark:border-red-700 focus:border-red-400' : ''}`}
                  >
                    <option value="">— Ignorar —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Extra columns */}
          {(config.extraColumns ?? []).map((ex) => (
            <div key={ex.key} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">{ex.label}</label>
              <select
                value={extraMapping[ex.key] ?? ''}
                onChange={(e) => setExtraMapping((m) => ({ ...m, [ex.key]: e.target.value }))}
                className={INPUT_CLASS}
              >
                <option value="">— Nenhuma —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              {ex.hint && <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">{ex.hint}</p>}
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Salvar como template</label>
              <input
                type="text"
                placeholder="Ex: Exportação Sistema Anterior"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || savingTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-primary dark:text-brand-secondary hover:bg-brand-primary/5 dark:hover:bg-brand-secondary/5 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Baixar Template
            </button>
          </div>

          {!requiredMapped && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Mapeie os campos obrigatórios marcados com * para continuar.
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              onClick={handleValidate}
              disabled={!requiredMapped || validating}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Validar e Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview &amp; Validação</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400"><Check className="w-4 h-4" />{validCount} válidos</span>
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400"><X className="w-4 h-4" />{errorCount} com erro</span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><AlertTriangle className="w-4 h-4" />{duplicateCount} duplicados</span>
          </div>
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/60">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 w-10">#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Nome</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400 w-28">Status</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400 w-16">Incluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {validationResults.map((r) => (
                  <tr key={r.rowIndex} className="group">
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.rowIndex + 1}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                      <button onClick={() => !r.valid && toggleExpand(r.rowIndex)} className="text-left hover:underline">
                        {getNameValue(r.row)}
                      </button>
                      {expandedRows.has(r.rowIndex) && r.errors.length > 0 && (
                        <ul className="mt-1 text-xs text-red-500 dark:text-red-400 space-y-0.5 list-disc list-inside">
                          {r.errors.map((err, ei) => <li key={ei}>{err}</li>)}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.valid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><Check className="w-3 h-3" /> Válido</span>
                      ) : r.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><AlertTriangle className="w-3 h-3" /> Duplicado</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"><X className="w-3 h-3" /> Erro</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={r.included}
                        onChange={() => toggleRow(r.rowIndex)}
                        disabled={!r.valid}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-primary focus:ring-brand-primary dark:focus:ring-brand-secondary"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            {hasReviewStep ? (
              <button
                onClick={() => setStep(4)}
                disabled={validCount === 0}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                Revisar {validCount} {config.labelPlural}
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={validCount === 0}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="w-4 h-4" />
                Importar {validCount} {config.labelPlural}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 4 (optional): Revisar per-row overrides */}
      {hasReviewStep && step === 4 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Revisar antes de importar</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Defina os campos abaixo para cada linha. Tudo é aplicado de uma só vez ao confirmar.
            </p>
          </div>
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/60">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 w-10">#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Nome</th>
                  {config.perRowOverrides!.map((o) => (
                    <th key={o.key} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                      {o.label}{o.required && <span className="text-red-500 ml-0.5">*</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {validationResults.filter((r) => r.valid && r.included).map((r) => (
                  <tr key={r.rowIndex}>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.rowIndex + 1}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{getNameValue(r.row)}</td>
                    {config.perRowOverrides!.map((o) => {
                      const v = rowOverrides[r.rowIndex]?.[o.key] ?? '';
                      const setValue = (val: string) =>
                        setRowOverrides((prev) => ({
                          ...prev,
                          [r.rowIndex]: { ...(prev[r.rowIndex] ?? {}), [o.key]: val },
                        }));
                      return (
                        <td key={o.key} className="px-3 py-2">
                          {o.type === 'select' ? (
                            <select
                              value={v}
                              onChange={(e) => setValue(e.target.value)}
                              className={INPUT_CLASS}
                            >
                              <option value="">—</option>
                              {(o.options ?? []).map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={v}
                              onChange={(e) => setValue(e.target.value)}
                              className={INPUT_CLASS}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bulk apply helpers */}
          {config.perRowOverrides!.some((o) => o.type === 'select') && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400 self-center">Aplicar a todas:</span>
              {config.perRowOverrides!.filter((o) => o.type === 'select').map((o) => (
                <select
                  key={o.key}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    setRowOverrides((prev) => {
                      const next: typeof prev = { ...prev };
                      for (const r of validationResults) {
                        if (r.valid && r.included) {
                          next[r.rowIndex] = { ...(next[r.rowIndex] ?? {}), [o.key]: val };
                        }
                      }
                      return next;
                    });
                    e.target.value = '';
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="">{o.label}</option>
                  {(o.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              onClick={handleImport}
              disabled={(() => {
                const required = (config.perRowOverrides ?? []).filter((o) => o.required);
                if (required.length === 0) return false;
                return validationResults.some(
                  (r) => r.valid && r.included && required.some((o) => !rowOverrides[r.rowIndex]?.[o.key]),
                );
              })()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importar {validCount} {config.labelPlural}
            </button>
          </div>
        </div>
      )}

      {/* Step N: Import result */}
      {step === IMPORT_STEP && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Importação</h2>
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Importando...</span>
                <span>{importProgress} / {importTotal}</span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-primary dark:bg-brand-secondary rounded-full transition-all duration-300"
                  style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          {importError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {importError}
            </div>
          )}
          {report && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="w-5 h-5" />
                <span className="font-semibold">Importação concluída!</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{report.imported}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Importados</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-center">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{report.skipped}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">Ignorados</p>
                </div>
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{report.errors}</p>
                  <p className="text-xs text-red-600 dark:text-red-500">Erros</p>
                </div>
              </div>
              {report.errors === 0 && report.imported > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm">
                  <Lock className="w-4 h-4 flex-shrink-0" />
                  Módulo travado após sucesso. Desbloqueio via /admin/migracao (super_admin).
                </div>
              )}
              <button
                onClick={() => navigate(config.backPath)}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

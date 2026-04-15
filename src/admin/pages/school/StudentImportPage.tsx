import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  STUDENT_IMPORT_FIELDS,
  parseSpreadsheet,
  validateStudentRow,
  resolveClassId,
  downloadImportTemplate,
  autoDetectMapping,
  autoDetectClassColumn,
} from '../../lib/import';
import type { MappingConfidence } from '../../lib/import';
import type { SchoolClass, ImportTemplate, ImportTemplateMapping } from '../../types/admin.types';
import {
  Upload, ArrowLeft, ArrowRight, FileSpreadsheet, Check, X,
  AlertTriangle, Loader2, Download, Save, Trash2, Wand2, Sparkles,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none';

const STEPS = [
  { num: 1, label: 'Upload' },
  { num: 2, label: 'Mapeamento' },
  { num: 3, label: 'Validação' },
  { num: 4, label: 'Importação' },
];

const BATCH_SIZE = 50;

// ── Types ────────────────────────────────────────────────────────────────────

interface ValidationResult {
  rowIndex: number;
  row: Record<string, string>;
  valid: boolean;
  errors: string[];
  isDuplicate: boolean;
  included: boolean;
}

interface ImportReport {
  imported: number;
  skipped: number;
  errors: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StudentImportPage() {
  const navigate = useNavigate();
  const { profile } = useAdminAuth();

  // Wizard step
  const [step, setStep] = useState(1);

  // Step 1 — file data
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  // Templates
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Step 2 — mapping (fieldKey → columnHeader)
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [classColumn, setClassColumn] = useState('');
  // Auto-detection confidence per field (cleared when user manually changes a row)
  const [autoConfidence, setAutoConfidence] = useState<Record<string, MappingConfidence>>({});
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  // Step 3 — validation
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [validating, setValidating] = useState(false);

  // Step 4 — import
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState('');

  // Drag state
  const [dragging, setDragging] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('import_templates')
      .select('*')
      .eq('target_table', 'students')
      .order('created_at', { ascending: false });
    if (data) setTemplates(data as ImportTemplate[]);
  }, []);

  const loadClasses = useCallback(async () => {
    const { data } = await supabase
      .from('school_classes')
      .select('*')
      .order('name');
    if (data) setClasses(data as SchoolClass[]);
  }, []);

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

      // Initialize mapping keyed by system field (field-first orientation)
      const init: Record<string, string> = {};
      STUDENT_IMPORT_FIELDS.forEach((f) => { init[f.key] = ''; });

      // Run auto-detection
      const detected = autoDetectMapping(result.headers, result.rows);
      const confidence: Record<string, MappingConfidence> = {};
      for (const [field, { column, confidence: conf }] of Object.entries(detected)) {
        init[field] = column;
        confidence[field] = conf;
      }
      setMapping(init);
      setAutoConfidence(confidence);

      // Auto-detect class column
      const detectedClass = autoDetectClassColumn(result.headers);
      if (detectedClass) setClassColumn(detectedClass);

      // Load templates + classes then advance
      await Promise.all([loadTemplates(), loadClasses()]);
      setStep(2);
    } catch {
      setParseError('Erro ao ler o arquivo. Verifique se é um xlsx ou csv válido.');
    }
    setParsing(false);
  }, [loadTemplates, loadClasses]);

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

  // ── Re-run auto-detection ────────────────────────────────────────────────

  const handleAutoDetect = useCallback(() => {
    const init: Record<string, string> = {};
    STUDENT_IMPORT_FIELDS.forEach((f) => { init[f.key] = ''; });
    const detected = autoDetectMapping(headers, rows);
    const confidence: Record<string, MappingConfidence> = {};
    for (const [field, { column, confidence: conf }] of Object.entries(detected)) {
      init[field] = column;
      confidence[field] = conf;
    }
    setMapping(init);
    setAutoConfidence(confidence);
    const detectedClass = autoDetectClassColumn(headers);
    if (detectedClass) setClassColumn(detectedClass);
  }, [headers, rows]);

  // ── Apply template ───────────────────────────────────────────────────────

  const applyTemplate = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    // Initialize empty field-first mapping
    const newMapping: Record<string, string> = {};
    STUDENT_IMPORT_FIELDS.forEach((f) => { newMapping[f.key] = ''; });
    // Apply template: field -> column
    tpl.mapping.forEach((m: ImportTemplateMapping) => {
      if (m.field in newMapping) newMapping[m.field] = m.column;
    });
    setMapping(newMapping);
    setAutoConfidence({}); // template-applied rows have no auto-confidence badge
    // Restore class column
    const classMapped = tpl.mapping.find((m: ImportTemplateMapping) => m.field === '__class__');
    if (classMapped) setClassColumn(classMapped.column);
  }, [templates]);

  // ── Save template ────────────────────────────────────────────────────────

  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    const mappingArr: ImportTemplateMapping[] = Object.entries(mapping)
      .filter(([, col]) => col)
      .map(([field, col], i) => ({ column: col, field, position: i }));
    if (classColumn) {
      mappingArr.push({ column: classColumn, field: '__class__', position: mappingArr.length });
    }
    await supabase.from('import_templates').insert({
      name: templateName.trim(),
      target_table: 'students',
      mapping: mappingArr,
      created_by: profile?.id ?? null,
      is_shared: true,
    });
    setTemplateName('');
    await loadTemplates();
    setSavingTemplate(false);
  }, [templateName, mapping, classColumn, profile, loadTemplates]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    await supabase.from('import_templates').delete().eq('id', id);
    if (selectedTemplateId === id) setSelectedTemplateId('');
    await loadTemplates();
  }, [selectedTemplateId, loadTemplates]);

  // ── Step 2 → 3: Validate ────────────────────────────────────────────────

  const requiredFieldsMapped = STUDENT_IMPORT_FIELDS
    .filter((f) => f.required)
    .every((f) => !!mapping[f.key]);

  const handleValidate = useCallback(async () => {
    setValidating(true);

    // Load existing CPFs
    const { data: existingStudents } = await supabase
      .from('students')
      .select('cpf')
      .not('cpf', 'is', null);
    const existingCpfs = new Set(
      (existingStudents ?? []).map((s: { cpf: string | null }) => s.cpf?.replace(/\D/g, '') ?? '').filter(Boolean),
    );

    // Build per-file CPF set for duplicate detection
    const cpfField = mapping['cpf'] || '';
    const fileCpfCounts = new Map<string, number>();
    if (cpfField) {
      rows.forEach((row) => {
        const val = row[cpfField]?.replace(/\D/g, '');
        if (val) fileCpfCounts.set(val, (fileCpfCounts.get(val) ?? 0) + 1);
      });
    }

    const fileCpfs = new Set<string>();
    const results: ValidationResult[] = rows.map((row, i) => {
      const cpfVal = cpfField ? row[cpfField]?.replace(/\D/g, '') : '';
      const isDuplicate = !!(cpfVal && (existingCpfs.has(cpfVal) || (fileCpfCounts.get(cpfVal) ?? 0) > 1));

      const { valid, errors } = validateStudentRow(row, mapping, existingCpfs, fileCpfs);

      // Track file CPFs after validation (so second occurrence is caught)
      if (cpfVal) fileCpfs.add(cpfVal);

      return { rowIndex: i, row, valid, errors, isDuplicate, included: valid };
    });

    setValidationResults(results);
    setExpandedRows(new Set());
    setValidating(false);
    setStep(3);
  }, [mapping, rows]);

  // ── Step 3 toggles ──────────────────────────────────────────────────────

  const toggleRow = (idx: number) => {
    setValidationResults((prev) =>
      prev.map((r) => (r.rowIndex === idx ? { ...r, included: !r.included } : r)),
    );
  };

  const toggleExpand = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
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
    setStep(4);

    try {
      // Generate enrollment numbers
      const { data: enrollmentData, error: enrollErr } = await supabase.rpc(
        'generate_enrollment_numbers',
        { p_count: toImport.length },
      );
      if (enrollErr) throw new Error(`Erro ao gerar matrículas: ${enrollErr.message}`);
      const enrollmentNumbers: string[] = enrollmentData as string[];

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
        const batch = toImport.slice(i, i + BATCH_SIZE);
        const records = batch.map((item, batchIdx) => {
          // Build record from mapping (fieldKey → columnHeader)
          const record: Record<string, unknown> = {};
          for (const [field, column] of Object.entries(mapping)) {
            if (column) {
              record[field] = item.row[column]?.trim() || null;
            }
          }
          // Enrollment number
          record.enrollment_number = enrollmentNumbers[i + batchIdx];
          // Class resolution
          if (classColumn && item.row[classColumn]) {
            const classId = resolveClassId(item.row[classColumn], classes);
            if (classId) record.class_id = classId;
          }
          record.status = 'active';
          return record;
        });

        const { error: insertErr, data: inserted } = await supabase
          .from('students')
          .insert(records)
          .select('id');

        if (insertErr) {
          errors += batch.length;
        } else {
          imported += inserted?.length ?? 0;
          skipped += batch.length - (inserted?.length ?? 0);
        }

        setImportProgress(Math.min(i + BATCH_SIZE, toImport.length));
      }

      const finalReport: ImportReport = { imported, skipped, errors };
      setReport(finalReport);

      await logAudit({
        action: 'import',
        module: 'students',
        description: `${imported} alunos importados`,
      });
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Erro desconhecido na importação');
    }
    setImporting(false);
  }, [validationResults, mapping, classColumn, classes]);

  // ── Download template button ─────────────────────────────────────────────

  const handleDownloadTemplate = useCallback(() => {
    const fields = Object.entries(mapping)
      .filter(([, col]) => col)
      .map(([field, col]) => ({ column: col, field }));
    if (fields.length === 0) {
      // Default template with all fields
      downloadImportTemplate(
        STUDENT_IMPORT_FIELDS.map((f) => ({ column: f.label, field: f.key })),
      );
    } else {
      downloadImportTemplate(fields);
    }
  }, [mapping]);

  // ── Mapped name helper ───────────────────────────────────────────────────

  const getNameValue = (row: Record<string, string>) => {
    const col = mapping['full_name'];
    return col ? (row[col] || '—') : '—';
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/alunos')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <FileSpreadsheet className="w-6 h-6 text-brand-primary dark:text-brand-secondary" />
        <h1 className="text-xl font-display font-bold text-gray-900 dark:text-white">
          Importar Alunos
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
                step === s.num
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="w-8 h-px bg-gray-200 dark:bg-gray-600" />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Enviar Planilha
          </h2>

          {/* Drop zone */}
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
              {parsing
                ? 'Lendo planilha...'
                : 'Arraste um arquivo .xlsx ou .csv aqui, ou clique para selecionar'}
            </p>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={onFileSelect}
            />
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {parseError}
            </div>
          )}

          {/* Download template shortcut */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-primary dark:text-brand-secondary hover:bg-brand-primary/5 dark:hover:bg-brand-secondary/5 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Baixar Template
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Mapeamento ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Mapeamento de Colunas
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {fileName} — {rows.length} linhas • {headers.length} colunas detectadas
              </p>
            </div>
            {/* Detection action buttons */}
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

          {/* Auto-detection summary */}
          {Object.keys(autoConfidence).length > 0 && (() => {
            const high = Object.values(autoConfidence).filter((c) => c === 'high').length;
            const low  = Object.values(autoConfidence).filter((c) => c === 'low').length;
            return (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-xs text-emerald-700 dark:text-emerald-400">
                <Wand2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Detecção automática: <strong>{high}</strong> campo{high !== 1 ? 's' : ''} com alta confiança
                  {low > 0 && <>, <strong>{low}</strong> para verificar</>}.
                  {' '}Revise e ajuste antes de continuar.
                </span>
              </div>
            );
          })()}

          {/* Template selector */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Template salvo
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">— Nenhum —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
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

          {/* Column mapping table — field-first orientation */}
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
            {/* Table header */}
            <div className="grid grid-cols-2 gap-3 px-3 pb-1">
              <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Campo do sistema
              </span>
              <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Coluna no arquivo
              </span>
            </div>

            {STUDENT_IMPORT_FIELDS.map((field) => {
              const currentColumn = mapping[field.key] ?? '';
              const conf = autoConfidence[field.key];
              const showHighBadge = conf === 'high' && !!currentColumn;
              const showLowBadge  = conf === 'low'  && !!currentColumn;

              return (
                <div
                  key={field.key}
                  className={`grid grid-cols-2 gap-3 items-center p-3 rounded-lg ${
                    field.required && !currentColumn
                      ? 'bg-red-50/60 dark:bg-red-900/10'
                      : 'bg-gray-50 dark:bg-gray-700/40'
                  }`}
                >
                  {/* System field label */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {field.label}
                      {field.required && (
                        <span className="text-red-500 ml-0.5">*</span>
                      )}
                    </span>
                    {showHighBadge && (
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <Check className="w-2.5 h-2.5" /> Auto
                      </span>
                    )}
                    {showLowBadge && (
                      <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertTriangle className="w-2.5 h-2.5" /> Verificar
                      </span>
                    )}
                  </div>

                  {/* File column dropdown */}
                  <select
                    value={currentColumn}
                    onChange={(e) => {
                      setMapping((m) => ({ ...m, [field.key]: e.target.value }));
                      // Remove auto-confidence badge when user manually changes
                      setAutoConfidence((c) => { const n = { ...c }; delete n[field.key]; return n; });
                    }}
                    className={`${INPUT_CLASS} ${
                      field.required && !currentColumn
                        ? 'border-red-300 dark:border-red-700 focus:border-red-400'
                        : ''
                    }`}
                  >
                    <option value="">— Ignorar —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Class column */}
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
              Turma (resolução automática por nome)
            </label>
            <select
              value={classColumn}
              onChange={(e) => setClassColumn(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">— Nenhuma —</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
              O valor da coluna é comparado com os nomes das turmas cadastradas (correspondência aproximada).
            </p>
          </div>

          {/* Save template */}
          <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Salvar como template
              </label>
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

          {/* Required fields reminder */}
          {!requiredFieldsMapped && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Mapeie os campos obrigatórios marcados com * para continuar.
            </div>
          )}

          {/* Navigation */}
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
              disabled={!requiredFieldsMapped || validating}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Validar e Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview & Validação ────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Preview &amp; Validação
          </h2>

          {/* Counters */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <Check className="w-4 h-4" />
              {validCount} válidos
            </span>
            <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <X className="w-4 h-4" />
              {errorCount} com erro
            </span>
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              {duplicateCount} duplicados
            </span>
          </div>

          {/* Table */}
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
                      <button
                        onClick={() => !r.valid && toggleExpand(r.rowIndex)}
                        className="text-left hover:underline"
                      >
                        {getNameValue(r.row)}
                      </button>
                      {expandedRows.has(r.rowIndex) && r.errors.length > 0 && (
                        <ul className="mt-1 text-xs text-red-500 dark:text-red-400 space-y-0.5 list-disc list-inside">
                          {r.errors.map((err, ei) => (
                            <li key={ei}>{err}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.valid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <Check className="w-3 h-3" /> Válido
                        </span>
                      ) : r.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" /> Duplicado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <X className="w-3 h-3" /> Erro
                        </span>
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

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              onClick={handleImport}
              disabled={validCount === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importar {validCount} alunos
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Importação & Relatório ─────────────────────────────── */}
      {step === 4 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Importação
          </h2>

          {/* Progress bar */}
          {importing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importando...
                </span>
                <span>
                  {importProgress} / {importTotal}
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-primary dark:bg-brand-secondary rounded-full transition-all duration-300"
                  style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {importError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {importError}
            </div>
          )}

          {/* Report */}
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

              <button
                onClick={() => navigate('/admin/alunos')}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar para Alunos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

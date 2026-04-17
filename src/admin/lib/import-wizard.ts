/**
 * import-wizard.ts — helpers genericos para o ModuleImportWizard.
 *
 * O wizard em si e agnostico de dominio; cada modulo (students, segments,
 * fornecedores, ...) fornece um `ModuleImportConfig` com seus campos,
 * aliases, validacao e construcao de registro. Este arquivo centraliza os
 * tipos e o motor de auto-deteccao reutilizavel.
 */

import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
}

/**
 * Coluna "fora do catalogo de campos" — ex.: nome da turma para alunos,
 * que nao e gravado diretamente mas resolvido para um class_id. Cada config
 * pode declarar uma ou mais e usar os valores em `buildRecord`.
 */
export interface ExtraColumnDef {
  key: string;
  label: string;
  aliases: string[];
  hint?: string;
}

export type MappingConfidence = 'high' | 'low';

export interface AutoDetectedField {
  column: string;
  confidence: MappingConfidence;
}

export interface ValidationContext {
  existingKeys: Set<string>;
  fileKeys: Set<string>;
}

export interface ImportReport {
  imported: number;
  skipped: number;
  errors: number;
}

/**
 * Context compartilhado entre `preImport` e `buildRecord`. Cada config
 * devolve um objeto arbitrario do `preImport` que o wizard passa de volta
 * para `buildRecord` em cada linha (enrollment_numbers, classes, etc.).
 */
export type ImportContext = Record<string, unknown>;

export interface ModuleImportConfig<Ctx extends ImportContext = ImportContext> {
  /** Chave em `module_imports` — usada para lock + audit. */
  moduleKey: string;
  /** Nome amigavel (singular) — usado em titulos e botoes. */
  label: string;
  /** Plural — usado em contagens ("X alunos importados"). */
  labelPlural: string;
  /** Icone Lucide exibido no header. */
  icon: LucideIcon;
  /** Rota para onde o botao "Voltar" leva antes da importacao. */
  backPath: string;
  /** Tabela-alvo para `import_templates.target_table`. */
  targetTable: string;
  /** Nome do arquivo baixado no "Baixar Template" (sem extensao). */
  templateFileName: string;

  fields: FieldDef[];
  fieldAliases: Record<string, string[]>;
  /** Regras de padrao de dado por campo (ex.: cpf=11digits). Opcional. */
  fieldPatterns?: Record<string, string[]>;
  /** Colunas extras (resolucao por nome, referencia externa, etc.). */
  extraColumns?: ExtraColumnDef[];

  /**
   * Carrega chaves ja existentes no banco para deteccao de duplicata
   * (ex.: Set de CPFs). Opcional — se omitido, nao ha dedupe com banco.
   */
  loadExistingKeys?: () => Promise<Set<string>>;
  /** Extrai a chave de deduplicacao de uma linha ja mapeada. */
  getRowKey?: (row: Record<string, string>, mapping: Record<string, string>) => string;

  /**
   * Valida uma linha. Retorna lista de erros (vazia = valida).
   * Recebe linha original, mapping field→column, extras mapeados e contexto
   * com sets de keys (banco + arquivo) para dup check.
   */
  validateRow: (
    row: Record<string, string>,
    mapping: Record<string, string>,
    extras: Record<string, string>,
    ctx: ValidationContext,
  ) => string[];

  /**
   * Executado 1x antes do primeiro batch. Pode carregar dados de referencia
   * (classes, segmentos, etc.) ou gerar numeros (enrollment_numbers).
   * Retorna um contexto que e passado para cada `buildRecord`.
   */
  preImport?: (toImportCount: number) => Promise<Ctx>;

  /**
   * Monta o registro final a ser inserido no banco.
   * @param mappedRow  valores ja extraidos por field key (field→value)
   * @param extras     valores das ExtraColumnDef por key
   * @param absoluteIdx indice global da linha dentro do conjunto filtrado
   * @param ctx        contexto retornado de preImport
   */
  buildRecord: (
    mappedRow: Record<string, string>,
    extras: Record<string, string>,
    absoluteIdx: number,
    ctx: Ctx,
  ) => Record<string, unknown>;

  /**
   * Sobrescreve o insert padrao (supabase.from(targetTable).insert(records)).
   * Retorna quantos foram aceitos e quantos deram erro no lote.
   */
  insertBatch?: (
    records: Record<string, unknown>[],
  ) => Promise<{ inserted: number; errors: number }>;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Data-pattern detection
// ---------------------------------------------------------------------------

function detectPatterns(samples: string[]): Set<string> {
  const nonEmpty = samples.filter((s) => s.trim());
  const out = new Set<string>();
  if (nonEmpty.length === 0) return out;

  if (nonEmpty.every((s) => s.replace(/\D/g, '').length === 11)) out.add('11digits');
  if (nonEmpty.every((s) => { const d = s.replace(/\D/g, ''); return d.length === 10 || d.length === 11; })) out.add('phone');
  if (nonEmpty.some((s) => s.includes('@'))) out.add('email');
  if (nonEmpty.some((s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s))) out.add('date');

  return out;
}

// ---------------------------------------------------------------------------
// Auto-detect mapping (generic)
// ---------------------------------------------------------------------------

/**
 * Detecta automaticamente o mapping de fields do sistema para headers da
 * planilha usando (1) aliases de nome e (2) padroes de dado (CPF, telefone,
 * email, data). Retorna um registro parcial — so inclui fields com match.
 */
export function autoDetectMappingFor(
  fields: FieldDef[],
  aliases: Record<string, string[]>,
  patterns: Record<string, string[]> | undefined,
  headers: string[],
  rows: Record<string, string>[],
): Record<string, AutoDetectedField> {
  const result: Record<string, AutoDetectedField> = {};
  const usedColumns = new Set<string>();
  const patternMap = patterns ?? {};

  for (const field of fields) {
    const fieldAliases = (aliases[field.key] ?? []).map(normalizeHeader);
    const expectedPatterns = patternMap[field.key] ?? [];

    let bestColumn = '';
    let bestConfidence: MappingConfidence = 'low';

    // Pass 1: name-alias matching
    for (const header of headers) {
      if (usedColumns.has(header)) continue;
      const nh = normalizeHeader(header);
      const nameMatch = fieldAliases.some((a) => nh === a || nh.includes(a) || a.includes(nh));
      if (!nameMatch) continue;

      if (expectedPatterns.length > 0) {
        const samples = rows.slice(0, 10).map((r) => r[header] ?? '').filter(Boolean);
        const p = detectPatterns(samples);
        const dataOk = expectedPatterns.some((x) => p.has(x));
        if (dataOk || samples.length === 0) {
          bestColumn = header;
          bestConfidence = 'high';
          break;
        } else if (!bestColumn) {
          bestColumn = header;
          bestConfidence = 'low';
        }
      } else {
        bestColumn = header;
        bestConfidence = 'high';
        break;
      }
    }

    // Pass 2: data-pattern-only
    if (!bestColumn && expectedPatterns.length > 0) {
      for (const header of headers) {
        if (usedColumns.has(header)) continue;
        const samples = rows.slice(0, 10).map((r) => r[header] ?? '').filter(Boolean);
        const p = detectPatterns(samples);
        if (expectedPatterns.some((x) => p.has(x))) {
          bestColumn = header;
          bestConfidence = 'low';
          break;
        }
      }
    }

    if (bestColumn) {
      result[field.key] = { column: bestColumn, confidence: bestConfidence };
      if (bestConfidence === 'high') usedColumns.add(bestColumn);
    }
  }

  return result;
}

/** Detecta coluna "extra" (ex.: turma) pela primeira alias que bater. */
export function autoDetectExtraColumn(
  aliases: string[],
  headers: string[],
): string {
  return headers.find((h) => aliases.some((a) => {
    const nh = normalizeHeader(h);
    return nh === a || nh.includes(a) || a.includes(nh);
  })) ?? '';
}

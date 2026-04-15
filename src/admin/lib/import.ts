import * as XLSX from 'xlsx';
import { isValidCPF, isValidEmail } from './masks';

// ---------------------------------------------------------------------------
// 1. Field definitions
// ---------------------------------------------------------------------------

export const STUDENT_IMPORT_FIELDS: { key: string; label: string; required?: boolean }[] = [
  // Student
  { key: 'full_name', label: 'Nome completo', required: true },
  { key: 'birth_date', label: 'Data de nascimento' },
  { key: 'cpf', label: 'CPF do aluno' },

  // Guardian
  { key: 'guardian_name', label: 'Nome do responsável', required: true },
  { key: 'guardian_phone', label: 'Telefone do responsável', required: true },
  { key: 'guardian_email', label: 'E-mail do responsável' },
  { key: 'guardian_cpf', label: 'CPF do responsável' },

  // Guardian address
  { key: 'guardian_zip_code', label: 'CEP do responsável' },
  { key: 'guardian_street', label: 'Rua do responsável' },
  { key: 'guardian_number', label: 'Número (responsável)' },
  { key: 'guardian_complement', label: 'Complemento (responsável)' },
  { key: 'guardian_neighborhood', label: 'Bairro (responsável)' },
  { key: 'guardian_city', label: 'Cidade (responsável)' },
  { key: 'guardian_state', label: 'Estado (responsável)' },

  // Student address
  { key: 'student_zip_code', label: 'CEP do aluno' },
  { key: 'student_street', label: 'Rua do aluno' },
  { key: 'student_number', label: 'Número (aluno)' },
  { key: 'student_complement', label: 'Complemento (aluno)' },
  { key: 'student_neighborhood', label: 'Bairro (aluno)' },
  { key: 'student_city', label: 'Cidade (aluno)' },
  { key: 'student_state', label: 'Estado (aluno)' },

  // Previous school
  { key: 'first_school', label: 'Primeira escola?' },
  { key: 'last_grade', label: 'Última série cursada' },
  { key: 'previous_school_name', label: 'Nome da escola anterior' },

  // Father
  { key: 'father_name', label: 'Nome do pai' },
  { key: 'father_cpf', label: 'CPF do pai' },
  { key: 'father_phone', label: 'Telefone do pai' },
  { key: 'father_email', label: 'E-mail do pai' },

  // Mother
  { key: 'mother_name', label: 'Nome da mãe' },
  { key: 'mother_cpf', label: 'CPF da mãe' },
  { key: 'mother_phone', label: 'Telefone da mãe' },
  { key: 'mother_email', label: 'E-mail da mãe' },

  // Other
  { key: 'internal_notes', label: 'Observações internas' },
];

// ---------------------------------------------------------------------------
// 2. Spreadsheet parser
// ---------------------------------------------------------------------------

export async function parseSpreadsheet(
  file: File,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const raw: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    rawNumbers: false,
  });

  if (raw.length === 0) return { headers: [], rows: [] };

  const headers = raw[0].map((h) => String(h).trim());
  const rows = raw.slice(1)
    .filter((r) => r.some((cell) => String(cell).trim() !== ''))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = String(r[i] ?? '').trim();
      });
      return obj;
    });

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// 3. Row validation
// NOTE: mapping is fieldKey → columnHeader (field-first orientation)
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ['full_name', 'guardian_name', 'guardian_phone'] as const;
const CPF_FIELDS = ['cpf', 'guardian_cpf', 'father_cpf', 'mother_cpf'] as const;
const EMAIL_FIELDS = ['guardian_email', 'father_email', 'mother_email'] as const;

export function validateStudentRow(
  row: Record<string, string>,
  mapping: Record<string, string>, // fieldKey → columnHeader
  existingCpfs: Set<string>,
  fileCpfs: Set<string>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Build mapped values: field key -> value
  const mapped: Record<string, string> = {};
  for (const [field, column] of Object.entries(mapping)) {
    if (column) mapped[field] = row[column] ?? '';
  }

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!mapped[field]?.trim()) {
      const def = STUDENT_IMPORT_FIELDS.find((f) => f.key === field);
      errors.push(`${def?.label ?? field} é obrigatório`);
    }
  }

  // CPF validation
  for (const field of CPF_FIELDS) {
    const value = mapped[field]?.replace(/\D/g, '');
    if (value) {
      if (!isValidCPF(value)) {
        const def = STUDENT_IMPORT_FIELDS.find((f) => f.key === field);
        errors.push(`${def?.label ?? field} inválido`);
      } else if (existingCpfs.has(value)) {
        errors.push(`CPF ${value} já cadastrado no sistema`);
      } else if (fileCpfs.has(value)) {
        errors.push(`CPF ${value} duplicado na planilha`);
      }
    }
  }

  // Email validation
  for (const field of EMAIL_FIELDS) {
    const value = mapped[field]?.trim();
    if (value && !isValidEmail(value)) {
      const def = STUDENT_IMPORT_FIELDS.find((f) => f.key === field);
      errors.push(`${def?.label ?? field} inválido`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// 4. Fuzzy class name resolver
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function resolveClassId(
  className: string,
  classes: { id: string; name: string }[],
): string | null {
  if (!className.trim()) return null;

  const target = normalize(className);

  // Exact normalized match
  const exact = classes.find((c) => normalize(c.name) === target);
  if (exact) return exact.id;

  // Partial match (class name contains input or vice-versa)
  const partial = classes.find(
    (c) => normalize(c.name).includes(target) || target.includes(normalize(c.name)),
  );
  if (partial) return partial.id;

  return null;
}

// ---------------------------------------------------------------------------
// 5. Template download
// ---------------------------------------------------------------------------

export function downloadImportTemplate(
  fields: { column: string; field: string }[],
): void {
  const headers = fields.map((f) => f.column);
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Importação');

  XLSX.writeFile(wb, 'modelo_importacao_alunos.xlsx');
}

// ---------------------------------------------------------------------------
// 6. Auto-detection engine
// ---------------------------------------------------------------------------

export type MappingConfidence = 'high' | 'low';

export interface AutoDetectedField {
  column: string;
  confidence: MappingConfidence;
}

/**
 * Known aliases for each system field.
 * Keys are normalized (lowercase, no accents, no spaces).
 */
const FIELD_ALIASES: Record<string, string[]> = {
  full_name:             ['nome', 'nomecompleto', 'aluno', 'estudante', 'name', 'fullname', 'nomealuno', 'nomeestudante'],
  birth_date:            ['nascimento', 'datanasc', 'dtnasc', 'datanascimento', 'dob', 'birthdate', 'datadenascimento'],
  cpf:                   ['cpf', 'cpfaluno', 'documento', 'doc', 'taxid'],
  guardian_name:         ['responsavel', 'nomeresponsavel', 'guardian', 'guardianname', 'nomeresp'],
  guardian_phone:        ['telefone', 'celular', 'fone', 'phone', 'tel', 'mobile', 'telefoneresponsavel', 'telresponsavel', 'celresponsavel'],
  guardian_email:        ['email', 'emal', 'mail', 'emailresponsavel', 'guardianemail', 'correio'],
  guardian_cpf:          ['cpfresponsavel', 'cpfrespons', 'cpfresp'],
  guardian_zip_code:     ['cep', 'zip', 'zipcode', 'cepresponsavel'],
  guardian_street:       ['rua', 'logradouro', 'street', 'endereco', 'enderecoresponsavel'],
  guardian_number:       ['numero', 'number', 'num', 'nr'],
  guardian_complement:   ['complemento', 'compl', 'complement'],
  guardian_neighborhood: ['bairro', 'neighborhood'],
  guardian_city:         ['cidade', 'city', 'municipio'],
  guardian_state:        ['estado', 'state', 'uf'],
  student_zip_code:      ['cepaluno', 'cepestudante'],
  student_street:        ['ruaaluno', 'logradouroaluno', 'enderecoaluno'],
  student_number:        ['numeroaluno', 'numaluno'],
  student_neighborhood:  ['bairroaluno'],
  student_city:          ['cidadealuno'],
  student_state:         ['estadoaluno', 'ufaluno'],
  father_name:           ['pai', 'nomepai', 'fathername', 'father'],
  father_cpf:            ['cpfpai'],
  father_phone:          ['telefonepai', 'fonepai', 'celpai'],
  father_email:          ['emailpai'],
  mother_name:           ['mae', 'nomemae', 'mothername', 'mother'],
  mother_cpf:            ['cpfmae'],
  mother_phone:          ['telefomae', 'fonemae', 'celmae'],
  mother_email:          ['emailmae'],
  internal_notes:        ['observacoes', 'obs', 'notas', 'notes', 'internalnotes'],
  last_grade:            ['serie', 'ultimaserie', 'grade', 'ano', 'anoleivo'],
  previous_school_name:  ['escolaanterior', 'previousschool', 'escolaorigem'],
};

/** Aliases for the special class column (not in STUDENT_IMPORT_FIELDS). */
export const CLASS_COLUMN_ALIASES = ['turma', 'class', 'classname', 'nomedaturma', 'nometurma', 'turmanome'];

/** Data patterns each field's values are expected to match. */
const FIELD_DATA_PATTERNS: Partial<Record<string, string[]>> = {
  cpf:              ['11digits'],
  birth_date:       ['date'],
  guardian_phone:   ['phone'],
  guardian_email:   ['email'],
  guardian_cpf:     ['11digits'],
  father_phone:     ['phone'],
  father_email:     ['email'],
  father_cpf:       ['11digits'],
  mother_phone:     ['phone'],
  mother_email:     ['email'],
  mother_cpf:       ['11digits'],
};

/** Detect what data patterns appear in a column's sample values. */
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

/**
 * Auto-detect mapping from spreadsheet headers to system fields.
 *
 * Returns Record<fieldKey, AutoDetectedField> for fields where a match was found.
 * Confidence levels:
 *   - 'high': name alias matched (+ data pattern consistent when applicable)
 *   - 'low':  data-pattern-only match, or name matched but data pattern inconsistent
 */
export function autoDetectMapping(
  headers: string[],
  rows: Record<string, string>[],
): Record<string, AutoDetectedField> {
  const result: Record<string, AutoDetectedField> = {};
  const usedColumns = new Set<string>();

  for (const field of STUDENT_IMPORT_FIELDS) {
    const aliases = (FIELD_ALIASES[field.key] ?? []).map(normalize);
    const expectedPatterns = FIELD_DATA_PATTERNS[field.key] ?? [];

    let bestColumn = '';
    let bestConfidence: MappingConfidence = 'low';

    // Pass 1: name-alias matching
    for (const header of headers) {
      if (usedColumns.has(header)) continue;
      const nh = normalize(header);
      const nameMatch = aliases.some((a) => nh === a || nh.includes(a) || a.includes(nh));
      if (!nameMatch) continue;

      if (expectedPatterns.length > 0) {
        const samples = rows.slice(0, 10).map((r) => r[header] ?? '').filter(Boolean);
        const patterns = detectPatterns(samples);
        const dataOk = expectedPatterns.some((p) => patterns.has(p));
        if (dataOk || samples.length === 0) {
          bestColumn = header;
          bestConfidence = 'high';
          break;
        } else if (!bestColumn) {
          bestColumn = header;
          bestConfidence = 'low'; // name matched but data diverged
        }
      } else {
        bestColumn = header;
        bestConfidence = 'high';
        break;
      }
    }

    // Pass 2: data-pattern-only (when no name match found)
    if (!bestColumn && expectedPatterns.length > 0) {
      for (const header of headers) {
        if (usedColumns.has(header)) continue;
        const samples = rows.slice(0, 10).map((r) => r[header] ?? '').filter(Boolean);
        const patterns = detectPatterns(samples);
        if (expectedPatterns.some((p) => patterns.has(p))) {
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

/**
 * Detect the most likely "class name" column from spreadsheet headers.
 * Returns the header string if found, or '' if not.
 */
export function autoDetectClassColumn(headers: string[]): string {
  return headers.find((h) => CLASS_COLUMN_ALIASES.some((a) => {
    const nh = normalize(h);
    return nh === a || nh.includes(a) || a.includes(nh);
  })) ?? '';
}

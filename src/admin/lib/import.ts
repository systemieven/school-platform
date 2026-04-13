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
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ['full_name', 'guardian_name', 'guardian_phone'] as const;
const CPF_FIELDS = ['cpf', 'guardian_cpf', 'father_cpf', 'mother_cpf'] as const;
const EMAIL_FIELDS = ['guardian_email', 'father_email', 'mother_email'] as const;

export function validateStudentRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
  existingCpfs: Set<string>,
  fileCpfs: Set<string>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Build mapped values: field key -> value
  const mapped: Record<string, string> = {};
  for (const [column, field] of Object.entries(mapping)) {
    if (field) mapped[field] = row[column] ?? '';
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

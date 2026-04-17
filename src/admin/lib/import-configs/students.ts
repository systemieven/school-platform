/**
 * Config de importacao de Alunos — consumido pelo <ModuleImportWizard />.
 */
import { GraduationCap } from 'lucide-react';
import type { ModuleImportConfig, ImportContext } from '../import-wizard';
import { supabase } from '../../../lib/supabase';
import { isValidCPF, isValidEmail } from '../masks';
import { resolveClassId } from '../import';
import type { SchoolClass } from '../../types/admin.types';

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

const FIELDS = [
  { key: 'full_name', label: 'Nome completo', required: true },
  { key: 'birth_date', label: 'Data de nascimento' },
  { key: 'cpf', label: 'CPF do aluno' },

  { key: 'guardian_name', label: 'Nome do responsável', required: true },
  { key: 'guardian_phone', label: 'Telefone do responsável', required: true },
  { key: 'guardian_email', label: 'E-mail do responsável' },
  { key: 'guardian_cpf', label: 'CPF do responsável' },

  { key: 'guardian_zip_code', label: 'CEP do responsável' },
  { key: 'guardian_street', label: 'Rua do responsável' },
  { key: 'guardian_number', label: 'Número (responsável)' },
  { key: 'guardian_complement', label: 'Complemento (responsável)' },
  { key: 'guardian_neighborhood', label: 'Bairro (responsável)' },
  { key: 'guardian_city', label: 'Cidade (responsável)' },
  { key: 'guardian_state', label: 'Estado (responsável)' },

  { key: 'student_zip_code', label: 'CEP do aluno' },
  { key: 'student_street', label: 'Rua do aluno' },
  { key: 'student_number', label: 'Número (aluno)' },
  { key: 'student_complement', label: 'Complemento (aluno)' },
  { key: 'student_neighborhood', label: 'Bairro (aluno)' },
  { key: 'student_city', label: 'Cidade (aluno)' },
  { key: 'student_state', label: 'Estado (aluno)' },

  { key: 'first_school', label: 'Primeira escola?' },
  { key: 'last_grade', label: 'Última série cursada' },
  { key: 'previous_school_name', label: 'Nome da escola anterior' },

  { key: 'father_name', label: 'Nome do pai' },
  { key: 'father_cpf', label: 'CPF do pai' },
  { key: 'father_phone', label: 'Telefone do pai' },
  { key: 'father_email', label: 'E-mail do pai' },

  { key: 'mother_name', label: 'Nome da mãe' },
  { key: 'mother_cpf', label: 'CPF da mãe' },
  { key: 'mother_phone', label: 'Telefone da mãe' },
  { key: 'mother_email', label: 'E-mail da mãe' },

  { key: 'internal_notes', label: 'Observações internas' },
];

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

const FIELD_PATTERNS: Record<string, string[]> = {
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

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface StudentsContext extends ImportContext {
  enrollmentNumbers: string[];
  classes: SchoolClass[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const STUDENT_IMPORT_CONFIG: ModuleImportConfig<StudentsContext> = {
  moduleKey: 'students',
  label: 'Aluno',
  labelPlural: 'alunos',
  icon: GraduationCap,
  backPath: '/admin/alunos',
  targetTable: 'students',
  templateFileName: 'modelo_importacao_alunos',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,
  fieldPatterns: FIELD_PATTERNS,

  extraColumns: [
    {
      key: 'class',
      label: 'Turma (resolução automática por nome)',
      aliases: ['turma', 'class', 'classname', 'nomedaturma', 'nometurma', 'turmanome'],
      hint: 'O valor da coluna é comparado com os nomes das turmas cadastradas (correspondência aproximada).',
    },
  ],

  async loadExistingKeys() {
    const { data } = await supabase
      .from('students')
      .select('cpf')
      .not('cpf', 'is', null);
    return new Set(
      (data ?? [])
        .map((s: { cpf: string | null }) => s.cpf?.replace(/\D/g, '') ?? '')
        .filter(Boolean),
    );
  },

  getRowKey(row, mapping) {
    const col = mapping['cpf'];
    if (!col) return '';
    return (row[col] ?? '').replace(/\D/g, '');
  },

  validateRow(row, mapping, _extras, ctx) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }

    const REQUIRED = ['full_name', 'guardian_name', 'guardian_phone'];
    for (const f of REQUIRED) {
      if (!mapped[f]?.trim()) {
        const def = FIELDS.find((x) => x.key === f);
        errors.push(`${def?.label ?? f} é obrigatório`);
      }
    }

    const CPFS = ['cpf', 'guardian_cpf', 'father_cpf', 'mother_cpf'];
    for (const f of CPFS) {
      const v = mapped[f]?.replace(/\D/g, '');
      if (!v) continue;
      const def = FIELDS.find((x) => x.key === f);
      if (!isValidCPF(v)) errors.push(`${def?.label ?? f} inválido`);
      else if (ctx.existingKeys.has(v)) errors.push(`CPF ${v} já cadastrado no sistema`);
      else if (ctx.fileKeys.has(v)) errors.push(`CPF ${v} duplicado na planilha`);
    }

    const EMAILS = ['guardian_email', 'father_email', 'mother_email'];
    for (const f of EMAILS) {
      const v = mapped[f]?.trim();
      if (v && !isValidEmail(v)) {
        const def = FIELDS.find((x) => x.key === f);
        errors.push(`${def?.label ?? f} inválido`);
      }
    }

    return errors;
  },

  async preImport(count) {
    const [enrollResult, classesResult] = await Promise.all([
      supabase.rpc('generate_enrollment_numbers', { p_count: count }),
      supabase.from('school_classes').select('*').order('name'),
    ]);
    if (enrollResult.error) {
      throw new Error(`Erro ao gerar matrículas: ${enrollResult.error.message}`);
    }
    return {
      enrollmentNumbers: (enrollResult.data as string[]) ?? [],
      classes: (classesResult.data as SchoolClass[]) ?? [],
    };
  },

  buildRecord(mappedRow, extras, absoluteIdx, ctx) {
    const record: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(mappedRow)) {
      record[field] = value?.trim() || null;
    }
    record.enrollment_number = ctx.enrollmentNumbers[absoluteIdx];
    const className = extras.class;
    if (className) {
      const classId = resolveClassId(className, ctx.classes);
      if (classId) record.class_id = classId;
    }
    record.status = 'active';
    return record;
  },
};

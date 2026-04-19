/**
 * Config de importacao de Colaboradores RH (tabela `staff`).
 *
 * Diferente de `users.ts`: aqui NAO cria auth.user nem profile. A insercao e
 * direta na tabela `staff`, que e o cadastro RH autonomo. A promocao para
 * login (auth + profile) continua sendo feita item-a-item via a UI de
 * `/admin/rh/colaboradores` (edge fn `staff-grant-access`).
 *
 * O step "Revisar" (perRowOverrides) permite ao admin ajustar `employment_type`
 * linha a linha antes do insert — nem toda planilha traz essa coluna.
 *
 * Dedup: por CPF (normalizado), contra `staff` existente. Linhas sem CPF sao
 * importadas sem dedup (sem key).
 */
import { BriefcaseBusiness } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';
import { isValidEmail } from '../masks';

const FIELDS = [
  { key: 'full_name',            label: 'Nome completo',     required: true },
  { key: 'email',                label: 'E-mail' },
  { key: 'phone',                label: 'Telefone' },
  { key: 'cpf',                  label: 'CPF' },
  { key: 'rg',                   label: 'RG' },
  { key: 'birth_date',           label: 'Data de nascimento' },
  { key: 'address_street',       label: 'Logradouro' },
  { key: 'address_number',       label: 'Número' },
  { key: 'address_complement',   label: 'Complemento' },
  { key: 'address_neighborhood', label: 'Bairro' },
  { key: 'address_city',         label: 'Cidade' },
  { key: 'address_state',        label: 'UF' },
  { key: 'address_zip',          label: 'CEP' },
  { key: 'position',             label: 'Cargo', required: true },
  { key: 'department',           label: 'Departamento' },
  { key: 'hire_date',            label: 'Data de admissão' },
  { key: 'employment_type',      label: 'Tipo de contrato' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  full_name:            ['nome', 'nomecompleto', 'fullname', 'name', 'colaborador', 'funcionario'],
  email:                ['email', 'mail', 'correio', 'e-mail'],
  phone:                ['telefone', 'fone', 'tel', 'celular', 'phone'],
  cpf:                  ['cpf', 'documento', 'doc'],
  rg:                   ['rg', 'identidade'],
  birth_date:           ['nascimento', 'datanascimento', 'birthdate', 'birth', 'dtnascimento'],
  address_street:       ['logradouro', 'rua', 'endereco', 'street'],
  address_number:       ['numero', 'num', 'number'],
  address_complement:   ['complemento', 'compl'],
  address_neighborhood: ['bairro', 'neighborhood'],
  address_city:         ['cidade', 'municipio', 'city'],
  address_state:        ['uf', 'estado', 'state'],
  address_zip:          ['cep', 'zip', 'zipcode'],
  position:             ['cargo', 'funcao', 'position', 'role'],
  department:           ['departamento', 'setor', 'department'],
  hire_date:            ['admissao', 'dataadmissao', 'hiredate', 'dtadmissao', 'dataentrada'],
  employment_type:      ['tipocontrato', 'tipo', 'contrato', 'regime', 'vinculo'],
};

const FIELD_PATTERNS: Record<string, string[]> = {
  email:       ['email'],
  phone:       ['phone'],
  cpf:         ['11digits'],
  birth_date:  ['date'],
  hire_date:   ['date'],
};

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'clt',           label: 'CLT' },
  { value: 'pj',            label: 'PJ' },
  { value: 'estagio',       label: 'Estágio' },
  { value: 'terceirizado',  label: 'Terceirizado' },
];

const VALID_EMPLOYMENT_TYPES = EMPLOYMENT_TYPE_OPTIONS.map((o) => o.value);

function onlyDigits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

/** Converte "DD/MM/YYYY" ou "YYYY-MM-DD" para ISO YYYY-MM-DD. Vazio → null. */
function normalizeDate(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s; // deixa o banco rejeitar se for invalido
}

export const STAFF_IMPORT_CONFIG: ModuleImportConfig = {
  moduleKey: 'rh-colaboradores',
  label: 'Colaborador RH',
  labelPlural: 'colaboradores RH',
  icon: BriefcaseBusiness,
  backPath: '/admin/migracao',
  targetTable: 'staff',
  templateFileName: 'modelo_importacao_colaboradores_rh',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,
  fieldPatterns: FIELD_PATTERNS,

  perRowOverrides: [
    {
      key: 'employment_type',
      label: 'Tipo de contrato',
      type: 'select',
      options: EMPLOYMENT_TYPE_OPTIONS,
      defaultValue: 'clt',
      required: true,
      hint: 'Regime aplicado ao colaborador (CLT, PJ, Estágio, Terceirizado).',
    },
  ],

  async loadExistingKeys() {
    const { data } = await supabase.from('staff').select('cpf').not('cpf', 'is', null);
    return new Set(
      (data ?? [])
        .map((r: { cpf: string | null }) => onlyDigits(r.cpf))
        .filter(Boolean),
    );
  },

  getRowKey(row, mapping) {
    const col = mapping['cpf'];
    if (!col) return '';
    return onlyDigits(row[col]);
  },

  validateRow(row, mapping, _extras, ctx) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }

    if (!mapped.full_name?.trim()) errors.push('Nome completo é obrigatório');
    if (!mapped.position?.trim()) errors.push('Cargo é obrigatório');

    const email = mapped.email?.trim();
    if (email && !isValidEmail(email)) errors.push('E-mail inválido');

    const cpf = onlyDigits(mapped.cpf);
    if (cpf) {
      if (cpf.length !== 11) errors.push('CPF deve ter 11 dígitos');
      else if (ctx.existingKeys.has(cpf)) errors.push(`CPF ${cpf} já cadastrado`);
      else if (ctx.fileKeys.has(cpf)) errors.push(`CPF ${cpf} duplicado na planilha`);
    }

    const empType = mapped.employment_type?.trim().toLowerCase();
    if (empType && !VALID_EMPLOYMENT_TYPES.includes(empType)) {
      errors.push(`Tipo de contrato inválido: ${empType} (use CLT, PJ, Estágio ou Terceirizado)`);
    }

    return errors;
  },

  buildRecord(mappedRow, _extras, _i, _ctx, overrides) {
    const today = new Date().toISOString().slice(0, 10);
    const employmentTypeOverride = overrides?.employment_type?.trim().toLowerCase();
    const fileType = mappedRow.employment_type?.trim().toLowerCase();
    const employment_type = VALID_EMPLOYMENT_TYPES.includes(employmentTypeOverride ?? '')
      ? employmentTypeOverride!
      : VALID_EMPLOYMENT_TYPES.includes(fileType ?? '') ? fileType! : 'clt';

    return {
      full_name: mappedRow.full_name.trim(),
      email: mappedRow.email?.trim().toLowerCase() || null,
      phone: onlyDigits(mappedRow.phone) || null,
      cpf: onlyDigits(mappedRow.cpf) || null,
      rg: mappedRow.rg?.trim() || null,
      birth_date: normalizeDate(mappedRow.birth_date),
      address_street: mappedRow.address_street?.trim() || null,
      address_number: mappedRow.address_number?.trim() || null,
      address_complement: mappedRow.address_complement?.trim() || null,
      address_neighborhood: mappedRow.address_neighborhood?.trim() || null,
      address_city: mappedRow.address_city?.trim() || null,
      address_state: mappedRow.address_state?.trim().toUpperCase() || null,
      address_zip: onlyDigits(mappedRow.address_zip) || null,
      position: mappedRow.position.trim(),
      department: mappedRow.department?.trim() || null,
      hire_date: normalizeDate(mappedRow.hire_date) || today,
      employment_type,
    };
  },

  async insertBatch(records) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { inserted: 0, errors: records.length };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const url = `${supabaseUrl}/functions/v1/bulk-import-staff`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ staff: records }),
      });
      if (!res.ok) return { inserted: 0, errors: records.length };
      const json = await res.json();
      return {
        inserted: Number(json.inserted ?? 0),
        errors: Number(json.errors ?? 0),
      };
    } catch {
      return { inserted: 0, errors: records.length };
    }
  },
};

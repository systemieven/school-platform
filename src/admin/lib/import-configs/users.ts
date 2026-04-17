/**
 * Config de importacao de Colaboradores (profiles + auth.users).
 *
 * Fluxo diferenciado:
 *  - A planilha traz email + nome + telefone opcional.
 *  - O step "Revisar" (perRowOverrides) permite que o admin escolha o papel
 *    de cada usuario antes do insert. Aplicar a todos disponivel.
 *  - `insertBatch` delega para a Edge Function `bulk-import-users`, que cria
 *    a linha em auth.users (com senha temporaria) + atualiza o profile com
 *    must_change_password=true. O usuario trocara a senha no primeiro login.
 *
 * Dedup: por email, contra profiles existentes.
 */
import { Users } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';
import { isValidEmail } from '../masks';

const FIELDS = [
  { key: 'email',     label: 'E-mail',     required: true },
  { key: 'full_name', label: 'Nome completo', required: true },
  { key: 'phone',     label: 'Telefone' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  email:     ['email', 'mail', 'correio', 'e-mail'],
  full_name: ['nome', 'nomecompleto', 'fullname', 'name'],
  phone:     ['telefone', 'fone', 'tel', 'celular', 'phone'],
};

const FIELD_PATTERNS: Record<string, string[]> = {
  email: ['email'],
  phone: ['phone'],
};

const ROLE_OPTIONS = [
  { value: 'admin',       label: 'Admin' },
  { value: 'coordinator', label: 'Coordenador(a)' },
  { value: 'teacher',     label: 'Professor(a)' },
  { value: 'user',        label: 'Colaborador geral' },
  { value: 'super_admin', label: 'Super admin' },
];

export const USERS_IMPORT_CONFIG: ModuleImportConfig = {
  moduleKey: 'users',
  label: 'Colaborador',
  labelPlural: 'colaboradores',
  icon: Users,
  backPath: '/admin/migracao',
  targetTable: 'profiles',
  templateFileName: 'modelo_importacao_colaboradores',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,
  fieldPatterns: FIELD_PATTERNS,

  perRowOverrides: [
    {
      key: 'role',
      label: 'Permissão',
      type: 'select',
      options: ROLE_OPTIONS,
      defaultValue: 'user',
      required: true,
      hint: 'Define o que o usuário enxerga ao logar.',
    },
  ],

  async loadExistingKeys() {
    const { data } = await supabase.from('profiles').select('email').not('email', 'is', null);
    return new Set(
      (data ?? [])
        .map((r: { email: string }) => r.email.trim().toLowerCase())
        .filter(Boolean),
    );
  },

  getRowKey(row, mapping) {
    const col = mapping['email'];
    if (!col) return '';
    return (row[col] ?? '').trim().toLowerCase();
  },

  validateRow(row, mapping, _extras, ctx) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }

    const email = mapped.email?.trim().toLowerCase();
    if (!email) errors.push('E-mail é obrigatório');
    else if (!isValidEmail(email)) errors.push('E-mail inválido');
    else if (ctx.existingKeys.has(email)) errors.push(`E-mail ${email} já cadastrado`);
    else if (ctx.fileKeys.has(email)) errors.push(`E-mail ${email} duplicado na planilha`);

    if (!mapped.full_name?.trim()) errors.push('Nome completo é obrigatório');

    return errors;
  },

  buildRecord(mappedRow, _extras, _i, _ctx, overrides) {
    return {
      email: mappedRow.email.trim().toLowerCase(),
      full_name: mappedRow.full_name.trim(),
      phone: mappedRow.phone?.trim() || null,
      role: overrides?.role || 'user',
    };
  },

  async insertBatch(records) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return { inserted: 0, errors: records.length };

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const url = `${supabaseUrl}/functions/v1/bulk-import-users`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ users: records }),
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

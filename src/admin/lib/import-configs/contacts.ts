/**
 * Config de importacao de Contatos (CRM) — contact_requests.
 */
import { MessageSquare } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';
import { isValidEmail } from '../masks';

const FIELDS = [
  { key: 'name', label: 'Nome', required: true },
  { key: 'phone', label: 'Telefone', required: true },
  { key: 'email', label: 'E-mail' },
  { key: 'contact_reason', label: 'Motivo do contato' },
  { key: 'message', label: 'Mensagem' },
  { key: 'segment_interest', label: 'Segmento de interesse' },
  { key: 'student_count', label: 'Qtd. de alunos' },
  { key: 'how_found_us', label: 'Como nos conheceu' },
  { key: 'internal_notes', label: 'Observações internas' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  name:              ['nome', 'name', 'contato', 'nomecontato', 'fullname'],
  phone:             ['telefone', 'celular', 'fone', 'phone', 'tel', 'mobile', 'whatsapp'],
  email:             ['email', 'mail', 'correio', 'emailcontato'],
  contact_reason:    ['motivo', 'reason', 'assunto', 'subject'],
  message:           ['mensagem', 'message', 'observacao', 'msg'],
  segment_interest:  ['segmento', 'interesse', 'segmentointeresse', 'segment'],
  student_count:     ['qtdalunos', 'numeroalunos', 'alunos'],
  how_found_us:      ['comonosconheceu', 'origem', 'howfoundus', 'canal'],
  internal_notes:    ['notas', 'notes', 'notasinternas', 'internalnotes'],
};

const FIELD_PATTERNS: Record<string, string[]> = {
  phone: ['phone'],
  email: ['email'],
};

export const CONTACTS_IMPORT_CONFIG: ModuleImportConfig = {
  moduleKey: 'contacts',
  label: 'Contato',
  labelPlural: 'contatos',
  icon: MessageSquare,
  backPath: '/admin/migracao',
  targetTable: 'contact_requests',
  templateFileName: 'modelo_importacao_contatos',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,
  fieldPatterns: FIELD_PATTERNS,

  async loadExistingKeys() {
    const { data } = await supabase
      .from('contact_requests')
      .select('phone')
      .not('phone', 'is', null);
    return new Set((data ?? []).map((r: { phone: string }) => r.phone.replace(/\D/g, '')).filter(Boolean));
  },

  getRowKey(row, mapping) {
    const col = mapping['phone'];
    if (!col) return '';
    return (row[col] ?? '').replace(/\D/g, '');
  },

  validateRow(row, mapping, _extras, ctx) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }

    if (!mapped.name?.trim()) errors.push('Nome é obrigatório');
    const phone = mapped.phone?.replace(/\D/g, '');
    if (!phone) errors.push('Telefone é obrigatório');
    else if (phone.length < 10 || phone.length > 11) errors.push('Telefone inválido');
    else if (ctx.existingKeys.has(phone)) errors.push(`Telefone ${phone} já cadastrado`);
    else if (ctx.fileKeys.has(phone)) errors.push(`Telefone ${phone} duplicado na planilha`);

    if (mapped.email && !isValidEmail(mapped.email)) errors.push('E-mail inválido');

    return errors;
  },

  buildRecord(mappedRow) {
    const record: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(mappedRow)) {
      record[field] = value?.trim() || null;
    }
    record.status = 'new';
    record.is_lead = false;
    return record;
  },
};

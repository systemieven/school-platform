/**
 * Config de importacao de Fornecedores.
 */
import { Building2 } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';
import { isValidEmail } from '../masks';

const FIELDS = [
  { key: 'razao_social', label: 'Razão social / Nome', required: true },
  { key: 'cnpj_cpf', label: 'CNPJ / CPF', required: true },
  { key: 'nome_fantasia', label: 'Nome fantasia' },
  { key: 'tipo_pessoa', label: 'Tipo pessoa (fisica/juridica)' },
  { key: 'ie', label: 'Inscrição Estadual' },
  { key: 'im', label: 'Inscrição Municipal' },
  { key: 'email', label: 'E-mail' },
  { key: 'email_financeiro', label: 'E-mail financeiro' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'telefone_secundario', label: 'Telefone secundário' },
  { key: 'contato_nome', label: 'Nome do contato' },
  { key: 'contato_telefone', label: 'Telefone do contato' },
  { key: 'site', label: 'Site' },
  { key: 'cep', label: 'CEP' },
  { key: 'logradouro', label: 'Logradouro' },
  { key: 'numero', label: 'Número' },
  { key: 'complemento', label: 'Complemento' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'municipio', label: 'Município' },
  { key: 'uf', label: 'UF' },
  { key: 'observacoes', label: 'Observações' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  razao_social:         ['razaosocial', 'nome', 'name', 'razao', 'fornecedor'],
  cnpj_cpf:             ['cnpj', 'cpf', 'cnpjcpf', 'documento', 'doc'],
  nome_fantasia:        ['nomefantasia', 'fantasia', 'apelido'],
  tipo_pessoa:          ['tipopessoa', 'tipo', 'pessoa'],
  ie:                   ['ie', 'inscricaoestadual'],
  im:                   ['im', 'inscricaomunicipal'],
  email:                ['email', 'mail', 'correio'],
  email_financeiro:     ['emailfinanceiro', 'mailfinanceiro'],
  telefone:             ['telefone', 'fone', 'tel', 'phone'],
  telefone_secundario:  ['telefonesecundario', 'telefone2', 'celular'],
  contato_nome:         ['contatonome', 'nomecontato', 'contact'],
  contato_telefone:     ['contatotelefone', 'telcontato'],
  site:                 ['site', 'website', 'url'],
  cep:                  ['cep', 'zip', 'zipcode'],
  logradouro:           ['logradouro', 'rua', 'endereco', 'street'],
  numero:               ['numero', 'num', 'number'],
  complemento:          ['complemento', 'compl'],
  bairro:               ['bairro', 'neighborhood'],
  municipio:            ['municipio', 'cidade', 'city'],
  uf:                   ['uf', 'estado', 'state'],
  observacoes:          ['observacoes', 'obs', 'notas', 'notes'],
};

const FIELD_PATTERNS: Record<string, string[]> = {
  email: ['email'],
  email_financeiro: ['email'],
  telefone: ['phone'],
  telefone_secundario: ['phone'],
  contato_telefone: ['phone'],
};

export const FORNECEDORES_IMPORT_CONFIG: ModuleImportConfig = {
  moduleKey: 'fornecedores',
  label: 'Fornecedor',
  labelPlural: 'fornecedores',
  icon: Building2,
  backPath: '/admin/migracao',
  targetTable: 'fornecedores',
  templateFileName: 'modelo_importacao_fornecedores',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,
  fieldPatterns: FIELD_PATTERNS,

  async loadExistingKeys() {
    const { data } = await supabase.from('fornecedores').select('cnpj_cpf');
    return new Set(
      (data ?? [])
        .map((r: { cnpj_cpf: string }) => r.cnpj_cpf.replace(/\D/g, ''))
        .filter(Boolean),
    );
  },

  getRowKey(row, mapping) {
    const col = mapping['cnpj_cpf'];
    if (!col) return '';
    return (row[col] ?? '').replace(/\D/g, '');
  },

  validateRow(row, mapping, _extras, ctx) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }

    if (!mapped.razao_social?.trim()) errors.push('Razão social é obrigatória');
    const doc = mapped.cnpj_cpf?.replace(/\D/g, '');
    if (!doc) errors.push('CNPJ/CPF é obrigatório');
    else if (doc.length !== 11 && doc.length !== 14) errors.push('CNPJ/CPF inválido (deve ter 11 ou 14 dígitos)');
    else if (ctx.existingKeys.has(doc)) errors.push(`CNPJ/CPF ${doc} já cadastrado`);
    else if (ctx.fileKeys.has(doc)) errors.push(`CNPJ/CPF ${doc} duplicado na planilha`);

    if (mapped.email && !isValidEmail(mapped.email)) errors.push('E-mail inválido');
    if (mapped.email_financeiro && !isValidEmail(mapped.email_financeiro)) errors.push('E-mail financeiro inválido');

    const tipo = mapped.tipo_pessoa?.trim().toLowerCase();
    if (tipo && tipo !== 'fisica' && tipo !== 'juridica' && tipo !== 'física' && tipo !== 'jurídica') {
      errors.push('Tipo pessoa deve ser "fisica" ou "juridica"');
    }

    return errors;
  },

  buildRecord(mappedRow) {
    const record: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(mappedRow)) {
      const v = value?.trim() || null;
      if (field === 'cnpj_cpf' && v) {
        record[field] = v.replace(/\D/g, '');
      } else if (field === 'tipo_pessoa' && v) {
        const norm = v.toLowerCase().replace(/[áâã]/g, 'a').replace(/[í]/g, 'i');
        record[field] = norm.startsWith('fisica') ? 'fisica' : 'juridica';
      } else {
        record[field] = v;
      }
    }
    // Default tipo_pessoa by document length if not provided
    if (!record.tipo_pessoa) {
      const doc = (mappedRow.cnpj_cpf ?? '').replace(/\D/g, '');
      record.tipo_pessoa = doc.length === 11 ? 'fisica' : 'juridica';
    }
    record.status = 'ativo';
    return record;
  },
};

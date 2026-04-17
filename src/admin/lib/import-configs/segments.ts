/**
 * Config de importacao de Segmentos (school_segments).
 *
 * Primeiro passo da hierarquia academica. Apos sucesso, libera series
 * (school-series), que por sua vez libera turmas (school-classes).
 */
import { GraduationCap } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';

const FIELDS = [
  { key: 'name', label: 'Nome', required: true },
  { key: 'description', label: 'Descrição' },
  { key: 'position', label: 'Posição (ordem)' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  name:        ['nome', 'name', 'segmento', 'segment'],
  description: ['descricao', 'description', 'desc'],
  position:    ['posicao', 'position', 'ordem', 'order'],
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SEGMENTS_IMPORT_CONFIG: ModuleImportConfig = {
  moduleKey: 'segments',
  label: 'Segmento',
  labelPlural: 'segmentos',
  icon: GraduationCap,
  backPath: '/admin/migracao',
  targetTable: 'school_segments',
  templateFileName: 'modelo_importacao_segmentos',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,

  async loadExistingKeys() {
    const { data } = await supabase.from('school_segments').select('slug');
    return new Set((data ?? []).map((r: { slug: string }) => r.slug));
  },

  getRowKey(row, mapping) {
    const col = mapping['name'];
    if (!col) return '';
    return slugify(row[col] ?? '');
  },

  validateRow(row, mapping, _extras, ctx) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }

    if (!mapped.name?.trim()) errors.push('Nome é obrigatório');
    const slug = slugify(mapped.name ?? '');
    if (slug && ctx.existingKeys.has(slug)) errors.push(`Segmento "${mapped.name}" já cadastrado`);
    else if (slug && ctx.fileKeys.has(slug)) errors.push(`Segmento "${mapped.name}" duplicado na planilha`);

    if (mapped.position && isNaN(Number(mapped.position))) {
      errors.push('Posição deve ser um número');
    }

    return errors;
  },

  buildRecord(mappedRow) {
    const name = mappedRow.name?.trim() ?? '';
    return {
      name,
      slug: slugify(name),
      description: mappedRow.description?.trim() || null,
      position: mappedRow.position ? Number(mappedRow.position) : 0,
      is_active: true,
    };
  },
};

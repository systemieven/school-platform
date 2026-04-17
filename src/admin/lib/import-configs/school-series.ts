/**
 * Config de importacao de Series (school_series).
 *
 * Cada serie pertence a um segmento. `segment_name` e resolvido em
 * `preImport` contra o cache de segmentos ja cadastrados.
 */
import { BookOpen } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';

const FIELDS = [
  { key: 'segment_name', label: 'Segmento (nome)', required: true },
  { key: 'name', label: 'Nome da série', required: true },
  { key: 'short_name', label: 'Nome curto' },
  { key: 'order_index', label: 'Ordem' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  segment_name: ['segmento', 'segment', 'nomesegmento', 'segmentnome'],
  name:         ['nome', 'name', 'serie', 'series', 'nomeserie'],
  short_name:   ['nomecurto', 'shortname', 'abreviacao'],
  order_index:  ['ordem', 'order', 'orderindex', 'posicao', 'position'],
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

interface SeriesContext extends Record<string, unknown> {
  segmentByName: Record<string, string>;
}

export const SCHOOL_SERIES_IMPORT_CONFIG: ModuleImportConfig<SeriesContext> = {
  moduleKey: 'school-series',
  label: 'Série',
  labelPlural: 'séries',
  icon: BookOpen,
  backPath: '/admin/migracao',
  targetTable: 'school_series',
  templateFileName: 'modelo_importacao_series',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,

  async loadExistingKeys() {
    const { data } = await supabase.from('school_series').select('segment_id, name');
    return new Set(
      (data ?? []).map((r: { segment_id: string; name: string }) => `${r.segment_id}::${normalize(r.name)}`),
    );
  },

  getRowKey() {
    // Composite key só resolvível após preImport (segment_id lookup).
    // Deixamos em branco aqui; dup check passa a depender de validateRow
    // usando existingKeys direto via contexto do pre-resolver.
    return '';
  },

  validateRow(row, mapping, _extras) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }
    if (!mapped.segment_name?.trim()) errors.push('Segmento é obrigatório');
    if (!mapped.name?.trim()) errors.push('Nome da série é obrigatório');
    if (mapped.order_index && isNaN(Number(mapped.order_index))) {
      errors.push('Ordem deve ser um número');
    }
    return errors;
  },

  async preImport() {
    const { data } = await supabase.from('school_segments').select('id, name');
    const map: Record<string, string> = {};
    for (const s of (data ?? []) as { id: string; name: string }[]) {
      map[normalize(s.name)] = s.id;
    }
    return { segmentByName: map };
  },

  buildRecord(mappedRow, _extras, _i, ctx) {
    const segmentName = normalize(mappedRow.segment_name ?? '');
    const segment_id = ctx.segmentByName[segmentName];
    if (!segment_id) {
      throw new Error(`Segmento "${mappedRow.segment_name}" não encontrado. Importe os segmentos primeiro.`);
    }
    return {
      segment_id,
      name: mappedRow.name.trim(),
      short_name: mappedRow.short_name?.trim() || null,
      order_index: mappedRow.order_index ? Number(mappedRow.order_index) : 0,
      is_active: true,
    };
  },
};

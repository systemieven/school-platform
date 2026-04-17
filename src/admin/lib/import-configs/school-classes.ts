/**
 * Config de importacao de Turmas (school_classes).
 *
 * Cada turma pertence a uma serie (FK school_series) e carrega tambem
 * segment_id (derivado da serie). preImport carrega o cache de series ja
 * cadastradas para fazer lookup por nome.
 */
import { Users } from 'lucide-react';
import type { ModuleImportConfig } from '../import-wizard';
import { supabase } from '../../../lib/supabase';

const FIELDS = [
  { key: 'series_name', label: 'Série (nome)', required: true },
  { key: 'name', label: 'Nome da turma', required: true },
  { key: 'school_year', label: 'Ano letivo' },
  { key: 'shift', label: 'Turno (morning/afternoon/full)' },
  { key: 'max_students', label: 'Máximo de alunos' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  series_name:  ['serie', 'series', 'nomeserie', 'seriename'],
  name:         ['nome', 'name', 'turma', 'class', 'nometurma'],
  school_year:  ['ano', 'anoletivo', 'schoolyear', 'year'],
  shift:        ['turno', 'shift', 'periodo'],
  max_students: ['maxalunos', 'maximo', 'capacidade', 'maxstudents'],
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function normalizeShift(v: string | undefined): 'morning' | 'afternoon' | 'full' {
  const s = (v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (s.startsWith('tarde') || s.startsWith('after')) return 'afternoon';
  if (s.startsWith('integral') || s.startsWith('full')) return 'full';
  return 'morning';
}

interface ClassesContext extends Record<string, unknown> {
  seriesByName: Record<string, { id: string; segment_id: string }>;
  defaultYear: number;
}

export const SCHOOL_CLASSES_IMPORT_CONFIG: ModuleImportConfig<ClassesContext> = {
  moduleKey: 'school-classes',
  label: 'Turma',
  labelPlural: 'turmas',
  icon: Users,
  backPath: '/admin/migracao',
  targetTable: 'school_classes',
  templateFileName: 'modelo_importacao_turmas',

  fields: FIELDS,
  fieldAliases: FIELD_ALIASES,

  validateRow(row, mapping) {
    const errors: string[] = [];
    const mapped: Record<string, string> = {};
    for (const [field, column] of Object.entries(mapping)) {
      if (column) mapped[field] = row[column] ?? '';
    }
    if (!mapped.series_name?.trim()) errors.push('Série é obrigatória');
    if (!mapped.name?.trim()) errors.push('Nome da turma é obrigatório');
    if (mapped.school_year && isNaN(Number(mapped.school_year))) {
      errors.push('Ano letivo deve ser um número');
    }
    if (mapped.max_students && isNaN(Number(mapped.max_students))) {
      errors.push('Máximo de alunos deve ser um número');
    }
    return errors;
  },

  async preImport() {
    const { data } = await supabase
      .from('school_series')
      .select('id, name, segment_id');
    const map: Record<string, { id: string; segment_id: string }> = {};
    for (const s of (data ?? []) as { id: string; name: string; segment_id: string }[]) {
      map[normalize(s.name)] = { id: s.id, segment_id: s.segment_id };
    }
    return {
      seriesByName: map,
      defaultYear: new Date().getFullYear(),
    };
  },

  buildRecord(mappedRow, _extras, _i, ctx) {
    const seriesKey = normalize(mappedRow.series_name ?? '');
    const series = ctx.seriesByName[seriesKey];
    if (!series) {
      throw new Error(`Série "${mappedRow.series_name}" não encontrada. Importe as séries primeiro.`);
    }
    return {
      series_id: series.id,
      segment_id: series.segment_id,
      name: mappedRow.name.trim(),
      school_year: mappedRow.school_year ? Number(mappedRow.school_year) : ctx.defaultYear,
      shift: normalizeShift(mappedRow.shift),
      max_students: mappedRow.max_students ? Number(mappedRow.max_students) : null,
      is_active: true,
    };
  },
};

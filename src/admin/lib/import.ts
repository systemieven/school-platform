/**
 * import.ts — utilitarios basicos de importacao de planilhas.
 *
 * Auto-detect de mapping, field aliases e validacao ficam em
 * `import-wizard.ts` (generico) + `import-configs/<modulo>.ts` (especifico).
 * Este arquivo mantem apenas helpers crus: parse de xlsx/csv, fuzzy match
 * de nomes de turma e download de template.
 */
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Spreadsheet parser
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
// Fuzzy class name resolver
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

  const exact = classes.find((c) => normalize(c.name) === target);
  if (exact) return exact.id;

  const partial = classes.find(
    (c) => normalize(c.name).includes(target) || target.includes(normalize(c.name)),
  );
  if (partial) return partial.id;

  return null;
}

// ---------------------------------------------------------------------------
// Template download
// ---------------------------------------------------------------------------

export function downloadImportTemplate(
  fields: { column: string; field: string }[],
  fileName: string = 'modelo_importacao.xlsx',
): void {
  const headers = fields.map((f) => f.column);
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Importação');

  XLSX.writeFile(wb, fileName);
}

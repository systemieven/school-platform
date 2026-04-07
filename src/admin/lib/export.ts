import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
}

// ── CSV ───────────────────────────────────────────────────────────────────────
export function exportCSV(rows: Record<string, unknown>[], columns: ExportColumn[], filename: string) {
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows.map((row) =>
    columns.map((c) => {
      const val = row[c.key] ?? '';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(','),
  );
  const csv = [header, ...body].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

// ── XLSX ──────────────────────────────────────────────────────────────────────
export function exportXLSX(rows: Record<string, unknown>[], columns: ExportColumn[], filename: string) {
  const data = [
    columns.map((c) => c.label),
    ...rows.map((row) => columns.map((c) => row[c.key] ?? '')),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = columns.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── PDF (via window.print) ────────────────────────────────────────────────────
export function exportPDF(rows: Record<string, unknown>[], columns: ExportColumn[], filename: string, title: string) {
  const header = columns.map((c) => `<th>${escHtml(c.label)}</th>`).join('');
  const body = rows.map((row) =>
    `<tr>${columns.map((c) => `<td>${escHtml(String(row[c.key] ?? ''))}</td>`).join('')}</tr>`,
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${escHtml(title)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  h1 { font-size: 15px; color: #003876; margin-bottom: 4px; }
  p.meta { font-size: 10px; color: #888; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #003876; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
  tr:nth-child(even) td { background: #f5f7ff; }
  @media print { @page { margin: 15mm; } }
</style></head><body>
<h1>${escHtml(title)}</h1>
<p class="meta">Gerado em ${new Date().toLocaleString('pt-BR')} — ${rows.length} registro(s)</p>
<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.title = filename;
    win.document.close();
  }
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Util ──────────────────────────────────────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

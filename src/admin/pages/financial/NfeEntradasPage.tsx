import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePermissions } from '../../contexts/PermissionsContext';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  Inbox, Upload, Loader2, Check, X, Building2,
  FileText, AlertCircle, Package, ChevronDown, ChevronRight,
  Search, Trash2, Link2, Link2Off, AlertTriangle, Undo2, CalendarDays,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NfeEntry {
  id: string;
  xml_file_name: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  chave_acesso: string | null;
  data_emissao: string | null;
  valor_total: number | null;
  status: 'imported' | 'processed' | 'error';
  fornecedor_id: string | null;
  created_at: string;
  fornecedor?: { razao_social: string; nome_fantasia: string | null } | null;
}

interface ParsedItem {
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  ean: string | null;
  unidade: string | null;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  origem: number | null;
  cstIcms: string | null;
  csosn: string | null;
  aliqIcms: number | null;
  cstPis: string | null;
  aliqPis: number | null;
  cstCofins: string | null;
  aliqCofins: number | null;
  cstIpi: string | null;
  aliqIpi: number | null;
}

interface ParsedNfe {
  chaveAcesso: string;
  emitenteCnpj: string;
  emitenteNome: string;
  dataEmissao: string;
  valorTotal: number;
  xmlFileName: string;
  rawXml: string;
  items: ParsedItem[];
}

interface FornecedorLite {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj_cpf: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCnpj(v: string): string {
  const d = v.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return v;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function fmtBRL(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function truncateChave(chave: string | null): string {
  if (!chave) return '—';
  if (chave.length <= 20) return chave;
  return chave.slice(0, 10) + '…' + chave.slice(-10);
}

// ── XML Parser ────────────────────────────────────────────────────────────────

function getText(el: Element | Document | null, selector: string): string {
  if (!el) return '';
  return el.querySelector(selector)?.textContent?.trim() ?? '';
}

function parseNfeXml(xmlStr: string, fileName: string): ParsedNfe | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'application/xml');
    if (doc.querySelector('parsererror')) return null;

    // Chave de acesso: protNFe > chNFe ou atributo Id do infNFe
    let chaveAcesso = getText(doc, 'chNFe');
    if (!chaveAcesso) {
      const id = doc.querySelector('infNFe')?.getAttribute('Id') ?? '';
      chaveAcesso = id.replace(/^NFe/, '');
    }

    const emitenteCnpj = getText(doc, 'emit CNPJ') || getText(doc, 'emit CPF');
    const emitenteNome = getText(doc, 'emit xNome') || getText(doc, 'emit xFant');
    const dhEmi = getText(doc, 'dhEmi') || getText(doc, 'dEmi');
    const vNF = getText(doc, 'ICMSTot vNF') || getText(doc, 'vNF');

    if (!emitenteCnpj || !chaveAcesso) return null;

    const dataEmissao = dhEmi ? new Date(dhEmi).toISOString() : new Date().toISOString();
    const valorTotal = parseFloat(vNF) || 0;

    // Items
    const items: ParsedItem[] = Array.from(doc.querySelectorAll('det')).map((det) => {
      const prod = det.querySelector('prod');
      const imp = det.querySelector('imposto');

      const descricao = getText(prod, 'xProd') || getText(det, 'xProd');
      const quantidade = parseFloat(getText(prod, 'qCom') || getText(det, 'qCom') || '0');
      const valorUnitario = parseFloat(getText(prod, 'vUnCom') || getText(det, 'vUnCom') || '0');
      const valorTotalItem = parseFloat(getText(prod, 'vProd') || getText(det, 'vProd') || '0');

      // ICMS
      let origem: number | null = null;
      let cstIcms: string | null = null;
      let csosn: string | null = null;
      let aliqIcms: number | null = null;

      const icmsEl = imp?.querySelector('ICMS');
      const icmsChild = icmsEl?.firstElementChild ?? null;
      if (icmsChild) {
        const o = parseInt(getText(icmsChild, 'orig') || '-1', 10);
        origem = o >= 0 ? o : null;
        cstIcms = getText(icmsChild, 'CST') || null;
        csosn = getText(icmsChild, 'CSOSN') || null;
        const p = parseFloat(getText(icmsChild, 'pICMS') || '0');
        aliqIcms = p > 0 ? p : null;
      }

      // PIS
      const pisChild = imp?.querySelector('PIS')?.firstElementChild ?? null;
      const cstPis = pisChild ? (getText(pisChild, 'CST') || null) : null;
      const aliqPisRaw = pisChild ? parseFloat(getText(pisChild, 'pPIS') || '0') : 0;
      const aliqPis = aliqPisRaw > 0 ? aliqPisRaw : null;

      // COFINS
      const cofinsChild = imp?.querySelector('COFINS')?.firstElementChild ?? null;
      const cstCofins = cofinsChild ? (getText(cofinsChild, 'CST') || null) : null;
      const aliqCofinsRaw = cofinsChild ? parseFloat(getText(cofinsChild, 'pCOFINS') || '0') : 0;
      const aliqCofins = aliqCofinsRaw > 0 ? aliqCofinsRaw : null;

      // IPI
      const ipiTrib = imp?.querySelector('IPITrib') ?? imp?.querySelector('IPI')?.firstElementChild ?? null;
      const cstIpi = ipiTrib ? (getText(ipiTrib, 'CST') || null) : null;
      const aliqIpiRaw = ipiTrib ? parseFloat(getText(ipiTrib, 'pIPI') || '0') : 0;
      const aliqIpi = aliqIpiRaw > 0 ? aliqIpiRaw : null;

      return {
        descricao,
        ncm: getText(prod, 'NCM') || getText(det, 'NCM') || null,
        cfop: getText(prod, 'CFOP') || getText(det, 'CFOP') || null,
        ean: getText(prod, 'cEAN') || null,
        unidade: getText(prod, 'uCom') || getText(prod, 'uTrib') || null,
        quantidade, valorUnitario, valorTotal: valorTotalItem,
        origem, cstIcms, csosn, aliqIcms,
        cstPis, aliqPis, cstCofins, aliqCofins, cstIpi, aliqIpi,
      };
    });

    return { chaveAcesso, emitenteCnpj, emitenteNome, dataEmissao, valorTotal, xmlFileName: fileName, rawXml: xmlStr, items };
  } catch {
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NfeEntradasPage() {
  const { profile } = useAdminAuth();
  usePermissions();

  // List state
  const [entries, setEntries] = useState<NfeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Date filters
  type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Drawer / import state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedNfe | null>(null);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Devolução drawer state
  const [devoEntry, setDevoEntry] = useState<NfeEntry | null>(null);
  const [devoMotivo, setDevoMotivo] = useState('');
  const [devoEmitting, setDevoEmitting] = useState(false);
  const [devoError, setDevoError] = useState<string | null>(null);
  const [devoSaved, setDevoSaved] = useState(false);
  const devoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fornecedor state
  const [fornecedor, setFornecedor] = useState<FornecedorLite | null>(null);
  const [fornLookupDone, setFornLookupDone] = useState(false);
  const [fornSearch, setFornSearch] = useState('');
  const [fornResults, setFornResults] = useState<FornecedorLite[]>([]);
  const [fornDropOpen, setFornDropOpen] = useState(false);
  const fornTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // File input ref
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  // ── Date range ────────────────────────────────────────────────────────────
  // Deriva intervalo `data_emissao` em ISO pra aplicar no query.
  // Semana = calendário atual (seg–dom). Mês = calendário atual (dia 1 até fim).
  function getDateRange(filter: DateFilter): { from: string | null; to: string | null } {
    const now = new Date();
    if (filter === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    if (filter === 'week') {
      const dow = now.getDay(); // 0=dom .. 6=sáb
      const diff = dow === 0 ? 6 : dow - 1;
      const start = new Date(now); start.setDate(now.getDate() - diff); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    if (filter === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    if (filter === 'custom') {
      return {
        from: fromDate ? new Date(fromDate + 'T00:00:00').toISOString() : null,
        to:   toDate   ? new Date(toDate   + 'T23:59:59').toISOString() : null,
      };
    }
    return { from: null, to: null };
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange(dateFilter);
    let q = supabase
      .from('nfe_entries')
      .select('*, fornecedor:fornecedor_id(razao_social, nome_fantasia)')
      .order('data_emissao', { ascending: false, nullsFirst: false })
      .limit(200);
    if (from) q = q.gte('data_emissao', from);
    if (to)   q = q.lte('data_emissao', to);
    const { data } = await q;
    setEntries((data ?? []) as unknown as NfeEntry[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  // Escolher um preset limpa datas custom; digitar datas muda para custom.
  function pickPreset(f: Exclude<DateFilter, 'custom'>) {
    setDateFilter(f);
    setFromDate('');
    setToDate('');
  }
  function onFromChange(v: string) { setFromDate(v); setDateFilter('custom'); }
  function onToChange(v: string)   { setToDate(v);   setDateFilter('custom'); }
  function clearDates() { setDateFilter('all'); setFromDate(''); setToDate(''); }

  // ── Fornecedor lookup ─────────────────────────────────────────────────────

  async function lookupFornecedorByCnpj(cnpj: string) {
    const { data } = await supabase
      .from('fornecedores')
      .select('id, razao_social, nome_fantasia, cnpj_cpf')
      .eq('cnpj_cpf', cnpj)
      .maybeSingle();
    if (data) setFornecedor(data as FornecedorLite);
    setFornLookupDone(true);
  }

  function onFornSearchChange(val: string) {
    setFornSearch(val);
    setFornDropOpen(true);
    if (fornTimer.current) clearTimeout(fornTimer.current);
    if (!val.trim()) { setFornResults([]); return; }
    fornTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('fornecedores')
        .select('id, razao_social, nome_fantasia, cnpj_cpf')
        .or(`razao_social.ilike.%${val.trim()}%,cnpj_cpf.ilike.%${val.trim()}%`)
        .limit(8);
      setFornResults((data ?? []) as FornecedorLite[]);
    }, 350);
  }

  function selectFornecedor(f: FornecedorLite) {
    setFornecedor(f);
    setFornSearch('');
    setFornResults([]);
    setFornDropOpen(false);
  }

  // ── File handling ─────────────────────────────────────────────────────────

  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      setParseError('Selecione um arquivo XML de NF-e.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const xmlStr = e.target?.result as string;
      const result = parseNfeXml(xmlStr, file.name);
      if (!result) {
        setParseError('Não foi possível interpretar o XML. Verifique se é uma NF-e válida.');
        return;
      }
      setParseError(null);
      setParsed(result);
      setFornecedor(null);
      setFornLookupDone(false);
      // Auto-lookup
      lookupFornecedorByCnpj(result.emitenteCnpj);
    };
    reader.readAsText(file, 'UTF-8');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!parsed || saving) return;
    setSaving(true);

    // Insert nfe_entry
    const { data: entryData, error: entryErr } = await supabase
      .from('nfe_entries')
      .insert({
        xml_file_name: parsed.xmlFileName,
        emitente_cnpj: parsed.emitenteCnpj,
        emitente_nome: parsed.emitenteNome,
        chave_acesso: parsed.chaveAcesso,
        data_emissao: parsed.dataEmissao,
        valor_total: parsed.valorTotal,
        fornecedor_id: fornecedor?.id ?? null,
        raw_xml: parsed.rawXml,
        status: 'imported',
      })
      .select('id')
      .single();

    if (entryErr || !entryData) {
      setSaving(false);
      // Chave duplicada
      if (entryErr?.code === '23505') {
        setParseError('Esta NF-e já foi importada (chave de acesso duplicada).');
      } else {
        setParseError('Erro ao salvar: ' + (entryErr?.message ?? 'desconhecido'));
      }
      return;
    }

    const nfeEntryId = (entryData as { id: string }).id;

    // Insert items
    if (parsed.items.length > 0) {
      const itemRows = parsed.items.map((item) => ({
        nfe_entry_id: nfeEntryId,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.valorTotal,
        ncm: item.ncm,
        cfop: item.cfop,
        ean: item.ean,
        unidade_trib: item.unidade,
        origem: item.origem,
        cst_icms: item.cstIcms,
        csosn: item.csosn,
        aliq_icms: item.aliqIcms,
        cst_pis: item.cstPis,
        aliq_pis: item.aliqPis,
        cst_cofins: item.cstCofins,
        aliq_cofins: item.aliqCofins,
        cst_ipi: item.cstIpi,
        aliq_ipi: item.aliqIpi,
      }));
      await supabase.from('nfe_entry_items').insert(itemRows);
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const { error: apError } = await supabase
      .from('financial_payables')
      .insert({
        creditor_name: fornecedor?.nome_fantasia ?? fornecedor?.razao_social ?? parsed.emitenteNome,
        creditor_type: 'supplier',
        category_type: 'variable',
        description: `NF-e ${parsed.chaveAcesso?.slice(-9) ?? ''} — ${parsed.emitenteNome}`,
        amount: parsed.valorTotal,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending',
        fornecedor_id: fornecedor?.id ?? null,
        nfe_entry_id: nfeEntryId,
        created_by: profile?.id ?? null,
      });

    if (!apError) {
      await supabase
        .from('nfe_entries')
        .update({ status: 'processed' })
        .eq('id', nfeEntryId);
    }

    logAudit({
      action: 'create',
      module: 'store-fiscal',
      recordId: nfeEntryId,
      description: `NF-e importada: ${parsed.emitenteNome} — chave ${parsed.chaveAcesso.slice(0, 20)}…`,
    });

    setSaving(false);
    setSaved(true);

    if (apError) {
      setParseError(
        'NF-e importada. Não foi possível criar a conta a pagar automaticamente — crie manualmente em Contas a Pagar.'
      );
    }

    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => {
      setSaved(false);
      closeDrawer();
      load();
    }, apError ? 4000 : 1200);
  }

  // ── Drawer helpers ────────────────────────────────────────────────────────

  function openDrawer() {
    setParsed(null);
    setParseError(null);
    setFornecedor(null);
    setFornLookupDone(false);
    setFornSearch('');
    setFornResults([]);
    setItemsExpanded(false);
    setSaved(false);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSaved(false);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function openDevoDrawer(entry: NfeEntry) {
    setDevoEntry(entry);
    setDevoMotivo('');
    setDevoError(null);
    setDevoSaved(false);
  }

  function closeDevoDrawer() {
    setDevoEntry(null);
    setDevoSaved(false);
  }

  async function handleEmitDevolucao() {
    if (!devoEntry || devoEmitting) return;
    const motivo = devoMotivo.trim();
    if (motivo.length < 15 || motivo.length > 255) {
      setDevoError('Motivo deve ter entre 15 e 255 caracteres.');
      return;
    }
    setDevoEmitting(true);
    setDevoError(null);
    const { data, error } = await supabase.functions.invoke('nfe-emitter', {
      body: {
        nfe_entry_id: devoEntry.id,
        motivo_devolucao: motivo,
        initiated_by: profile?.id ?? null,
      },
    });
    setDevoEmitting(false);
    if (error || (data as { error?: string } | null)?.error) {
      const msg = (data as { error?: string } | null)?.error ?? error?.message ?? 'Falha ao emitir NF-e';
      setDevoError(msg);
      return;
    }
    setDevoSaved(true);
    logAudit({
      action: 'create',
      module: 'store-fiscal',
      recordId: devoEntry.id,
      description: `NF-e de devolução emitida — origem ${devoEntry.emitente_nome ?? '—'}`,
    });
    if (devoTimer.current) clearTimeout(devoTimer.current);
    devoTimer.current = setTimeout(() => {
      closeDevoDrawer();
      load();
    }, 1200);
  }

  async function handleDelete(id: string) {
    await supabase.from('nfe_entries').delete().eq('id', id);
    logAudit({ action: 'delete', module: 'store-fiscal', recordId: id, description: 'NF-e de entrada excluída' });
    setDeleteId(null);
    load();
  }

  // ── Fornecedor display name ───────────────────────────────────────────────

  function fornNome(f: FornecedorLite | null | undefined): string {
    if (!f) return '—';
    return f.nome_fantasia || f.razao_social;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalValor = entries.reduce((s, e) => s + (e.valor_total ?? 0), 0);
  const semFornecedor = entries.filter((e) => !e.fornecedor_id).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap text-sm text-gray-500 dark:text-gray-400">
          <span>{entries.length} NF-e{entries.length !== 1 ? 's' : ''} importada{entries.length !== 1 ? 's' : ''}</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span>Total: {fmtBRL(totalValor)}</span>
          {semFornecedor > 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {semFornecedor} sem fornecedor
              </span>
            </>
          )}
        </div>
        <button
          onClick={openDrawer}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-semibold hover:bg-brand-primary-dark transition-colors shadow-lg shadow-brand-primary/20"
        >
          <Upload className="w-4 h-4" />
          Importar XML
        </button>
      </div>

      {/* Date filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ['all',   'Todas'],
          ['today', 'Hoje'],
          ['week',  'Esta semana'],
          ['month', 'Este mês'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => pickPreset(key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              dateFilter === key
                ? 'bg-brand-primary text-white shadow shadow-brand-primary/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}

        <div className="flex items-center gap-2 ml-auto">
          <CalendarDays className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromChange(e.target.value)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 focus:border-brand-primary outline-none ${
              dateFilter === 'custom' ? 'border-brand-primary/40' : 'border-gray-200 dark:border-gray-700'
            }`}
            title="Data inicial"
          />
          <span className="text-xs text-gray-400">até</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToChange(e.target.value)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 focus:border-brand-primary outline-none ${
              dateFilter === 'custom' ? 'border-brand-primary/40' : 'border-gray-200 dark:border-gray-700'
            }`}
            title="Data final"
          />
          {(dateFilter !== 'all' || fromDate || toDate) && (
            <button
              onClick={clearDates}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Limpar filtro"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Loading / Empty state */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16">
          <Inbox className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          {dateFilter !== 'all' || fromDate || toDate ? (
            <>
              <p className="text-gray-500 dark:text-gray-400">Nenhuma NF-e no período selecionado</p>
              <button
                onClick={clearDates}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
                Limpar filtro
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 dark:text-gray-400">Nenhuma NF-e importada</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Importe arquivos XML de NF-e de entrada para vincular ao estoque e fornecedores
              </p>
              <button
                onClick={openDrawer}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-brand-primary-dark transition-colors"
              >
                <Upload className="w-4 h-4" />
                Importar primeiro XML
              </button>
            </>
          )}
        </div>
      ) : (
        /* Table */
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
          {/* Header row */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_1fr_120px_120px_140px_90px] gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 text-[10px] font-semibold tracking-widest uppercase text-gray-400">
            <span>Emitente</span>
            <span>Chave de Acesso</span>
            <span>Emissão</span>
            <span>Valor Total</span>
            <span>Fornecedor</span>
            <span className="text-right">Ações</span>
          </div>

          {entries.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_120px_120px_140px_90px] gap-2 px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 items-center"
            >
              {/* Emitente */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                  {entry.emitente_nome ?? '—'}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {entry.emitente_cnpj ? fmtCnpj(entry.emitente_cnpj) : '—'}
                </p>
              </div>

              {/* Chave */}
              <p
                className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate"
                title={entry.chave_acesso ?? undefined}
              >
                {truncateChave(entry.chave_acesso)}
              </p>

              {/* Data */}
              <p className="text-xs text-gray-600 dark:text-gray-300">{fmtDate(entry.data_emissao)}</p>

              {/* Valor */}
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{fmtBRL(entry.valor_total)}</p>

              {/* Fornecedor */}
              {entry.fornecedor ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 w-fit max-w-full">
                  <Link2 className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{fornNome(entry.fornecedor as FornecedorLite)}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 w-fit">
                  <Link2Off className="w-3 h-3 flex-shrink-0" />
                  Sem fornecedor
                </span>
              )}

              {/* Ações */}
              <div className="flex justify-end gap-1">
                {deleteId === entry.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(entry.id)} className="px-2 py-1 text-[10px] bg-red-500 text-white rounded-lg">Confirmar</button>
                    <button onClick={() => setDeleteId(null)} className="p-1 text-gray-400"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => openDevoDrawer(entry)}
                      className="p-1.5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
                      title="Emitir NF-e de devolução"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(entry.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Import Drawer ──────────────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title="Importar NF-e de Entrada"
        icon={Inbox}
        width="w-[640px]"
        footer={
          parsed ? (
            <div className="flex gap-3">
              <button
                onClick={closeDrawer}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
                }`}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Salvando…</>
                ) : saved ? (
                  <><Check className="w-4 h-4" />Importado!</>
                ) : (
                  <><Inbox className="w-4 h-4" />Importar NF-e</>
                )}
              </button>
            </div>
          ) : null
        }
      >
        {/* ── Stage: Drop zone (nenhum XML ainda) ─────────────────────── */}
        {!parsed && (
          <DrawerCard title="Arquivo XML" icon={FileText}>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-12
                ${dragging
                  ? 'border-brand-primary bg-brand-primary/5 dark:bg-brand-primary/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-brand-primary/40 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }
              `}
            >
              <Upload className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Arraste um arquivo XML aqui ou clique para selecionar
                </p>
                <p className="text-xs text-gray-400 mt-1">NF-e v3.10 ou v4.00 (nfeProc ou NFe)</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {parseError && (
              <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {parseError}
              </p>
            )}
          </DrawerCard>
        )}

        {/* ── Stage: Preview ────────────────────────────────────────── */}
        {parsed && (
          <>
            {/* NF-e summary */}
            <DrawerCard title="Resumo da NF-e" icon={FileText}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Emitente</p>
                  <p className="font-medium text-gray-800 dark:text-white">{parsed.emitenteNome}</p>
                  <p className="text-[11px] text-gray-400">{fmtCnpj(parsed.emitenteCnpj)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Emissão</p>
                  <p className="font-medium text-gray-800 dark:text-white">{fmtDate(parsed.dataEmissao)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Valor Total</p>
                  <p className="font-semibold text-lg text-gray-900 dark:text-white">{fmtBRL(parsed.valorTotal)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Itens</p>
                  <p className="font-medium text-gray-800 dark:text-white">{parsed.items.length} produto{parsed.items.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Chave de Acesso</p>
                  <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 break-all">{parsed.chaveAcesso}</p>
                </div>
              </div>

              {/* Trocar arquivo */}
              <button
                onClick={() => { setParsed(null); setParseError(null); setFornecedor(null); setFornLookupDone(false); }}
                className="text-xs text-gray-400 hover:text-brand-primary transition-colors"
              >
                Trocar arquivo
              </button>

              {parseError && (
                <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {parseError}
                </p>
              )}
            </DrawerCard>

            {/* Fornecedor */}
            <DrawerCard title="Fornecedor" icon={Building2}>
              {/* Auto-match result */}
              {!fornLookupDone ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Buscando fornecedor pelo CNPJ…
                </div>
              ) : fornecedor && !fornSearch ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        {fornNome(fornecedor)}
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Vinculado automaticamente pelo CNPJ
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFornecedor(null)}
                    className="p-1 text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200 rounded"
                    title="Remover vínculo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Not found notice */}
                  {!fornecedor && (
                    <p className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Fornecedor com CNPJ {fmtCnpj(parsed.emitenteCnpj)} não encontrado.
                      Busque abaixo ou prossiga sem vincular.
                    </p>
                  )}

                  {/* Manual search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fornSearch}
                      onChange={(e) => onFornSearchChange(e.target.value)}
                      onFocus={() => setFornDropOpen(true)}
                      placeholder="Buscar fornecedor por nome ou CNPJ..."
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none"
                    />
                    {fornDropOpen && fornResults.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setFornDropOpen(false)} />
                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-48 overflow-y-auto">
                          {fornResults.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => selectFornecedor(f)}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <p className="font-medium text-gray-800 dark:text-white">{f.razao_social}</p>
                              {f.cnpj_cpf && (
                                <p className="text-[11px] text-gray-400">{fmtCnpj(f.cnpj_cpf)}</p>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Você pode prosseguir sem vincular a um fornecedor e fazer isso depois.
                  </p>
                </div>
              )}
            </DrawerCard>

            {/* Items accordion */}
            <DrawerCard
              title={`Itens da NF-e (${parsed.items.length})`}
              icon={Package}
            >
              <button
                type="button"
                onClick={() => setItemsExpanded((v) => !v)}
                className="w-full flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 hover:text-brand-primary transition-colors"
              >
                <span>{itemsExpanded ? 'Ocultar itens' : 'Visualizar itens'}</span>
                {itemsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {itemsExpanded && (
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {parsed.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 dark:text-white truncate">{item.descricao}</p>
                          <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-gray-400">
                            {item.ncm && <span>NCM: {item.ncm}</span>}
                            {item.cfop && <span>CFOP: {item.cfop}</span>}
                            {item.cstIcms && <span>CST ICMS: {item.cstIcms}</span>}
                            {item.csosn && <span>CSOSN: {item.csosn}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{fmtBRL(item.valorTotal)}</p>
                          <p className="text-[10px] text-gray-400">
                            {item.quantidade.toLocaleString('pt-BR')} {item.unidade ?? 'UN'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DrawerCard>
          </>
        )}
      </Drawer>

      {/* ── Devolução Drawer ───────────────────────────────────────────────── */}
      <Drawer
        open={!!devoEntry}
        onClose={closeDevoDrawer}
        title="Emitir NF-e de Devolução"
        icon={Undo2}
        width="w-[560px]"
        footer={
          <div className="flex gap-3">
            <button
              onClick={closeDevoDrawer}
              disabled={devoEmitting}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleEmitDevolucao}
              disabled={devoEmitting || devoSaved}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                devoSaved ? 'bg-emerald-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primary-dark disabled:opacity-50'
              }`}
            >
              {devoEmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Emitindo…</>
              ) : devoSaved ? (
                <><Check className="w-4 h-4" />Emitida!</>
              ) : (
                <><Undo2 className="w-4 h-4" />Emitir devolução</>
              )}
            </button>
          </div>
        }
      >
        {devoEntry && (
          <>
            <DrawerCard title="NF-e de origem" icon={FileText}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Emitente</p>
                  <p className="font-medium text-gray-800 dark:text-white">{devoEntry.emitente_nome ?? '—'}</p>
                  <p className="text-[11px] text-gray-400">
                    {devoEntry.emitente_cnpj ? fmtCnpj(devoEntry.emitente_cnpj) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Emissão</p>
                  <p className="font-medium text-gray-800 dark:text-white">{fmtDate(devoEntry.data_emissao)}</p>
                  <p className="text-[11px] text-gray-400">{fmtBRL(devoEntry.valor_total)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Chave de Acesso</p>
                  <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400 break-all">{devoEntry.chave_acesso ?? '—'}</p>
                </div>
              </div>
              {!devoEntry.fornecedor_id && (
                <p className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  NF-e sem fornecedor vinculado. Vincule antes de emitir a devolução.
                </p>
              )}
            </DrawerCard>

            <DrawerCard title="Motivo da devolução" icon={AlertCircle}>
              <textarea
                value={devoMotivo}
                onChange={(e) => setDevoMotivo(e.target.value)}
                placeholder="Descreva o motivo da devolução (15 a 255 caracteres)…"
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-brand-primary outline-none resize-none"
              />
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>Exigência SEFAZ: 15–255 caracteres</span>
                <span className={devoMotivo.length > 255 ? 'text-red-500' : ''}>
                  {devoMotivo.length}/255
                </span>
              </div>
              {devoError && (
                <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {devoError}
                </p>
              )}
              <p className="text-[11px] text-gray-400">
                A emissão usa todos os itens da NF-e de origem e gera uma NF-e modelo 55 com CFOP 5.202/6.202
                referenciando a chave original.
              </p>
            </DrawerCard>
          </>
        )}
      </Drawer>
    </div>
  );
}

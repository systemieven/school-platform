/**
 * NfeAvulsaDrawer
 *
 * Drawer de emissão de NF-e avulsa (saída, finNFe=1 — venda/doação/remessa).
 *
 * - Destinatário: PF/PJ com auto-lookup via edge `cnpj-lookup` e endereço via
 *   `useCepLookup`.
 * - Itens: selecionados do catálogo `store_products` filtrado pela view
 *   `v_product_stock_nfe` (só aparece o que tem saldo disponível).
 * - Envio: `supabase.functions.invoke('nfe-emitter', { action: 'avulsa', ... })`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCepLookup } from '../../../hooks/useCepLookup';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import { SelectDropdown } from '../../../components/FormField';
import {
  FileSignature, User, Package, ClipboardList, MapPin, Loader2, Check,
  Search, Trash2, Plus, AlertTriangle, X, Send, FileText,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StockRow {
  store_product_id: string;
  name: string;
  sku_base: string | null;
  sale_price: number | null;
  qty_available: number;
}

interface ItemLine {
  store_product_id: string;
  nome: string;
  saldo: number;
  quantidade: string;
  valor_unitario: string;
}

interface Form {
  tipo_operacao: 'saida_venda' | 'saida_doacao' | 'saida_remessa';
  natureza_operacao: string;
  destinatario: {
    tipo_pessoa: 'juridica' | 'fisica';
    cnpj_cpf: string;
    razao_social: string;
    email: string;
    ie: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
    codigo_municipio_ibge: string;
  };
  itens: ItemLine[];
  informacoes_adicionais: string;
}

const TIPO_OPCOES = [
  { value: 'saida_venda',   label: 'Venda de mercadoria' },
  { value: 'saida_doacao',  label: 'Doação' },
  { value: 'saida_remessa', label: 'Remessa' },
];

const NATUREZA_DEFAULT: Record<string, string> = {
  saida_venda:   'VENDA DE MERCADORIA',
  saida_doacao:  'DOACAO',
  saida_remessa: 'REMESSA',
};

const emptyForm = (): Form => ({
  tipo_operacao: 'saida_venda',
  natureza_operacao: NATUREZA_DEFAULT.saida_venda,
  destinatario: {
    tipo_pessoa: 'juridica',
    cnpj_cpf: '',
    razao_social: '',
    email: '',
    ie: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
    codigo_municipio_ibge: '',
  },
  itens: [],
  informacoes_adicionais: '',
});

function formatDoc(raw: string, tipo: string): string {
  const d = raw.replace(/\D/g, '');
  if (tipo === 'juridica') {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onEmitted?: () => void;
}

export default function NfeAvulsaDrawer({ open, onClose, onEmitted }: Props) {
  const { user } = useAdminAuth();
  const { lookup: cepLookup } = useCepLookup();

  const [form, setForm] = useState<Form>(emptyForm());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  // CNPJ lookup
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);
  const [cnpjLookupDone, setCnpjLookupDone] = useState(false);
  const [lastLookupCnpj, setLastLookupCnpj] = useState('');

  // Product picker
  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setSaveState('idle');
      setError(null);
      setCnpjLookupError(null);
      setCnpjLookupDone(false);
      setLastLookupCnpj('');
      setPickerOpen(false);
      setPickerSearch('');
    }
  }, [open]);

  // Carrega saldo dos produtos quando abre
  const loadStock = useCallback(async () => {
    setStockLoading(true);
    const { data } = await supabase
      .from('v_product_stock_nfe')
      .select('store_product_id, name, sku_base, sale_price, qty_available')
      .gt('qty_available', 0)
      .order('name');
    setStock((data ?? []) as StockRow[]);
    setStockLoading(false);
  }, []);

  useEffect(() => { if (open) loadStock(); }, [open, loadStock]);

  // ── CNPJ lookup ─────────────────────────────────────────────────────────────
  const handleCnpjLookup = useCallback(async (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 14) return;
    setLastLookupCnpj(digits);
    setCnpjLookupError(null);
    setCnpjLookupDone(false);
    setCnpjLookupLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('cnpj-lookup', {
        body: { cnpj: digits },
      });
      if (fnErr) {
        setCnpjLookupError(fnErr.message || 'Falha ao consultar CNPJ.');
        return;
      }
      if (!data?.ok) {
        setCnpjLookupError(data?.error ?? 'CNPJ não encontrado.');
        return;
      }
      const d = data.data as {
        razao_social?: string;
        nome_fantasia?: string;
        email?: string;
        endereco?: {
          logradouro?: string; numero?: string; complemento?: string; bairro?: string;
          cep?: string; uf?: string;
          municipio?: { codigo_ibge?: string | number; descricao?: string };
        };
      };
      setForm((f) => ({
        ...f,
        destinatario: {
          ...f.destinatario,
          razao_social: f.destinatario.razao_social || (d.razao_social ?? ''),
          cep: f.destinatario.cep || (d.endereco?.cep ?? ''),
          logradouro: f.destinatario.logradouro || (d.endereco?.logradouro ?? ''),
          numero: f.destinatario.numero || (d.endereco?.numero ?? ''),
          complemento: f.destinatario.complemento || (d.endereco?.complemento ?? ''),
          bairro: f.destinatario.bairro || (d.endereco?.bairro ?? ''),
          municipio: f.destinatario.municipio || (d.endereco?.municipio?.descricao ?? ''),
          uf: f.destinatario.uf || (d.endereco?.uf ?? ''),
          codigo_municipio_ibge:
            f.destinatario.codigo_municipio_ibge ||
            String(d.endereco?.municipio?.codigo_ibge ?? ''),
          email: f.destinatario.email || (d.email ?? ''),
        },
      }));
      setCnpjLookupDone(true);
    } catch (e) {
      setCnpjLookupError(e instanceof Error ? e.message : 'Falha ao consultar CNPJ.');
    } finally {
      setCnpjLookupLoading(false);
    }
  }, []);

  // ── CEP lookup ──────────────────────────────────────────────────────────────
  const handleCepBlur = async () => {
    const addr = await cepLookup(form.destinatario.cep);
    if (addr) {
      setForm((f) => ({
        ...f,
        destinatario: {
          ...f.destinatario,
          logradouro: addr.logradouro || f.destinatario.logradouro,
          bairro: addr.bairro || f.destinatario.bairro,
          municipio: addr.municipio || f.destinatario.municipio,
          uf: addr.uf || f.destinatario.uf,
          codigo_municipio_ibge: addr.codigo_municipio_ibge || f.destinatario.codigo_municipio_ibge,
        },
      }));
    }
  };

  // ── Itens ───────────────────────────────────────────────────────────────────
  const addItem = (p: StockRow) => {
    // evita duplicar
    if (form.itens.some((i) => i.store_product_id === p.store_product_id)) {
      setPickerOpen(false);
      return;
    }
    setForm((f) => ({
      ...f,
      itens: [
        ...f.itens,
        {
          store_product_id: p.store_product_id,
          nome: p.name,
          saldo: Number(p.qty_available),
          quantidade: '1',
          valor_unitario: (p.sale_price ?? 0).toFixed(2),
        },
      ],
    }));
    setPickerOpen(false);
    setPickerSearch('');
  };

  const removeItem = (idx: number) => {
    setForm((f) => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, patch: Partial<ItemLine>) => {
    setForm((f) => ({
      ...f,
      itens: f.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const filteredStock = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return stock;
    return stock.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.sku_base ?? '').toLowerCase().includes(q),
    );
  }, [stock, pickerSearch]);

  const valorTotal = useMemo(() => {
    return form.itens.reduce((s, i) => {
      const qtd = Number(i.quantidade) || 0;
      const vu = Number(i.valor_unitario) || 0;
      return s + qtd * vu;
    }, 0);
  }, [form.itens]);

  // ── Validação ───────────────────────────────────────────────────────────────
  const validationError = useMemo((): string | null => {
    const d = form.destinatario;
    const docDigits = d.cnpj_cpf.replace(/\D/g, '');
    const expectedLen = d.tipo_pessoa === 'juridica' ? 14 : 11;
    if (docDigits.length !== expectedLen) return 'Informe CNPJ/CPF completo do destinatário.';
    if (!d.razao_social.trim()) return 'Informe a razão social/nome do destinatário.';
    if (!d.logradouro.trim() || !d.numero.trim() || !d.bairro.trim() ||
        !d.municipio.trim() || !d.uf.trim() || !d.cep.trim() || !d.codigo_municipio_ibge.trim()) {
      return 'Complete o endereço do destinatário (logradouro, número, bairro, município, UF, CEP e código IBGE).';
    }
    if (form.itens.length === 0) return 'Adicione ao menos 1 item.';
    for (const it of form.itens) {
      const qtd = Number(it.quantidade) || 0;
      if (qtd <= 0) return `Quantidade inválida para "${it.nome}".`;
      if (qtd > it.saldo) return `Saldo insuficiente para "${it.nome}" (disponível ${it.saldo}).`;
      const vu = Number(it.valor_unitario) || 0;
      if (vu <= 0) return `Valor unitário inválido para "${it.nome}".`;
    }
    return null;
  }, [form]);

  // ── Emitir ──────────────────────────────────────────────────────────────────
  const handleEmit = async () => {
    if (validationError) { setError(validationError); return; }
    setError(null);
    setSaveState('saving');

    const payload = {
      action: 'avulsa',
      tipo_operacao: form.tipo_operacao,
      natureza_operacao: form.natureza_operacao,
      destinatario: {
        tipo_pessoa: form.destinatario.tipo_pessoa,
        cnpj_cpf: form.destinatario.cnpj_cpf.replace(/\D/g, ''),
        razao_social: form.destinatario.razao_social.trim(),
        email: form.destinatario.email.trim() || null,
        ie: form.destinatario.ie.trim() || null,
        endereco: {
          cep: form.destinatario.cep.replace(/\D/g, ''),
          logradouro: form.destinatario.logradouro.trim(),
          numero: form.destinatario.numero.trim(),
          complemento: form.destinatario.complemento.trim() || null,
          bairro: form.destinatario.bairro.trim(),
          municipio: form.destinatario.municipio.trim(),
          uf: form.destinatario.uf.trim().toUpperCase(),
          codigo_municipio_ibge: form.destinatario.codigo_municipio_ibge.trim(),
        },
      },
      itens: form.itens.map((i) => ({
        store_product_id: i.store_product_id,
        quantidade: Number(i.quantidade),
        valor_unitario: Number(i.valor_unitario),
      })),
      informacoes_adicionais: form.informacoes_adicionais.trim() || undefined,
      initiated_by: user?.id ?? null,
    };

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('nfe-emitter', {
        body: payload,
      });
      if (fnErr) {
        let msg = fnErr.message || 'Falha ao emitir NF-e.';
        try {
          const ctx = (fnErr as { context?: Response }).context;
          if (ctx) {
            const body = await ctx.clone().json();
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore */ }
        setError(msg);
        setSaveState('idle');
        return;
      }
      if (data?.status === 'rejeitada' || data?.status === 'denegada') {
        setError(data?.error ?? 'NF-e rejeitada pela SEFAZ.');
        setSaveState('idle');
        // a lista já vai mostrar a rejeição mesmo assim — refresh
        onEmitted?.();
        return;
      }
      setSaveState('saved');
      setTimeout(() => {
        onEmitted?.();
        onClose();
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao emitir NF-e.');
      setSaveState('idle');
    }
  };

  const d = form.destinatario;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nova NF-e de saída"
      icon={FileSignature}
      width="w-[720px]"
      footer={
        <div className="flex gap-2">
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleEmit}
            disabled={saveState === 'saving' || !!validationError}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              saveState === 'saved'
                ? 'bg-emerald-500 text-white'
                : 'bg-brand-primary text-white hover:opacity-90 disabled:opacity-50'
            }`}
          >
            {saveState === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveState === 'saved' && <Check className="w-4 h-4" />}
            {saveState === 'idle' && <Send className="w-4 h-4" />}
            {saveState === 'saving' ? 'Emitindo…' : saveState === 'saved' ? 'Emitida!' : 'Emitir NF-e'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="flex-1 text-sm text-red-700 dark:text-red-400">{error}</p>
            <button onClick={() => setError(null)}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}

        {/* ── Natureza da operação ─────────────────────────────────────────── */}
        <DrawerCard title="Natureza da operação" icon={ClipboardList}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo</label>
              <SelectDropdown
                value={form.tipo_operacao}
                onChange={(e) => {
                  const v = e.target.value as Form['tipo_operacao'];
                  setForm((f) => ({
                    ...f,
                    tipo_operacao: v,
                    natureza_operacao: NATUREZA_DEFAULT[v] ?? f.natureza_operacao,
                  }));
                }}
              >
                {TIPO_OPCOES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </SelectDropdown>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Descrição (natOp)</label>
              <input
                value={form.natureza_operacao}
                onChange={(e) => setForm((f) => ({ ...f, natureza_operacao: e.target.value.slice(0, 60) }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>
        </DrawerCard>

        {/* ── Destinatário ─────────────────────────────────────────────────── */}
        <DrawerCard title="Destinatário" icon={User}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo de Pessoa</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                {[
                  { value: 'juridica', label: 'Jurídica' },
                  { value: 'fisica', label: 'Física' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      destinatario: { ...f.destinatario, tipo_pessoa: opt.value as 'juridica' | 'fisica', cnpj_cpf: '' },
                    }))}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      d.tipo_pessoa === opt.value
                        ? 'bg-brand-primary text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {d.tipo_pessoa === 'juridica' ? 'CNPJ' : 'CPF'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={formatDoc(d.cnpj_cpf, d.tipo_pessoa)}
                  inputMode="numeric"
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    const maxLen = d.tipo_pessoa === 'juridica' ? 14 : 11;
                    const trimmed = v.slice(0, maxLen);
                    setForm((f) => ({ ...f, destinatario: { ...f.destinatario, cnpj_cpf: trimmed } }));
                    if (trimmed !== lastLookupCnpj) {
                      setCnpjLookupDone(false);
                      setCnpjLookupError(null);
                    }
                    if (d.tipo_pessoa === 'juridica' && trimmed.length === 14 && trimmed !== lastLookupCnpj && !cnpjLookupLoading) {
                      handleCnpjLookup(trimmed);
                    }
                  }}
                  placeholder={d.tipo_pessoa === 'juridica' ? '00.000.000/0001-00' : '000.000.000-00'}
                  className="w-full px-3 py-2 pr-8 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
                />
                {cnpjLookupLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-primary" />
                )}
                {!cnpjLookupLoading && cnpjLookupDone && (
                  <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                )}
              </div>
              {cnpjLookupError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{cnpjLookupError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {d.tipo_pessoa === 'juridica' ? 'Razão Social' : 'Nome Completo'} <span className="text-red-500">*</span>
              </label>
              <input
                value={d.razao_social}
                onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, razao_social: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">E-mail</label>
              <input
                type="email"
                value={d.email}
                onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, email: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>

          {d.tipo_pessoa === 'juridica' && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Inscrição Estadual (opcional)</label>
              <input
                value={d.ie}
                onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, ie: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          )}
        </DrawerCard>

        {/* ── Endereço ─────────────────────────────────────────────────────── */}
        <DrawerCard title="Endereço" icon={MapPin}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">CEP <span className="text-red-500">*</span></label>
              <input
                value={d.cep}
                onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, cep: e.target.value.replace(/\D/g, '').slice(0, 8) } }))}
                onBlur={handleCepBlur}
                placeholder="00000000"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Logradouro <span className="text-red-500">*</span></label>
              <input
                value={d.logradouro}
                onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, logradouro: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Número <span className="text-red-500">*</span></label>
              <input
                value={d.numero}
                onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, numero: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Complemento</label>
              <input
                value={d.complemento}
                onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, complemento: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bairro <span className="text-red-500">*</span></label>
              <input
                value={d.bairro}
                onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, bairro: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Município <span className="text-red-500">*</span></label>
              <input
                value={d.municipio}
                onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, municipio: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">UF <span className="text-red-500">*</span></label>
              <input
                value={d.uf}
                onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, uf: e.target.value.toUpperCase().slice(0, 2) } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Código IBGE do Município <span className="text-red-500">*</span></label>
            <input
              value={d.codigo_municipio_ibge}
              onChange={(e) => setForm((f) => ({ ...f, destinatario: { ...f.destinatario, codigo_municipio_ibge: e.target.value.replace(/\D/g, '').slice(0, 7) } }))}
              placeholder="0000000"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
            />
          </div>
        </DrawerCard>

        {/* ── Itens ────────────────────────────────────────────────────────── */}
        <DrawerCard title="Itens" icon={Package}>
          {form.itens.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Selecione produtos do catálogo. Apenas produtos com saldo de estoque (entrada registrada) aparecem aqui.
            </p>
          )}

          {form.itens.map((it, idx) => {
            const qtd = Number(it.quantidade) || 0;
            const vu = Number(it.valor_unitario) || 0;
            const over = qtd > it.saldo;
            return (
              <div key={it.store_product_id} className="p-3 mb-2 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{it.nome}</p>
                    <p className="text-xs text-gray-400">Saldo disponível: {it.saldo}</p>
                  </div>
                  <button
                    onClick={() => removeItem(idx)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                    title="Remover item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Qtd</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={it.quantidade}
                      onChange={(e) => updateItem(idx, { quantidade: e.target.value })}
                      className={`w-full px-2 py-1.5 text-sm rounded-lg border ${over ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-800 dark:text-white font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Valor Unit.</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.valor_unitario}
                      onChange={(e) => updateItem(idx, { valor_unitario: e.target.value })}
                      className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Total</label>
                    <p className="px-2 py-1.5 text-sm font-mono text-gray-800 dark:text-white">{fmtBRL(qtd * vu)}</p>
                  </div>
                </div>
                {over && (
                  <p className="mt-1 text-xs text-red-600">Quantidade maior que o saldo disponível.</p>
                )}
              </div>
            );
          })}

          {!pickerOpen ? (
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-brand-primary border border-dashed border-gray-300 dark:border-gray-600 hover:bg-brand-primary/5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Adicionar item
            </button>
          ) : (
            <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Buscar produto ou SKU…"
                  className="flex-1 bg-transparent text-sm focus:outline-none text-gray-800 dark:text-white"
                />
                <button onClick={() => setPickerOpen(false)}>
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {stockLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : filteredStock.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400">
                    Nenhum produto disponível. Importe NF-e de entrada vinculadas ao catálogo primeiro.
                  </div>
                ) : (
                  filteredStock.map((p) => (
                    <button
                      key={p.store_product_id}
                      onClick={() => addItem(p)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.sku_base ?? 'sem SKU'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-emerald-600">saldo: {p.qty_available}</p>
                        <p className="text-xs text-gray-400 font-mono">{fmtBRL(Number(p.sale_price ?? 0))}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {form.itens.length > 0 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <span className="text-gray-500">Total da NF-e:</span>
              <span className="font-semibold text-gray-800 dark:text-white font-mono">{fmtBRL(valorTotal)}</span>
            </div>
          )}
        </DrawerCard>

        {/* ── Informações adicionais ───────────────────────────────────────── */}
        <DrawerCard title="Informações adicionais" icon={FileText}>
          <textarea
            value={form.informacoes_adicionais}
            onChange={(e) => setForm((f) => ({ ...f, informacoes_adicionais: e.target.value }))}
            rows={3}
            placeholder="Observações complementares (opcional)"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 resize-y"
          />
        </DrawerCard>
      </div>
    </Drawer>
  );
}

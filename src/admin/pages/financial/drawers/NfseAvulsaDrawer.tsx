/**
 * NfseAvulsaDrawer
 *
 * Drawer de emissão de NFS-e avulsa — sem vínculo com installment/receivable.
 *
 * - Tomador: PF/PJ com auto-lookup via edge `cnpj-lookup` e endereço opcional
 *   via `useCepLookup`.
 * - Serviço: código (prefill de `company_nfse_config.codigo_servico_padrao`),
 *   discriminação livre, valor, alíquota ISS.
 * - Envio: `supabase.functions.invoke('nfse-emitter', { source: 'avulsa', ... })`.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useCepLookup } from '../../../hooks/useCepLookup';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { Drawer, DrawerCard } from '../../../components/Drawer';
import {
  Receipt, User, MapPin, FileText, Loader2, Check,
  AlertTriangle, X, Send, Briefcase,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Form {
  tomador: {
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
  servico: {
    codigo_servico: string;
    discriminacao: string;
    valor: string;
    aliq_iss: string;
  };
  informacoes_adicionais: string;
}

const emptyForm = (): Form => ({
  tomador: {
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
  servico: {
    codigo_servico: '',
    discriminacao: '',
    valor: '',
    aliq_iss: '',
  },
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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onEmitted?: () => void;
}

export default function NfseAvulsaDrawer({ open, onClose, onEmitted }: Props) {
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

  // Carrega defaults do company_nfse_config ao abrir
  const loadDefaults = useCallback(async () => {
    const { data } = await supabase
      .from('company_nfse_config')
      .select('codigo_servico_padrao, codigo_servico, aliq_iss_padrao')
      .maybeSingle();
    if (!data) return;
    const cfg = data as {
      codigo_servico_padrao?: string | null;
      codigo_servico?: string | null;
      aliq_iss_padrao?: number | null;
    };
    setForm((f) => ({
      ...f,
      servico: {
        ...f.servico,
        codigo_servico:
          f.servico.codigo_servico ||
          String(cfg.codigo_servico_padrao ?? cfg.codigo_servico ?? ''),
        aliq_iss:
          f.servico.aliq_iss ||
          (cfg.aliq_iss_padrao != null ? String(cfg.aliq_iss_padrao) : ''),
      },
    }));
  }, []);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setSaveState('idle');
      setError(null);
      setCnpjLookupError(null);
      setCnpjLookupDone(false);
      setLastLookupCnpj('');
      loadDefaults();
    }
  }, [open, loadDefaults]);

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
        email?: string;
        endereco?: {
          logradouro?: string; numero?: string; complemento?: string; bairro?: string;
          cep?: string; uf?: string;
          municipio?: { codigo_ibge?: string | number; descricao?: string };
        };
      };
      setForm((f) => ({
        ...f,
        tomador: {
          ...f.tomador,
          razao_social: f.tomador.razao_social || (d.razao_social ?? ''),
          cep: f.tomador.cep || (d.endereco?.cep ?? ''),
          logradouro: f.tomador.logradouro || (d.endereco?.logradouro ?? ''),
          numero: f.tomador.numero || (d.endereco?.numero ?? ''),
          complemento: f.tomador.complemento || (d.endereco?.complemento ?? ''),
          bairro: f.tomador.bairro || (d.endereco?.bairro ?? ''),
          municipio: f.tomador.municipio || (d.endereco?.municipio?.descricao ?? ''),
          uf: f.tomador.uf || (d.endereco?.uf ?? ''),
          codigo_municipio_ibge:
            f.tomador.codigo_municipio_ibge ||
            String(d.endereco?.municipio?.codigo_ibge ?? ''),
          email: f.tomador.email || (d.email ?? ''),
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
    const addr = await cepLookup(form.tomador.cep);
    if (addr) {
      setForm((f) => ({
        ...f,
        tomador: {
          ...f.tomador,
          logradouro: addr.logradouro || f.tomador.logradouro,
          bairro: addr.bairro || f.tomador.bairro,
          municipio: addr.municipio || f.tomador.municipio,
          uf: addr.uf || f.tomador.uf,
          codigo_municipio_ibge: addr.codigo_municipio_ibge || f.tomador.codigo_municipio_ibge,
        },
      }));
    }
  };

  // ── Validação ───────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    const t = form.tomador;
    const docDigits = t.cnpj_cpf.replace(/\D/g, '');
    const expectedLen = t.tipo_pessoa === 'juridica' ? 14 : 11;
    if (docDigits.length !== expectedLen) return 'Informe CNPJ/CPF completo do tomador.';
    if (!t.razao_social.trim()) return 'Informe razão social/nome do tomador.';
    if (!form.servico.discriminacao.trim()) return 'Informe a discriminação do serviço.';
    const valor = Number(form.servico.valor);
    if (!Number.isFinite(valor) || valor <= 0) return 'Valor do serviço inválido.';
    if (!form.servico.codigo_servico.trim()) return 'Informe o código do serviço.';
    return null;
  };

  // ── Emitir ──────────────────────────────────────────────────────────────────
  const handleEmit = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    setSaveState('saving');

    const t = form.tomador;
    const enderecoInformado =
      t.cep || t.logradouro || t.numero || t.bairro || t.municipio || t.uf;

    const payload = {
      source: 'avulsa' as const,
      tomador: {
        tipo_pessoa: t.tipo_pessoa,
        cnpj_cpf: t.cnpj_cpf.replace(/\D/g, ''),
        razao_social: t.razao_social.trim(),
        email: t.email.trim() || null,
        ie: t.ie.trim() || null,
        endereco: enderecoInformado
          ? {
              cep: t.cep.replace(/\D/g, ''),
              logradouro: t.logradouro.trim(),
              numero: t.numero.trim(),
              complemento: t.complemento.trim() || null,
              bairro: t.bairro.trim(),
              municipio: t.municipio.trim(),
              uf: t.uf.trim().toUpperCase(),
              codigo_municipio_ibge: t.codigo_municipio_ibge.trim(),
            }
          : undefined,
      },
      servico: {
        codigo_servico: form.servico.codigo_servico.trim(),
        discriminacao: form.servico.discriminacao.trim(),
        valor: Number(form.servico.valor),
        aliq_iss: form.servico.aliq_iss ? Number(form.servico.aliq_iss) : undefined,
      },
      informacoes_adicionais: form.informacoes_adicionais.trim() || undefined,
      initiated_by: user?.id ?? null,
    };

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('nfse-emitter', {
        body: payload,
      });
      if (fnErr) {
        let msg = fnErr.message || 'Falha ao emitir NFS-e.';
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
      if (data?.status === 'rejeitada') {
        setError(data?.error ?? 'NFS-e rejeitada pela prefeitura.');
        setSaveState('idle');
        onEmitted?.();
        return;
      }
      setSaveState('saved');
      setTimeout(() => {
        onEmitted?.();
        onClose();
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao emitir NFS-e.');
      setSaveState('idle');
    }
  };

  const t = form.tomador;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nova NFS-e"
      icon={Receipt}
      width="w-[680px]"
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
            disabled={saveState === 'saving'}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              saveState === 'saved'
                ? 'bg-emerald-500 text-white'
                : 'bg-brand-primary text-white hover:opacity-90 disabled:opacity-50'
            }`}
          >
            {saveState === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveState === 'saved' && <Check className="w-4 h-4" />}
            {saveState === 'idle' && <Send className="w-4 h-4" />}
            {saveState === 'saving' ? 'Emitindo…' : saveState === 'saved' ? 'Emitida!' : 'Emitir NFS-e'}
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

        {/* ── Tomador ─────────────────────────────────────────────────────── */}
        <DrawerCard title="Tomador" icon={User}>
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
                      tomador: { ...f.tomador, tipo_pessoa: opt.value as 'juridica' | 'fisica', cnpj_cpf: '' },
                    }))}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      t.tipo_pessoa === opt.value
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
                {t.tipo_pessoa === 'juridica' ? 'CNPJ' : 'CPF'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={formatDoc(t.cnpj_cpf, t.tipo_pessoa)}
                  inputMode="numeric"
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '');
                    const maxLen = t.tipo_pessoa === 'juridica' ? 14 : 11;
                    const trimmed = v.slice(0, maxLen);
                    setForm((f) => ({ ...f, tomador: { ...f.tomador, cnpj_cpf: trimmed } }));
                    if (trimmed !== lastLookupCnpj) {
                      setCnpjLookupDone(false);
                      setCnpjLookupError(null);
                    }
                    if (t.tipo_pessoa === 'juridica' && trimmed.length === 14 && trimmed !== lastLookupCnpj && !cnpjLookupLoading) {
                      handleCnpjLookup(trimmed);
                    }
                  }}
                  placeholder={t.tipo_pessoa === 'juridica' ? '00.000.000/0001-00' : '000.000.000-00'}
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
                {t.tipo_pessoa === 'juridica' ? 'Razão Social' : 'Nome Completo'} <span className="text-red-500">*</span>
              </label>
              <input
                value={t.razao_social}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, razao_social: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">E-mail</label>
              <input
                type="email"
                value={t.email}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, email: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>

          {t.tipo_pessoa === 'juridica' && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Inscrição Estadual (opcional)</label>
              <input
                value={t.ie}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, ie: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          )}
        </DrawerCard>

        {/* ── Endereço (opcional) ─────────────────────────────────────────── */}
        <DrawerCard title="Endereço do tomador (opcional)" icon={MapPin}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">CEP</label>
              <input
                value={t.cep}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, cep: e.target.value.replace(/\D/g, '').slice(0, 8) } }))}
                onBlur={handleCepBlur}
                placeholder="00000000"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Logradouro</label>
              <input
                value={t.logradouro}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, logradouro: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Número</label>
              <input
                value={t.numero}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, numero: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Complemento</label>
              <input
                value={t.complemento}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, complemento: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bairro</label>
              <input
                value={t.bairro}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, bairro: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_80px_120px] gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Município</label>
              <input
                value={t.municipio}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, municipio: e.target.value } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">UF</label>
              <input
                value={t.uf}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, uf: e.target.value.toUpperCase().slice(0, 2) } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cód. IBGE</label>
              <input
                value={t.codigo_municipio_ibge}
                onChange={(e) => setForm((f) => ({ ...f, tomador: { ...f.tomador, codigo_municipio_ibge: e.target.value.replace(/\D/g, '').slice(0, 7) } }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
              />
            </div>
          </div>
        </DrawerCard>

        {/* ── Serviço ─────────────────────────────────────────────────────── */}
        <DrawerCard title="Serviço" icon={Briefcase}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Código do serviço <span className="text-red-500">*</span>
              </label>
              <input
                value={form.servico.codigo_servico}
                onChange={(e) => setForm((f) => ({ ...f, servico: { ...f.servico, codigo_servico: e.target.value } }))}
                placeholder="ex.: 8.02"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Alíq. ISS (%)</label>
              <input
                value={form.servico.aliq_iss}
                inputMode="decimal"
                onChange={(e) => setForm((f) => ({ ...f, servico: { ...f.servico, aliq_iss: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.') } }))}
                placeholder="2.5"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Discriminação <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.servico.discriminacao}
              onChange={(e) => setForm((f) => ({ ...f, servico: { ...f.servico, discriminacao: e.target.value.slice(0, 2000) } }))}
              rows={4}
              placeholder="Descrição detalhada do serviço prestado…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
            <p className="mt-1 text-[11px] text-gray-400">{form.servico.discriminacao.length}/2000</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Valor (R$) <span className="text-red-500">*</span>
              </label>
              <input
                value={form.servico.valor}
                inputMode="decimal"
                onChange={(e) => setForm((f) => ({ ...f, servico: { ...f.servico, valor: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.') } }))}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30 font-mono"
              />
            </div>
          </div>
        </DrawerCard>

        {/* ── Informações adicionais ─────────────────────────────────────── */}
        <DrawerCard title="Informações adicionais" icon={FileText}>
          <textarea
            value={form.informacoes_adicionais}
            onChange={(e) => setForm((f) => ({ ...f, informacoes_adicionais: e.target.value.slice(0, 2000) }))}
            rows={3}
            placeholder="Observações a constar na NFS-e…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </DrawerCard>
      </div>
    </Drawer>
  );
}

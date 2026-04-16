import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  QrCode,
  CreditCard,
  Receipt,
  Copy,
  Check,
  RefreshCw,
  Download,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderItem {
  product_name: string;
  variant_description: string | null;
  quantity: number;
  unit_price: number;
}

interface CheckoutSessionData {
  session: {
    id: string;
    token: string;
    status: 'pending' | 'paid' | 'expired' | 'cancelled';
    billing_type: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
    amount: number;
    expires_at: string;
  };
  order: {
    order_number: string;
    guardian_name: string;
    student_name: string;
    items: OrderItem[];
    total_amount: number;
    boleto_url: string | null;
  };
  school_name: string;
  pix_qr_image?: string;
  pix_payload?: string;
  pix_expiration?: string;
  boleto_identification_field?: string;
}

type PageState = 'loading' | 'not_found' | 'expired' | 'success' | 'active';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function detectCardBrand(number: string): string {
  const first = number.replace(/\D/g, '')[0];
  if (first === '4') return 'Visa';
  if (first === '5') return 'Mastercard';
  if (first === '6') return 'Elo';
  return '';
}

function useCountdown(targetIso: string | undefined) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();

    const tick = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  return { secondsLeft, display: `${mm}:${ss}` };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-sm text-brand-primary font-medium px-3 py-1.5 rounded-lg border border-brand-primary/30 hover:bg-brand-primary/5 transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Copiado!
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          Copiar
        </>
      )}
    </button>
  );
}

function OrderSummary({ order }: { order: CheckoutSessionData['order'] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div>
        <p className="font-semibold text-gray-800">Pedido #{order.order_number}</p>
        <p className="text-sm text-gray-500 mt-0.5">Aluno: {order.student_name}</p>
      </div>

      <hr className="border-gray-100" />

      <div className="space-y-2">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex items-start justify-between gap-2 text-sm">
            <div className="flex-1 min-w-0">
              <span className="text-gray-700">{item.product_name}</span>
              {item.variant_description && (
                <span className="text-gray-400"> ({item.variant_description})</span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-gray-400">× {item.quantity}</span>
              <span className="text-gray-700 font-medium w-24 text-right">
                {formatCurrency(item.unit_price * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <hr className="border-gray-100" />

      <div className="flex items-center justify-between font-semibold text-gray-800">
        <span>Total</span>
        <span className="text-lg">{formatCurrency(order.total_amount)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PIX section
// ---------------------------------------------------------------------------

function PixSection({
  data,
  onRefresh,
  onPaid,
}: {
  data: CheckoutSessionData;
  onRefresh: () => void;
  onPaid: () => void;
}) {
  const { secondsLeft, display } = useCountdown(data.pix_expiration);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const { data: res } = await supabase.functions.invoke('checkout-proxy', {
        body: { action: 'pollStatus', token: data.session.token },
      });
      if (res?.status === 'paid') {
        onPaid();
      }
    } catch {
      // ignore poll errors
    }
  }, [data.session.token, onPaid]);

  useEffect(() => {
    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [poll]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <div className="flex items-center gap-2 text-gray-700 font-semibold">
        <QrCode className="w-5 h-5 text-brand-primary" />
        Pagar com PIX
      </div>

      {data.pix_qr_image && (
        <div className="flex justify-center">
          <img
            src={`data:image/png;base64,${data.pix_qr_image}`}
            alt="QR Code PIX"
            className="w-48 h-48 rounded-xl border border-gray-100"
          />
        </div>
      )}

      {secondsLeft === 0 ? (
        <div className="text-center space-y-2">
          <p className="text-amber-600 text-sm font-medium">Código expirado.</p>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 mx-auto text-sm text-brand-primary font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Gerar novo código
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 text-sm text-amber-600 font-medium">
          <Clock className="w-4 h-4" />
          Válido por {display}
        </div>
      )}

      {data.pix_payload && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Ou copie o código PIX:</p>
          <div className="flex items-start gap-2">
            <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-xl p-3 break-all text-gray-600 font-mono">
              {data.pix_payload}
            </code>
            <CopyButton text={data.pix_payload} />
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-600">Como pagar:</p>
        <p>1. Abra seu banco</p>
        <p>2. Escolha PIX</p>
        <p>3. Escaneie o QR ou cole o código</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BOLETO section
// ---------------------------------------------------------------------------

function BoletoSection({
  data,
  onPaid,
}: {
  data: CheckoutSessionData;
  onPaid: () => void;
}) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const { data: res } = await supabase.functions.invoke('checkout-proxy', {
        body: { action: 'pollStatus', token: data.session.token },
      });
      if (res?.status === 'paid') {
        onPaid();
      }
    } catch {
      // ignore
    }
  }, [data.session.token, onPaid]);

  useEffect(() => {
    pollRef.current = setInterval(poll, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [poll]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <div className="flex items-center gap-2 text-gray-700 font-semibold">
        <Receipt className="w-5 h-5 text-brand-primary" />
        Boleto Bancário
      </div>

      {data.boleto_identification_field && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Linha digitável:</p>
          <div className="flex items-start gap-2">
            <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-xl p-3 break-all text-gray-600 font-mono">
              {data.boleto_identification_field}
            </code>
            <CopyButton text={data.boleto_identification_field} />
          </div>
        </div>
      )}

      {data.order.boleto_url && (
        <a
          href={data.order.boleto_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-brand-primary text-white rounded-2xl py-3.5 font-medium hover:opacity-90 transition-opacity"
        >
          <Download className="w-4 h-4" />
          Baixar boleto
        </a>
      )}

      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
        <p>Pague até a data de vencimento em qualquer banco, lotérica ou pelo app do seu banco.</p>
        <p className="text-amber-600 font-medium mt-1">
          Após o pagamento, a confirmação pode levar até 2 dias úteis.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CREDIT CARD section
// ---------------------------------------------------------------------------

interface CardForm {
  name: string;
  number: string;
  expiry: string;
  cvv: string;
  cep: string;
  addressNumber: string;
  installments: string;
}

function CreditCardSection({
  data,
  onPaid,
}: {
  data: CheckoutSessionData;
  onPaid: () => void;
}) {
  const [form, setForm] = useState<CardForm>({
    name: '',
    number: '',
    expiry: '',
    cvv: '',
    cep: '',
    addressNumber: '',
    installments: '1',
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);

  const totalAmount = data.order.total_amount;

  const installmentOptions = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    return { value: String(n), label: `${n}x de ${formatCurrency(totalAmount / n)}` };
  });

  const brand = detectCardBrand(form.number);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setForm((f) => ({ ...f, number: formatted }));
    if (formatted.replace(/\s/g, '').length === 16) {
      expiryRef.current?.focus();
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiry(e.target.value);
    setForm((f) => ({ ...f, expiry: formatted }));
    if (formatted.length === 5) {
      cvvRef.current?.focus();
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, cep: formatCep(e.target.value) }));
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Informe o nome impresso no cartão.';
    const digits = form.number.replace(/\s/g, '');
    if (digits.length < 13) return 'Número de cartão inválido.';
    if (!/^\d{2}\/\d{2}$/.test(form.expiry)) return 'Data de validade inválida (MM/AA).';
    if (form.cvv.length < 3) return 'CVV inválido.';
    if (form.cep.replace(/\D/g, '').length !== 8) return 'CEP inválido.';
    if (!form.addressNumber.trim()) return 'Informe o número do endereço.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const err = validate();
    if (err) {
      setErrorMsg(err);
      return;
    }

    setSaving(true);
    try {
      const [expMonth, expYear] = form.expiry.split('/');
      const { data: res, error } = await supabase.functions.invoke('checkout-proxy', {
        body: {
          action: 'payWithCard',
          token: data.session.token,
          card: {
            holder_name: form.name.toUpperCase(),
            number: form.number.replace(/\s/g, ''),
            expiry_month: expMonth,
            expiry_year: expYear,
            ccv: form.cvv,
          },
          postal_code: form.cep.replace(/\D/g, ''),
          address_number: form.addressNumber,
          installment_count: parseInt(form.installments, 10),
        },
      });

      if (error || res?.error) {
        setErrorMsg(
          res?.message || 'Cartão recusado. Verifique os dados e tente novamente.'
        );
        return;
      }

      onPaid();
    } catch {
      setErrorMsg('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4"
    >
      <div className="flex items-center gap-2 text-gray-700 font-semibold">
        <CreditCard className="w-5 h-5 text-brand-primary" />
        Cartão de Crédito
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Nome no cartão</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))}
          placeholder="COMO ESTÁ NO CARTÃO"
          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          autoComplete="cc-name"
        />
      </div>

      {/* Card number */}
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Número do cartão</label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={form.number}
            onChange={handleNumberChange}
            placeholder="0000 0000 0000 0000"
            maxLength={19}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary pr-16"
            autoComplete="cc-number"
          />
          {brand && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
              {brand}
            </span>
          )}
        </div>
      </div>

      {/* Expiry + CVV */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm text-gray-600">Validade</label>
          <input
            ref={expiryRef}
            type="text"
            inputMode="numeric"
            value={form.expiry}
            onChange={handleExpiryChange}
            placeholder="MM/AA"
            maxLength={5}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            autoComplete="cc-exp"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-600">CVV</label>
          <input
            ref={cvvRef}
            type="text"
            inputMode="numeric"
            value={form.cvv}
            onChange={(e) => setForm((f) => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            placeholder="•••"
            maxLength={4}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            autoComplete="cc-csc"
          />
        </div>
      </div>

      {/* CEP + Address number */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm text-gray-600">CEP</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.cep}
            onChange={handleCepChange}
            placeholder="00000-000"
            maxLength={9}
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            autoComplete="postal-code"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-600">Número</label>
          <input
            type="text"
            value={form.addressNumber}
            onChange={(e) => setForm((f) => ({ ...f, addressNumber: e.target.value }))}
            placeholder="123"
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            autoComplete="address-line2"
          />
        </div>
      </div>

      {/* Installments */}
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Parcelas</label>
        <select
          value={form.installments}
          onChange={(e) => setForm((f) => ({ ...f, installments: e.target.value }))}
          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary bg-white"
        >
          {installmentOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center justify-center gap-2 w-full bg-brand-primary text-white rounded-2xl py-3.5 font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processando pagamento...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Pagar {formatCurrency(totalAmount)}
          </>
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PagarPage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [sessionData, setSessionData] = useState<CheckoutSessionData | null>(null);

  const fetchSession = useCallback(async () => {
    if (!token) {
      setPageState('not_found');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('checkout-proxy', {
        body: { action: 'getSession', token },
      });

      if (error || data?.error) {
        const code = data?.code || '';
        if (code === 'session_expired') {
          setPageState('expired');
        } else {
          setPageState('not_found');
        }
        return;
      }

      const checkoutData = data as CheckoutSessionData;
      setSessionData(checkoutData);

      if (checkoutData.session.status === 'paid') {
        setPageState('success');
      } else if (
        checkoutData.session.status === 'expired' ||
        checkoutData.session.status === 'cancelled'
      ) {
        setPageState('expired');
      } else {
        setPageState('active');
      }
    } catch {
      setPageState('not_found');
    }
  }, [token]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handlePaid = useCallback(() => {
    setPageState('success');
  }, []);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="bg-gray-50 min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
        <p className="text-gray-500 text-sm">Carregando...</p>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────

  if (pageState === 'not_found') {
    return (
      <div className="bg-gray-50 min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="w-14 h-14 text-red-500" />
        <h1 className="text-xl font-bold text-gray-800">Link de pagamento inválido</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          Este link não existe ou já foi utilizado.
        </p>
        <p className="text-gray-400 text-xs max-w-xs">
          Em caso de dúvidas, entre em contato com a secretaria.
        </p>
      </div>
    );
  }

  // ── Expired ──────────────────────────────────────────────────────────────

  if (pageState === 'expired') {
    return (
      <div className="bg-gray-50 min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Clock className="w-14 h-14 text-amber-500" />
        <h1 className="text-xl font-bold text-gray-800">Link expirado</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          Este link de pagamento não está mais disponível.
        </p>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────

  if (pageState === 'success') {
    const orderNumber = sessionData?.order.order_number ?? '';
    return (
      <div className="bg-gray-50 min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center">
        <CheckCircle2 className="w-16 h-16 text-emerald-500" />
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-800">Pagamento Confirmado!</h1>
          {orderNumber && (
            <p className="text-brand-primary font-medium">Pedido #{orderNumber} confirmado.</p>
          )}
        </div>
        <p className="text-gray-500 text-sm max-w-xs">
          Você receberá uma notificação quando estiver pronto para retirada.
        </p>
      </div>
    );
  }

  // ── Active session ────────────────────────────────────────────────────────

  if (!sessionData) return null;

  const { session, order, school_name } = sessionData;

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4">
      <div className="max-w-md mx-auto space-y-5">

        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-brand-primary">{school_name || 'Colégio'}</h1>
          <p className="text-sm text-gray-400">Pagamento Seguro</p>
        </div>

        {/* Order summary */}
        <OrderSummary order={order} />

        {/* Payment section */}
        {session.billing_type === 'PIX' && (
          <PixSection data={sessionData} onRefresh={fetchSession} onPaid={handlePaid} />
        )}

        {session.billing_type === 'BOLETO' && (
          <BoletoSection data={sessionData} onPaid={handlePaid} />
        )}

        {session.billing_type === 'CREDIT_CARD' && (
          <CreditCardSection data={sessionData} onPaid={handlePaid} />
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-300 pb-4">
          Transação segura · {school_name || 'Colégio'}
        </p>
      </div>
    </div>
  );
}

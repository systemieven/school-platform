/**
 * AiAgentsPanel
 *
 * CRUD dos agentes de IA (`ai_agents`) + visualização do log de uso (`ai_usage_log`).
 * Admins editam prompt, provider (Anthropic/OpenAI), modelo, temperatura e max_tokens.
 * "Testar" faz dry_run ou chamada real com contexto JSON colado manualmente.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { SettingsCard } from '../../components/SettingsCard';
import { SelectDropdown } from '../../components/FormField';
import { Drawer, DrawerCard } from '../../components/Drawer';
import {
  Bot, Loader2, Check, Save, Sparkles, Play, Activity, AlertCircle,
  Pencil, Zap, ZapOff, Brain,
} from 'lucide-react';

type Provider = 'anthropic' | 'openai';

interface AiAgent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  provider: Provider;
  model: string;
  system_prompt: string;
  user_prompt_template: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
  updated_at: string;
}

interface UsageRow {
  id: string;
  agent_slug: string;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  status: 'ok' | 'error';
  error_message: string | null;
  created_at: string;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

const LABEL_CLS = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5';
const INPUT_CLS = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm focus:border-brand-primary outline-none';

function fmtDatetime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function extractVars(template: string): string[] {
  const out = new Set<string>();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) out.add(m[1]);
  return [...out];
}

export default function AiAgentsPanel() {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AiAgent | null>(null);
  const [form, setForm] = useState<AiAgent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [testContext, setTestContext] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: agentsData }, { data: usageData }] = await Promise.all([
      supabase.from('ai_agents').select('*').order('slug'),
      supabase.from('ai_usage_log').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    setAgents((agentsData ?? []) as AiAgent[]);
    setUsage((usageData ?? []) as UsageRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleEnabled(agent: AiAgent) {
    const next = !agent.enabled;
    setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, enabled: next } : a));
    await supabase.from('ai_agents').update({ enabled: next }).eq('id', agent.id);
    logAudit({
      action: 'update', module: 'ai', recordId: agent.id,
      description: `Agente ${agent.slug} ${next ? 'ativado' : 'desativado'}`,
    });
  }

  function openEdit(agent: AiAgent) {
    setEditing(agent);
    setForm({ ...agent });
    setTestContext('');
    setTestResult(null);
    setTestError(null);
  }

  function closeEdit() {
    setEditing(null);
    setForm(null);
    setSaved(false);
  }

  async function handleSave() {
    if (!form || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from('ai_agents')
      .update({
        provider: form.provider,
        model: form.model,
        system_prompt: form.system_prompt,
        user_prompt_template: form.user_prompt_template,
        temperature: form.temperature,
        max_tokens: form.max_tokens,
      })
      .eq('id', form.id);
    setSaving(false);
    if (error) { setTestError(error.message); return; }
    setSaved(true);
    logAudit({
      action: 'update', module: 'ai', recordId: form.id,
      description: `Agente ${form.slug}: prompt/provider atualizados`,
    });
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => {
      closeEdit();
      load();
    }, 900);
  }

  async function handleTest() {
    if (!form || testBusy) return;
    setTestBusy(true);
    setTestResult(null);
    setTestError(null);
    let ctx: Record<string, unknown> = {};
    if (testContext.trim()) {
      try { ctx = JSON.parse(testContext); } catch {
        setTestBusy(false);
        setTestError('JSON invalido no contexto de teste.');
        return;
      }
    }
    const { data, error } = await supabase.functions.invoke('ai-orchestrator', {
      body: { agent_slug: form.slug, context: ctx },
    });
    setTestBusy(false);
    if (error || (data as { error?: string } | null)?.error) {
      setTestError((data as { error?: string } | null)?.error ?? error?.message ?? 'Falha na chamada');
      return;
    }
    setTestResult((data as { text?: string }).text ?? '');
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const vars = form ? extractVars(form.user_prompt_template) : [];

  return (
    <div className="space-y-6">
      <SettingsCard title="Agentes de IA" icon={Brain} description="Cada agente encapsula um prompt + provider. Admins podem trocar entre Anthropic e OpenAI por agente.">
        {agents.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum agente cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {agents.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/40 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Bot className="w-4 h-4 text-brand-primary dark:text-brand-secondary flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800 dark:text-white truncate">{a.name}</span>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-50 dark:bg-gray-900 rounded px-1.5 py-0.5">{a.slug}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${a.provider === 'anthropic' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                      {PROVIDER_LABEL[a.provider]} · {a.model}
                    </span>
                  </div>
                  {a.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{a.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleEnabled(a)}
                    className={`p-2 rounded-lg transition-colors ${a.enabled ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-700'}`}
                    title={a.enabled ? 'Desativar' : 'Ativar'}
                  >
                    {a.enabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-brand-primary hover:text-white transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Uso recente" icon={Activity} description="Últimas 20 chamadas ao orquestrador.">
        {usage.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma chamada registrada ainda.</p>
        ) : (
          <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="hidden md:grid md:grid-cols-[1fr_90px_90px_70px_70px_140px] gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/40 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              <span>Agente</span>
              <span>In</span>
              <span>Out</span>
              <span>Lat</span>
              <span>Status</span>
              <span>Quando</span>
            </div>
            {usage.map((u) => (
              <div key={u.id} className="grid grid-cols-1 md:grid-cols-[1fr_90px_90px_70px_70px_140px] gap-2 px-3 py-2 border-t border-gray-50 dark:border-gray-800 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-gray-700 dark:text-gray-200 truncate">{u.agent_slug}</p>
                  <p className="text-[10px] text-gray-400">{u.provider} · {u.model}</p>
                </div>
                <span className="text-gray-500">{u.input_tokens ?? '—'}</span>
                <span className="text-gray-500">{u.output_tokens ?? '—'}</span>
                <span className="text-gray-500">{u.latency_ms != null ? `${u.latency_ms}ms` : '—'}</span>
                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold w-fit h-fit ${u.status === 'ok' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                  {u.status}
                </span>
                <span className="text-gray-400 text-[11px]">{fmtDatetime(u.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      {/* ── Edit Drawer ─────────────────────────────────────────────────── */}
      <Drawer
        open={!!editing}
        onClose={closeEdit}
        title={editing?.name ?? ''}
        icon={Bot}
        width="w-[640px]"
        footer={
          <div className="flex gap-3">
            <button
              onClick={closeEdit}
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
                <><Check className="w-4 h-4" />Salvo!</>
              ) : (
                <><Save className="w-4 h-4" />Salvar agente</>
              )}
            </button>
          </div>
        }
      >
        {form && (
          <>
            <DrawerCard title="Provider e modelo" icon={Sparkles}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Provider</label>
                  <SelectDropdown
                    value={form.provider}
                    onChange={(e) => setForm({ ...form, provider: e.target.value as Provider })}
                  >
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT)</option>
                  </SelectDropdown>
                </div>
                <div>
                  <label className={LABEL_CLS}>Modelo</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder={form.provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o'}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Temperatura</label>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={form.temperature}
                    onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
                    className={INPUT_CLS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Max Tokens</label>
                  <input
                    type="number"
                    min={1}
                    max={16384}
                    step={64}
                    value={form.max_tokens}
                    onChange={(e) => setForm({ ...form, max_tokens: Number(e.target.value) })}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
            </DrawerCard>

            <DrawerCard title="System prompt" icon={Brain}>
              <textarea
                value={form.system_prompt}
                onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                rows={6}
                className={`${INPUT_CLS} resize-none font-mono text-xs`}
              />
            </DrawerCard>

            <DrawerCard title="User prompt template" icon={Sparkles}>
              <textarea
                value={form.user_prompt_template}
                onChange={(e) => setForm({ ...form, user_prompt_template: e.target.value })}
                rows={6}
                className={`${INPUT_CLS} resize-none font-mono text-xs`}
              />
              {vars.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Variaveis:</span>
                  {vars.map((v) => (
                    <span key={v} className="text-[10px] font-mono bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20 dark:text-brand-secondary px-2 py-0.5 rounded">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}
            </DrawerCard>

            <DrawerCard title="Testar agente" icon={Play}>
              <div>
                <label className={LABEL_CLS}>Contexto (JSON)</label>
                <textarea
                  value={testContext}
                  onChange={(e) => setTestContext(e.target.value)}
                  placeholder={vars.length > 0 ? `{\n  "${vars[0]}": "..."\n}` : '{}'}
                  rows={4}
                  className={`${INPUT_CLS} resize-none font-mono text-xs`}
                />
              </div>
              <button
                onClick={handleTest}
                disabled={testBusy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-brand-primary hover:text-white disabled:opacity-50 transition-colors"
              >
                {testBusy ? <><Loader2 className="w-4 h-4 animate-spin" />Chamando…</> : <><Play className="w-4 h-4" />Executar chamada real</>}
              </button>
              {testError && (
                <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {testError}
                </p>
              )}
              {testResult != null && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Resposta</p>
                  <pre className="text-xs font-mono text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{testResult || '(vazio)'}</pre>
                </div>
              )}
            </DrawerCard>
          </>
        )}
      </Drawer>
    </div>
  );
}

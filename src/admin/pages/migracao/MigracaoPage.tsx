/**
 * MigracaoPage — Central de Migracao de Dados (OP-1)
 *
 * Hub super_admin-only para importacao inicial de dados do sistema anterior.
 * Cada modulo e importado uma unica vez; apos sucesso e "travado" (status
 * `completed`) em `module_imports`. Super_admin pode reabrir com confirmacao
 * explicita de risco (duplicidade).
 *
 * Este PR entrega o dashboard e a integracao com o importador de alunos
 * ja existente (`/admin/alunos/importar`). Os demais modulos sao listados
 * como "Em breve" e serao habilitados em PRs seguintes do Sprint 10, conforme
 * `ModuleImportWizard` for generalizado a partir de `StudentImportPage`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DatabaseBackup,
  BookOpen,
  GraduationCap,
  Users,
  UserCheck,
  Package,
  MessageSquare,
  Building2,
  TrendingUp,
  TrendingDown,
  CalendarCheck,
  Wallet,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Unlock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';

// ─────────────────────────────────────────────────────────────────────────────
// Module catalog
// ─────────────────────────────────────────────────────────────────────────────
//
// Ordem respeita dependencias: Grupo A nao depende de nada; B depende de A;
// C depende de B. Alinhado com §10.13 do PRD.

type ModuleGroup = 'A' | 'B' | 'C';

interface ModuleDef {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: ModuleGroup;
  /** Rota do importador; null = ainda nao implementado (renderizado "Em breve"). */
  importPath: string | null;
}

const GROUP_LABEL: Record<ModuleGroup, string> = {
  A: 'Grupo A — Sem dependências',
  B: 'Grupo B — Recomendado após Grupo A',
  C: 'Grupo C — Recomendado após Grupo B',
};

const GROUP_HINT: Record<ModuleGroup, string> = {
  A: 'Importe primeiro. Nenhuma destas entidades depende de outras para existir.',
  B: 'Estas entidades fazem referência às do Grupo A. Importe depois que A estiver completo.',
  C: 'Dependem de entidades dos Grupos A e B. Importe por último.',
};

const MODULES: ModuleDef[] = [
  // Grupo A
  { key: 'segments',              label: 'Segmentos',           description: 'Passo 1 — ex: Infantil, Fundamental I, Médio', icon: GraduationCap, group: 'A', importPath: '/admin/migracao/segmentos' },
  { key: 'school-series',         label: 'Séries',              description: 'Passo 2 — depende de segmentos importados',  icon: BookOpen,      group: 'A', importPath: '/admin/migracao/series' },
  { key: 'school-classes',        label: 'Turmas',              description: 'Passo 3 — depende de séries importadas',     icon: Users,         group: 'A', importPath: '/admin/migracao/turmas' },
  { key: 'contacts',              label: 'Contatos',            description: 'Leads e contatos do CRM',    icon: MessageSquare,  group: 'A', importPath: '/admin/migracao/contatos' },
  { key: 'fornecedores',          label: 'Fornecedores',        description: 'Cadastro de fornecedores',   icon: Building2,     group: 'A', importPath: '/admin/migracao/fornecedores' },
  { key: 'store-products',        label: 'Produtos',            description: 'Catálogo da loja',           icon: Package,       group: 'A', importPath: '/admin/migracao/produtos' },
  { key: 'users',                 label: 'Colaboradores',       description: 'Usuários administrativos',   icon: Users,         group: 'A', importPath: null },

  // Grupo B
  { key: 'students',              label: 'Alunos',              description: 'Cadastro de alunos ativos',  icon: UserCheck,     group: 'B', importPath: '/admin/alunos/importar' },
  { key: 'financial-receivables', label: 'Contas a Receber',    description: 'A-Receber em aberto (taxas, eventos, manual)', icon: TrendingUp,    group: 'B', importPath: '/admin/migracao/receber' },
  { key: 'financial-payables',    label: 'Contas a Pagar',      description: 'A-Pagar em aberto (despesas fixas e variáveis)', icon: TrendingDown,  group: 'B', importPath: '/admin/migracao/pagar' },

  // Grupo C
  { key: 'appointments',          label: 'Agendamentos',        description: 'Agenda histórica',           icon: CalendarCheck, group: 'C', importPath: null },
  { key: 'financial-cash',        label: 'Lançamentos de Caixa', description: 'Movimentações anteriores',   icon: Wallet,        group: 'C', importPath: null },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleImportRow {
  module_key: string;
  status: 'available' | 'completed';
  records_imported: number;
  completed_at: string | null;
  completed_by: string | null;
  unlocked_at: string | null;
  unlock_reason: string | null;
}

type StatusByKey = Record<string, ModuleImportRow>;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MigracaoPage() {
  const navigate = useNavigate();
  const { profile } = useAdminAuth();

  const [statusMap, setStatusMap] = useState<StatusByKey>({});
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  // Unlock confirmation modal
  const [unlockTarget, setUnlockTarget] = useState<ModuleDef | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('module_imports')
      .select('module_key, status, records_imported, completed_at, completed_by, unlocked_at, unlock_reason');

    if (!error && data) {
      const map: StatusByKey = {};
      for (const row of data as ModuleImportRow[]) map[row.module_key] = row;
      setStatusMap(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Aggregate progress
  const { completedCount, totalCount, progressPct } = useMemo(() => {
    const total = MODULES.length;
    const done = MODULES.filter((m) => statusMap[m.key]?.status === 'completed').length;
    return {
      completedCount: done,
      totalCount: total,
      progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [statusMap]);

  // Group-by
  const modulesByGroup = useMemo(() => {
    const groups: Record<ModuleGroup, ModuleDef[]> = { A: [], B: [], C: [] };
    for (const mod of MODULES) groups[mod.group].push(mod);
    return groups;
  }, []);

  const openImporter = (mod: ModuleDef) => {
    if (!mod.importPath) return;
    navigate(mod.importPath);
  };

  const requestUnlock = (mod: ModuleDef) => {
    setUnlockTarget(mod);
    setUnlockReason('');
  };

  const confirmUnlock = useCallback(async () => {
    if (!unlockTarget || !unlockReason.trim()) return;
    setUnlocking(unlockTarget.key);
    const { error } = await supabase
      .from('module_imports')
      .update({
        status: 'available',
        unlocked_at: new Date().toISOString(),
        unlocked_by: profile?.id ?? null,
        unlock_reason: unlockReason.trim(),
      })
      .eq('module_key', unlockTarget.key);

    if (!error) {
      await logAudit({
        action: 'update',
        module: 'data-migration',
        description: `Módulo "${unlockTarget.label}" desbloqueado para reimportação. Motivo: ${unlockReason.trim()}`,
      });
    }
    setUnlocking(null);
    setUnlockTarget(null);
    setUnlockReason('');
    await loadStatus();
  }, [unlockTarget, unlockReason, profile, loadStatus]);

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-primary/10 dark:bg-brand-secondary/10">
          <DatabaseBackup className="w-6 h-6 text-brand-primary dark:text-brand-secondary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold text-gray-900 dark:text-white">
            Central de Migração
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Transfira os dados do sistema anterior para a plataforma. Cada módulo é importado uma vez e
            travado após o sucesso para evitar duplicidade.
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Progresso geral
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            {completedCount} / {totalCount} módulos concluídos · {progressPct}%
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Groups */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : (
        (['A', 'B', 'C'] as const).map((group) => (
          <section key={group} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                {GROUP_LABEL[group]}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {GROUP_HINT[group]}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {modulesByGroup[group].map((mod) => (
                <ModuleCard
                  key={mod.key}
                  mod={mod}
                  row={statusMap[mod.key]}
                  onImport={() => openImporter(mod)}
                  onUnlock={() => requestUnlock(mod)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {/* Unlock confirmation modal */}
      {unlockTarget && (
        <UnlockModal
          mod={unlockTarget}
          reason={unlockReason}
          onChangeReason={setUnlockReason}
          onConfirm={confirmUnlock}
          onCancel={() => { setUnlockTarget(null); setUnlockReason(''); }}
          loading={unlocking === unlockTarget.key}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ModuleCard
// ─────────────────────────────────────────────────────────────────────────────

interface ModuleCardProps {
  mod: ModuleDef;
  row: ModuleImportRow | undefined;
  onImport: () => void;
  onUnlock: () => void;
}

function ModuleCard({ mod, row, onImport, onUnlock }: ModuleCardProps) {
  const Icon = mod.icon;
  const status = row?.status ?? 'available';
  const completed = status === 'completed';
  const unimplemented = !mod.importPath;

  // Completed badge data
  const records = row?.records_imported ?? 0;
  const completedDate = row?.completed_at
    ? new Date(row.completed_at).toLocaleDateString('pt-BR')
    : null;

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        completed
          ? 'bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
          : unimplemented
            ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 opacity-70'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-brand-primary dark:hover:border-brand-secondary hover:shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${
            completed
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {mod.label}
            </h3>
            <StatusPill status={status} unimplemented={unimplemented} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {mod.description}
          </p>

          {/* Completion details */}
          {completed && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2">
              {records.toLocaleString('pt-BR')} registro{records === 1 ? '' : 's'}
              {completedDate ? ` · ${completedDate}` : ''}
            </p>
          )}
          {row?.unlocked_at && !completed && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
              <Unlock className="w-3 h-3" /> Reaberto · {row.unlock_reason ?? 'sem motivo'}
            </p>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            {unimplemented ? (
              <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                Em breve
              </span>
            ) : completed ? (
              <button
                onClick={onUnlock}
                className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
              >
                <Unlock className="w-3 h-3" />
                Reabrir importação
              </button>
            ) : (
              <button
                onClick={onImport}
                className="flex items-center gap-1 text-xs font-semibold text-brand-primary dark:text-brand-secondary hover:gap-2 transition-all"
              >
                Importar
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusPill
// ─────────────────────────────────────────────────────────────────────────────

function StatusPill({ status, unimplemented }: { status: 'available' | 'completed'; unimplemented: boolean }) {
  if (unimplemented) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        <Clock className="w-2.5 h-2.5" /> Em breve
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-2.5 h-2.5" /> Concluído
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
      <Circle className="w-2.5 h-2.5" /> Disponível
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UnlockModal — super_admin confirms reimport risk
// ─────────────────────────────────────────────────────────────────────────────

interface UnlockModalProps {
  mod: ModuleDef;
  reason: string;
  onChangeReason: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function UnlockModal({ mod, reason, onChangeReason, onConfirm, onCancel, loading }: UnlockModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Reabrir importação de {mod.label}?
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Ao reabrir, o módulo volta para <strong>Disponível</strong>. Uma nova importação pode gerar
              registros duplicados se a planilha contiver dados já presentes no sistema. Esta ação é
              registrada no audit log.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Motivo da reabertura <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => onChangeReason(e.target.value)}
            rows={3}
            placeholder="Ex: arquivo original tinha linhas faltando; planilha corrigida recebida em 17/04."
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/60 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!reason.trim() || loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            Reabrir
          </button>
        </div>
      </div>
    </div>
  );
}

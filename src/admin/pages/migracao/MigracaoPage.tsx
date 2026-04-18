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
  Wallet,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Unlock,
  Layers,
  Link2,
  Coins,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { SettingsCard } from '../../components/SettingsCard';

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

const GROUP_ICON: Record<ModuleGroup, LucideIcon> = {
  A: Layers,
  B: Link2,
  C: Coins,
};

const MODULES: ModuleDef[] = [
  // Grupo A
  { key: 'segments',              label: 'Segmentos',           description: 'Passo 1 — ex: Infantil, Fundamental I, Médio', icon: GraduationCap, group: 'A', importPath: '/admin/migracao/segmentos' },
  { key: 'school-series',         label: 'Séries',              description: 'Passo 2 — depende de segmentos importados',  icon: BookOpen,      group: 'A', importPath: '/admin/migracao/series' },
  { key: 'school-classes',        label: 'Turmas',              description: 'Passo 3 — depende de séries importadas',     icon: Users,         group: 'A', importPath: '/admin/migracao/turmas' },
  { key: 'contacts',              label: 'Contatos',            description: 'Leads e contatos do CRM',    icon: MessageSquare,  group: 'A', importPath: '/admin/migracao/contatos' },
  { key: 'fornecedores',          label: 'Fornecedores',        description: 'Cadastro de fornecedores',   icon: Building2,     group: 'A', importPath: '/admin/migracao/fornecedores' },
  { key: 'store-products',        label: 'Produtos',            description: 'Catálogo da loja',           icon: Package,       group: 'A', importPath: '/admin/migracao/produtos' },
  { key: 'users',                 label: 'Colaboradores',       description: 'Usuários administrativos (senha temporária + troca no 1º login)', icon: Users,         group: 'A', importPath: '/admin/migracao/colaboradores' },

  // Grupo B
  { key: 'students',              label: 'Alunos',              description: 'Cadastro de alunos ativos',  icon: UserCheck,     group: 'B', importPath: '/admin/alunos/importar' },
  { key: 'financial-receivables', label: 'Contas a Receber',    description: 'A-Receber em aberto (taxas, eventos, manual)', icon: TrendingUp,    group: 'B', importPath: '/admin/migracao/receber' },
  { key: 'financial-payables',    label: 'Contas a Pagar',      description: 'A-Pagar em aberto (despesas fixas e variáveis)', icon: TrendingDown,  group: 'B', importPath: '/admin/migracao/pagar' },

  // Grupo C
  { key: 'financial-cash',        label: 'Lançamentos de Caixa', description: 'Movimentações anteriores',   icon: Wallet,        group: 'C', importPath: '/admin/migracao/caixa' },
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

  // Maior grupo → usado para alinhar o avatar-final das três timelines.
  const maxGroupSize = useMemo(
    () => Math.max(...Object.values(modulesByGroup).map((m) => m.length)),
    [modulesByGroup],
  );

  // Progresso por grupo + cadeia de dependência (A → B → C; sequencial dentro)
  const groupProgress = useMemo(() => {
    const res: Record<ModuleGroup, { completed: number; total: number; pct: number; done: boolean }> = {
      A: { completed: 0, total: 0, pct: 0, done: false },
      B: { completed: 0, total: 0, pct: 0, done: false },
      C: { completed: 0, total: 0, pct: 0, done: false },
    };
    (['A', 'B', 'C'] as const).forEach((g) => {
      const mods = modulesByGroup[g];
      const completed = mods.filter((m) => statusMap[m.key]?.status === 'completed').length;
      res[g] = {
        completed,
        total: mods.length,
        pct: mods.length ? Math.round((completed / mods.length) * 100) : 0,
        done: mods.length > 0 && completed === mods.length,
      };
    });
    return res;
  }, [modulesByGroup, statusMap]);

  const isGroupUnlocked = useCallback(
    (g: ModuleGroup) => {
      if (g === 'A') return true;
      if (g === 'B') return groupProgress.A.done;
      return groupProgress.B.done;
    },
    [groupProgress],
  );

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
          <SettingsCard
            key={group}
            title={GROUP_LABEL[group]}
            description={GROUP_HINT[group]}
            icon={GROUP_ICON[group]}
          >
            <GroupTimeline
              modules={modulesByGroup[group]}
              statusMap={statusMap}
              groupUnlocked={isGroupUnlocked(group)}
              progress={groupProgress[group]}
              maxSize={maxGroupSize}
              onImport={openImporter}
              onUnlock={requestUnlock}
            />
          </SettingsCard>
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
// GroupTimeline — horizontal timeline com avatars redondos
// ─────────────────────────────────────────────────────────────────────────────

interface GroupTimelineProps {
  modules: ModuleDef[];
  statusMap: StatusByKey;
  groupUnlocked: boolean;
  progress: { completed: number; total: number; pct: number; done: boolean };
  maxSize: number;
  onImport: (mod: ModuleDef) => void;
  onUnlock: (mod: ModuleDef) => void;
}

function GroupTimeline({ modules, statusMap, groupUnlocked, progress, maxSize, onImport, onUnlock }: GroupTimelineProps) {
  const spacerCount = Math.max(0, maxSize - modules.length);
  // Distribui os spacers em volta das etapas (metade à esquerda, metade à
  // direita) para que os avatares das etapas fiquem centralizados no card.
  // O avatar final de conclusão segue ancorado à direita — por isso ele fica
  // fora dessa distribuição e mantém o alinhamento vertical entre grupos.
  const leftSpacers = Math.floor(spacerCount / 2);
  const rightSpacers = spacerCount - leftSpacers;
  // Sequencial dentro do grupo: um módulo só desbloqueia depois que todos
  // anteriores (mesma ordem do catálogo) estiverem concluídos.
  let previousDone = true;

  return (
    <div className="relative overflow-x-auto overflow-y-visible pt-2 pb-2 -mx-2 px-3">
      <div className="relative flex items-start gap-6 min-w-max">
        {/* connecting line */}
        <div
          className="absolute top-7 left-10 right-10 h-px bg-gradient-to-r from-gray-200 via-gray-200 to-gray-200 dark:from-gray-700 dark:via-gray-700 dark:to-gray-700"
          aria-hidden
        />
        {/* Spacers à esquerda — centralizam as etapas quando o grupo tem menos
            módulos que o maior grupo. */}
        {Array.from({ length: leftSpacers }).map((_, i) => (
          <div key={`spacer-l-${i}`} className="w-32 shrink-0" aria-hidden />
        ))}
        {modules.map((mod) => {
          const completed = statusMap[mod.key]?.status === 'completed';
          const locked = !groupUnlocked || !previousDone;
          const node = (
            <TimelineNode
              key={mod.key}
              mod={mod}
              row={statusMap[mod.key]}
              locked={locked}
              onImport={() => onImport(mod)}
              onUnlock={() => onUnlock(mod)}
            />
          );
          if (!completed) previousDone = false;
          return node;
        })}
        {/* Spacers à direita — completam a centralização antes do avatar final. */}
        {Array.from({ length: rightSpacers }).map((_, i) => (
          <div key={`spacer-r-${i}`} className="w-32 shrink-0" aria-hidden />
        ))}
        {/* Avatar final do grupo — porcentagem / check. Mantém coluna fixa à
            direita, alinhado verticalmente entre os três grupos. */}
        <GroupFinishAvatar progress={progress} />
      </div>
    </div>
  );
}

function GroupFinishAvatar({ progress }: { progress: { pct: number; done: boolean; completed: number; total: number } }) {
  const { pct, done, completed, total } = progress;
  return (
    <div className="flex flex-col items-center w-28 shrink-0 text-center">
      <div className="relative">
        <div
          className={`flex items-center justify-center w-14 h-14 rounded-full ring-2 transition-all ${
            done
              ? 'bg-emerald-500 text-white ring-emerald-300 dark:ring-emerald-700'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 ring-gray-200 dark:ring-gray-600'
          }`}
        >
          {done ? (
            <CheckCircle2 className="w-7 h-7" />
          ) : (
            <span className="text-xs font-bold tabular-nums">{pct}%</span>
          )}
        </div>
      </div>
      <div className="mt-3 w-full">
        <p className={`text-xs font-semibold ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {done ? 'Concluído' : 'Em progresso'}
        </p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
          {completed} / {total} módulos
        </p>
      </div>
    </div>
  );
}

interface TimelineNodeProps {
  mod: ModuleDef;
  row: ModuleImportRow | undefined;
  locked: boolean;
  onImport: () => void;
  onUnlock: () => void;
}

function TimelineNode({ mod, row, locked, onImport, onUnlock }: TimelineNodeProps) {
  const Icon = mod.icon;
  const status = row?.status ?? 'available';
  const completed = status === 'completed';
  const unimplemented = !mod.importPath;
  const clickable = completed || (!unimplemented && !locked);

  const records = row?.records_imported ?? 0;
  const completedDate = row?.completed_at
    ? new Date(row.completed_at).toLocaleDateString('pt-BR')
    : null;

  const handleClick = () => {
    if (unimplemented || locked) return;
    if (completed) onUnlock();
    else onImport();
  };

  const avatarClass = completed
    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800'
    : locked || unimplemented
      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 ring-gray-200 dark:ring-gray-700'
      : 'bg-white dark:bg-gray-800 text-brand-primary dark:text-brand-secondary ring-gray-200 dark:ring-gray-700 group-hover:ring-brand-primary dark:group-hover:ring-brand-secondary';

  // Status dot: verde disponível, verde+check concluído, cinza bloqueado, vermelho em breve.
  const dotClass = unimplemented
    ? 'bg-red-500'
    : locked && !completed
      ? 'bg-gray-300 dark:bg-gray-500'
      : 'bg-emerald-500';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!clickable}
      className={`group relative flex flex-col items-center w-32 shrink-0 text-center outline-none ${
        clickable ? 'cursor-pointer' : 'cursor-not-allowed'
      } ${locked && !completed ? 'opacity-70' : ''}`}
      title={
        unimplemented ? 'Em breve'
        : locked && !completed ? 'Indisponível — conclua as etapas anteriores'
        : completed ? 'Reabrir importação'
        : 'Iniciar importação'
      }
    >
      {/* Avatar */}
      <div className="relative">
        <div
          className={`flex items-center justify-center w-14 h-14 rounded-full ring-2 transition-all ${avatarClass}`}
        >
          <Icon className="w-6 h-6" />
        </div>
        {/* status dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full ring-2 ring-white dark:ring-gray-800 ${dotClass}`}
          aria-label={unimplemented ? 'Indisponível' : 'Disponível'}
        >
          {completed && <CheckCircle2 className="w-3 h-3 text-white" />}
        </span>
      </div>

      {/* Label */}
      <div className="mt-3 w-full">
        <p className={`text-xs font-semibold truncate ${
          unimplemented
            ? 'text-gray-400 dark:text-gray-500'
            : 'text-gray-900 dark:text-white'
        }`}>
          {mod.label}
        </p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-tight">
          {mod.description}
        </p>

        {completed && (
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1.5 font-medium">
            {records.toLocaleString('pt-BR')} reg.
            {completedDate ? ` · ${completedDate}` : ''}
          </p>
        )}
        {row?.unlocked_at && !completed && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 inline-flex items-center gap-0.5">
            <Unlock className="w-2.5 h-2.5" /> Reaberto
          </p>
        )}
        {unimplemented && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 italic">
            Em breve
          </p>
        )}
        {locked && !completed && !unimplemented && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 italic">
            Aguardando etapa anterior
          </p>
        )}
      </div>
    </button>
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

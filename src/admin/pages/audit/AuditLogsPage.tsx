import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  FileSearch, Loader2, ChevronLeft, ChevronRight, Search, X, Clock, User,
} from 'lucide-react';

// ── Types ──

interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  module: string | null;
  record_id: string | null;
  description: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ── Constants ──

const PAGE_SIZE = 25;

const ACTION_COLORS: Record<string, string> = {
  create:        'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  update:        'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  delete:        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  status_change: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  login:         'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  logout:        'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  export:        'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Criação',
  update: 'Edição',
  delete: 'Exclusão',
  status_change: 'Mudança de Status',
  login: 'Login',
  logout: 'Logout',
  export: 'Exportação',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  coordinator: 'Coordenador',
  teacher: 'Professor',
  user: 'Usuário',
};

// ── Component ──

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Available modules and actions for filters
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);

  // Fetch filter options
  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('module')
      .not('module', 'is', null)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((d) => d.module).filter(Boolean))] as string[];
          setAvailableModules(unique.sort());
        }
      });
    supabase
      .from('audit_logs')
      .select('action')
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((d) => d.action))] as string[];
          setAvailableActions(unique.sort());
        }
      });
  }, []);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.or(`user_name.ilike.%${search}%,description.ilike.%${search}%,record_id.ilike.%${search}%`);
    }
    if (filterModule) query = query.eq('module', filterModule);
    if (filterAction) query = query.eq('action', filterAction);

    const { data, count, error } = await query;

    if (!error && data) {
      setLogs(data as AuditLog[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [page, search, filterModule, filterAction]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function clearFilters() {
    setSearch('');
    setFilterModule('');
    setFilterAction('');
    setPage(0);
  }

  const hasFilters = search || filterModule || filterAction;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#003876] rounded-xl flex items-center justify-center">
          <FileSearch className="w-5 h-5 text-[#ffd700]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">Logs de Auditoria</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalCount.toLocaleString('pt-BR')} registro{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, descrição ou ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none text-sm"
          />
        </div>

        <select
          value={filterModule}
          onChange={(e) => { setFilterModule(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm outline-none"
        >
          <option value="">Todos os módulos</option>
          {availableModules.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm outline-none"
        >
          <option value="">Todas as ações</option>
          {availableActions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#003876] animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <FileSearch className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          {logs.map((log) => (
            <div key={log.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
              <button
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors text-left"
              >
                {/* Action badge */}
                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${
                  ACTION_COLORS[log.action] || 'bg-gray-100 dark:bg-gray-700 text-gray-600'
                }`}>
                  {ACTION_LABELS[log.action] || log.action}
                </span>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                    {log.description || `${log.action} em ${log.module || '—'}`}
                  </p>
                  {log.module && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Módulo: {log.module}
                      {log.record_id && <> · ID: {log.record_id.slice(0, 8)}...</>}
                    </p>
                  )}
                </div>

                {/* User */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {log.user_name || 'Sistema'}
                  </span>
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-400 tabular-nums">
                    {formatDate(log.created_at)}
                  </span>
                </div>
              </button>

              {/* Expanded details */}
              {expandedId === log.id && (
                <div className="px-5 pb-4 pt-1 bg-gray-50/50 dark:bg-gray-900/30 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block">Usuário</span>
                      <span className="text-gray-700 dark:text-gray-200">{log.user_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Cargo</span>
                      <span className="text-gray-700 dark:text-gray-200">{ROLE_LABELS[log.user_role || ''] || log.user_role || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">IP</span>
                      <span className="text-gray-700 dark:text-gray-200 font-mono">{log.ip_address || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Record ID</span>
                      <span className="text-gray-700 dark:text-gray-200 font-mono text-[11px]">{log.record_id || '—'}</span>
                    </div>
                  </div>

                  {(log.old_data || log.new_data) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {log.old_data && (
                        <div>
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Antes</span>
                          <pre className="mt-1 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg text-[11px] text-gray-600 dark:text-gray-300 overflow-auto max-h-40 font-mono">
                            {JSON.stringify(log.old_data, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.new_data && (
                        <div>
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Depois</span>
                          <pre className="mt-1 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg text-[11px] text-gray-600 dark:text-gray-300 overflow-auto max-h-40 font-mono">
                            {JSON.stringify(log.new_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {log.user_agent && (
                    <div>
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">User Agent</span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-mono truncate">{log.user_agent}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import {
  Search, Loader2, ShieldCheck, Plus, UserCircle2, Filter,
} from 'lucide-react';
import PermissionGate from '../../components/PermissionGate';
import { useStaff, type Staff, type EmploymentType } from '../../hooks/useStaff';
import ColaboradorDrawer from './drawers/ColaboradorDrawer';

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  clt: 'CLT',
  pj: 'PJ',
  estagio: 'Estágio',
  terceirizado: 'Terceirizado',
};

const EMPLOYMENT_COLORS: Record<EmploymentType, string> = {
  clt:          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  pj:           'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  estagio:      'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  terceirizado: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
};

type StatusFilter = 'all' | 'active' | 'inactive';
type AccessFilter = 'all' | 'with' | 'without';

export default function ColaboradoresPage() {
  const { rows, loading, error, reload } = useStaff();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [access, setAccess] = useState<AccessFilter>('all');
  const [selected, setSelected] = useState<Staff | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === 'active'   && !r.is_active) return false;
      if (status === 'inactive' &&  r.is_active) return false;
      if (access === 'with'    && !r.profile_id) return false;
      if (access === 'without' &&  r.profile_id) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.position ?? '').toLowerCase().includes(q) ||
        (r.department ?? '').toLowerCase().includes(q) ||
        (r.cpf ?? '').includes(q)
      );
    });
  }, [rows, search, status, access]);

  function openNew() {
    setSelected(null);
    setDrawerOpen(true);
  }
  function openEdit(staff: Staff) {
    setSelected(staff);
    setDrawerOpen(true);
  }

  const totalComAcesso = rows.filter((r) => !!r.profile_id).length;

  return (
    <div className="space-y-4">
      {/* Header — titulo/subtitulo vivem na barra de titulo da aba (RhPage).
          Aqui mantemos so o resumo contextual e o CTA. */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          {totalComAcesso > 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {totalComAcesso} com acesso ao sistema.
            </p>
          )}
        </div>
        <PermissionGate moduleKey="rh-colaboradores" action="create">
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo colaborador
          </button>
        </PermissionGate>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, cargo, CPF…"
            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
          />
        </div>

        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-1">
          {[
            { k: 'active' as const,   label: 'Ativos' },
            { k: 'inactive' as const, label: 'Inativos' },
            { k: 'all' as const,      label: 'Todos' },
          ].map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setStatus(k)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                status === k
                  ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-1">
          <Filter className="w-3 h-3 text-gray-400 mx-1" />
          {[
            { k: 'all' as const,     label: 'Acesso: todos' },
            { k: 'with' as const,    label: 'Com acesso' },
            { k: 'without' as const, label: 'Sem acesso' },
          ].map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setAccess(k)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                access === k
                  ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Carregando colaboradores…
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-500 dark:text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <UserCircle2 className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {rows.length === 0
                ? 'Nenhum colaborador cadastrado. Clique em "Novo colaborador" para começar.'
                : 'Nenhum colaborador com os filtros atuais.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Departamento</th>
                  <th className="px-4 py-3">Vínculo</th>
                  <th className="px-4 py-3">Admissão</th>
                  <th className="px-4 py-3">Acesso</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => openEdit(s)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 dark:text-gray-100">{s.full_name}</div>
                      {s.email && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{s.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{s.position}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.department ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${EMPLOYMENT_COLORS[s.employment_type]}`}>
                        {EMPLOYMENT_LABELS[s.employment_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {s.hire_date ? new Date(s.hire_date).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {s.profile_id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold uppercase tracking-wide">
                          <ShieldCheck className="w-3 h-3" /> Ativo
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.is_active ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold uppercase tracking-wide">
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px] font-semibold uppercase tracking-wide">
                          Inativo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ColaboradorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        staff={selected}
        onSaved={reload}
      />
    </div>
  );
}

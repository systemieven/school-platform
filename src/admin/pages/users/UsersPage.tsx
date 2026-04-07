import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Profile } from '../../types/admin.types';
import { ROLE_LABELS } from '../../types/admin.types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { Users, Search, Plus, Loader2, ShieldCheck, UserCheck } from 'lucide-react';

export default function UsersPage() {
  const { profile: _currentUser } = useAdminAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setProfiles(data as Profile[]);
    setLoading(false);
  }

  const filtered = profiles.filter((p) =>
    (p.full_name || '').toLowerCase().includes(search.toLowerCase()),
  );

  const ROLE_COLORS: Record<string, string> = {
    super_admin: 'bg-red-100 text-red-700',
    admin: 'bg-blue-100 text-blue-700',
    coordinator: 'bg-purple-100 text-purple-700',
    teacher: 'bg-emerald-100 text-emerald-700',
    student: 'bg-amber-100 text-amber-700',
    user: 'bg-gray-100 text-gray-700',
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] flex items-center gap-3">
            <Users className="w-8 h-8" />
            Usuários
          </h1>
          <p className="text-gray-500 mt-1">Gerencie os usuários do sistema.</p>
        </div>

        {/* Add user — placeholder */}
        <button
          disabled
          className="inline-flex items-center gap-2 bg-[#003876] text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-[#002855] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Disponível em breve"
        >
          <Plus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#003876] focus:ring-2 focus:ring-[#003876]/20 outline-none transition-all text-sm"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-5 font-semibold text-gray-600">Usuário</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600">Função</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600">Status</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#003876]/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[#003876]">
                            {p.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{p.full_name || '—'}</p>
                          <p className="text-xs text-gray-400">{p.id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[p.role] || ROLE_COLORS.user}`}
                      >
                        {['super_admin', 'admin'].includes(p.role) ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        {ROLE_LABELS[p.role]}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-500 text-xs font-medium">
                          <span className="w-2 h-2 bg-red-400 rounded-full" />
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-gray-500">
                      {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

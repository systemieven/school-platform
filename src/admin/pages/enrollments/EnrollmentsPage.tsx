import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Enrollment, EnrollmentStatus } from '../../types/admin.types';
import {
  GraduationCap, Search, X, ChevronRight, Loader2, RefreshCw,
  User, Phone, MapPin, Calendar, FileText, CheckCircle2, Ban,
  Clock, AlertCircle, ChevronDown,
} from 'lucide-react';

// ── Pipeline config ──────────────────────────────────────────────────────────
const PIPELINE: { key: EnrollmentStatus; label: string; color: string; dot: string; bg: string }[] = [
  { key: 'new',                  label: 'Novo',                color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',       dot: 'bg-blue-500',    bg: 'border-blue-200 dark:border-blue-800' },
  { key: 'under_review',         label: 'Em análise',          color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400', dot: 'bg-purple-500',  bg: 'border-purple-200 dark:border-purple-800' },
  { key: 'docs_pending',         label: 'Docs. Pendentes',     color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',    dot: 'bg-amber-400',   bg: 'border-amber-200 dark:border-amber-800' },
  { key: 'docs_received',        label: 'Docs. Recebidos',     color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',       dot: 'bg-cyan-500',    bg: 'border-cyan-200 dark:border-cyan-800' },
  { key: 'interview_scheduled',  label: 'Entrevista agendada', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500',  bg: 'border-indigo-200 dark:border-indigo-800' },
  { key: 'approved',             label: 'Aprovado',            color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', bg: 'border-emerald-200 dark:border-emerald-800' },
  { key: 'confirmed',            label: 'Matrícula confirmada',color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',    dot: 'bg-green-600',   bg: 'border-green-200 dark:border-green-800' },
  { key: 'archived',             label: 'Arquivado',           color: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',          dot: 'bg-gray-400',    bg: 'border-gray-200 dark:border-gray-600' },
];

const ORIGIN_LABELS: Record<string, string> = {
  website: 'Site', in_person: 'Presencial', phone: 'Telefone', referral: 'Indicação',
};

function age(birthDate: string) {
  const d = new Date(birthDate + 'T00:00:00');
  const today = new Date();
  let a = today.getFullYear() - d.getFullYear();
  if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) a--;
  return a;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Drawer ───────────────────────────────────────────────────────────────────
interface DrawerProps {
  enrollment: Enrollment | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Enrollment>) => void;
}

function EnrollmentDrawer({ enrollment: enr, onClose, onUpdate }: DrawerProps) {
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState<EnrollmentStatus | ''>('');
  const [archiveReason, setArchiveReason] = useState('');
  const [section, setSection] = useState<'guardian' | 'student' | 'parents'>('guardian');

  useEffect(() => {
    if (enr) {
      setNotes(enr.internal_notes || '');
      setNewStatus('');
      setArchiveReason('');
    }
  }, [enr]);

  if (!enr) return null;

  const currentPipeline = PIPELINE.find((p) => p.key === enr.status) || PIPELINE[0];

  async function changeStatus() {
    if (!newStatus) return;
    setSaving(true);
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'confirmed') {
      patch.confirmed_at = new Date().toISOString();
    }
    if (newStatus === 'archived') {
      if (!archiveReason.trim()) { setSaving(false); return; }
      patch.archive_reason = archiveReason;
      patch.archived_at = new Date().toISOString();
    }
    const { error } = await supabase.from('enrollments').update(patch).eq('id', enr.id);
    if (!error) onUpdate(enr.id, patch as Partial<Enrollment>);
    setSaving(false);
    setNewStatus('');
  }

  async function saveNotes() {
    setSaving(true);
    const { error } = await supabase.from('enrollments').update({ internal_notes: notes }).eq('id', enr.id);
    if (!error) onUpdate(enr.id, { internal_notes: notes });
    setSaving(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#003876]/10 dark:bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-[#003876] dark:text-[#ffd700]">
                {enr.student_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{enr.student_name}</p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${currentPipeline.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${currentPipeline.dot}`} />
                  {currentPipeline.label}
                </span>
                {enr.enrollment_number && (
                  <span className="text-xs text-gray-400">#{enr.enrollment_number}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ml-2 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Criado', value: formatDate(enr.created_at) },
              { label: 'Origem', value: ORIGIN_LABELS[enr.origin] || enr.origin },
              { label: 'Idade', value: `${age(enr.student_birth_date)} anos` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{value}</p>
              </div>
            ))}
          </div>

          {/* Section tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
            {([['guardian', 'Responsável'], ['student', 'Aluno'], ['parents', 'Pais']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  section === key
                    ? 'bg-white dark:bg-gray-700 text-[#003876] dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Guardian */}
          {section === 'guardian' && (
            <div className="space-y-2">
              {[
                { label: 'Nome', value: enr.guardian_name, icon: User },
                { label: 'CPF', value: enr.guardian_cpf, icon: FileText },
                { label: 'Telefone', value: enr.guardian_phone, icon: Phone },
                { label: 'E-mail', value: enr.guardian_email || '—', icon: FileText },
                { label: 'Endereço', value: `${enr.guardian_street}, ${enr.guardian_number}${enr.guardian_complement ? `, ${enr.guardian_complement}` : ''} — ${enr.guardian_neighborhood}, ${enr.guardian_city}/${enr.guardian_state}`, icon: MapPin },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex gap-3 py-2 border-b border-gray-100 dark:border-gray-800">
                  <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Student */}
          {section === 'student' && (
            <div className="space-y-2">
              {[
                { label: 'Nome', value: enr.student_name },
                { label: 'Nascimento', value: `${formatDate(enr.student_birth_date)} (${age(enr.student_birth_date)} anos)` },
                { label: 'CPF', value: enr.student_cpf || '—' },
                { label: 'Primeira escola', value: enr.first_school ? 'Sim' : 'Não' },
                { label: 'Última série', value: enr.last_grade || '—' },
                { label: 'Escola anterior', value: enr.previous_school_name || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col py-2 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Parents */}
          {section === 'parents' && (
            <div className="space-y-4">
              {[
                { title: 'Pai', name: enr.father_name, cpf: enr.father_cpf, phone: enr.father_phone, email: enr.father_email },
                { title: 'Mãe', name: enr.mother_name, cpf: enr.mother_cpf, phone: enr.mother_phone, email: enr.mother_email },
              ].map(({ title, name, cpf, phone, email }) => (
                <div key={title} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{name || '—'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">CPF: {cpf || '—'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tel: {phone || '—'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">E-mail: {email || '—'}</p>
                </div>
              ))}
            </div>
          )}

          {/* Internal notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Notas internas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas visíveis apenas para a equipe..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={saveNotes}
                disabled={saving || notes === (enr.internal_notes || '')}
                className="text-xs px-3 py-1.5 bg-[#003876] text-white rounded-lg disabled:opacity-40 hover:bg-[#002855] transition-colors"
              >
                {saving ? 'Salvando…' : 'Salvar notas'}
              </button>
            </div>
          </div>

          {/* Status change */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Alterar status</label>
            <div className="relative">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as EnrollmentStatus)}
                className="w-full px-3 py-2.5 pr-9 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none appearance-none"
              >
                <option value="">Selecione o novo status...</option>
                {PIPELINE.filter((p) => p.key !== enr.status).map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {newStatus === 'archived' && (
              <textarea
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                rows={2}
                placeholder="Motivo do arquivamento (obrigatório)..."
                className="mt-2 w-full px-3 py-2 text-sm rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 outline-none resize-none"
              />
            )}

            {newStatus && (
              <button
                onClick={changeStatus}
                disabled={saving || (newStatus === 'archived' && !archiveReason.trim())}
                className="mt-2 w-full py-2.5 bg-[#003876] hover:bg-[#002855] text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
              >
                {saving ? 'Salvando…' : `Mover para "${PIPELINE.find((p) => p.key === newStatus)?.label}"`}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | 'all'>('all');
  const [selected, setSelected] = useState<Enrollment | null>(null);

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    setLoading(true);
    const { data, error } = await supabase
      .from('enrollments')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setEnrollments(data as Enrollment[]);
    setLoading(false);
  }

  function handleUpdate(id: string, patch: Partial<Enrollment>) {
    setEnrollments((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }

  const filtered = useMemo(() => enrollments.filter((e) => {
    const matchSearch =
      search === '' ||
      e.student_name.toLowerCase().includes(search.toLowerCase()) ||
      e.guardian_name.toLowerCase().includes(search.toLowerCase()) ||
      e.guardian_phone.includes(search);
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchStatus;
  }), [enrollments, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: enrollments.length };
    for (const p of PIPELINE) c[p.key] = enrollments.filter((e) => e.status === p.key).length;
    return c;
  }, [enrollments]);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#003876] dark:text-white flex items-center gap-3">
            <GraduationCap className="w-8 h-8" />
            Pré-Matrículas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Gerencie o pipeline de matrículas.</p>
        </div>
        <button
          onClick={fetch}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#003876] dark:hover:text-white border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Pipeline filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            statusFilter === 'all' ? 'bg-[#003876] text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-[#003876]'
          }`}
        >
          Todos <span className="opacity-70">{counts.all}</span>
        </button>
        {PIPELINE.map((p) => (
          counts[p.key] > 0 || statusFilter === p.key ? (
            <button
              key={p.key}
              onClick={() => setStatusFilter(p.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === p.key
                  ? 'bg-[#003876] text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-[#003876]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
              {p.label}
              <span className="opacity-70">{counts[p.key]}</span>
            </button>
          ) : null
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:border-[#003876] dark:focus:border-[#ffd700] focus:ring-2 focus:ring-[#003876]/20 outline-none text-sm"
        />
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-4 h-4" /></button>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#003876] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-500 text-sm">Nenhuma pré-matrícula encontrada.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Aluno / Responsável</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden md:table-cell">Contato</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400 hidden lg:table-cell">Data</th>
                  <th className="text-left py-3 px-5 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  <th className="py-3 px-5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((enr) => {
                  const p = PIPELINE.find((s) => s.key === enr.status) || PIPELINE[0];
                  return (
                    <tr
                      key={enr.id}
                      onClick={() => setSelected(enr)}
                      className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50/60 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-5">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{enr.student_name}</p>
                        <p className="text-xs text-gray-400">{enr.guardian_name}</p>
                      </td>
                      <td className="py-3 px-5 hidden md:table-cell text-gray-600 dark:text-gray-400">
                        {enr.guardian_phone}
                      </td>
                      <td className="py-3 px-5 hidden lg:table-cell text-gray-500 dark:text-gray-400 text-xs">
                        {formatDate(enr.created_at)}
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${p.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                          {p.label}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {selected && (
        <EnrollmentDrawer
          enrollment={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}

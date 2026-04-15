/**
 * StudentDetailPage — Ficha completa do aluno
 *
 * Acessível via /admin/alunos/:studentId
 * Botão "Ver Ficha" (FileText) em cada linha da StudentsPage navega até aqui.
 *
 * Seções:
 *  - Header: foto 3×4, nome, matrícula, turma, status, ações (editar foto, imprimir)
 *  - Tab rail interna: Resumo | Acadêmico | Financeiro | Documentos | Observações
 *
 * Impressão: window.print() com @media print esconde o rail e exibe todas as
 * seções linearmente — sem dependência de biblioteca de PDF.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Student, SchoolClass, SchoolSegment } from '../../types/admin.types';
import {
  ArrowLeft, Camera, Printer, Loader2, GraduationCap, Users, Phone,
  Mail, Calendar, MapPin, FileText, BookOpen, BarChart2, DollarSign,
  Paperclip, MessageSquare, AlertCircle, CheckCircle, Clock, XCircle, Check,
} from 'lucide-react';
import ImageCropModal from '../../components/ImageCropModal';

// ── Types ──────────────────────────────────────────────────────────────────────

interface FinancialInstallment {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'negotiated' | 'cancelled' | 'renegotiated';
  paid_at: string | null;
  payment_method: string | null;
}

interface StudentResult {
  id: string;
  discipline_id: string;
  discipline_label: string;
  period1_avg: number | null;
  period2_avg: number | null;
  period3_avg: number | null;
  period4_avg: number | null;
  recovery_grade: number | null;
  final_avg: number | null;
  attendance_pct: number | null;
  result: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  inactive:    'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  transferred: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  graduated:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo', inactive: 'Inativo', transferred: 'Transferido', graduated: 'Formado',
};

const INSTALLMENT_COLORS: Record<string, string> = {
  paid:        'text-emerald-600 dark:text-emerald-400',
  overdue:     'text-red-600 dark:text-red-400',
  pending:     'text-amber-600 dark:text-amber-400',
  negotiated:  'text-blue-600 dark:text-blue-400',
  cancelled:   'text-gray-400',
  renegotiated:'text-purple-600 dark:text-purple-400',
};
const INSTALLMENT_ICONS: Record<string, React.ComponentType<{className?: string}>> = {
  paid: CheckCircle, overdue: AlertCircle, pending: Clock,
  negotiated: CheckCircle, cancelled: XCircle, renegotiated: CheckCircle,
};
const INSTALLMENT_LABELS: Record<string, string> = {
  paid: 'Pago', overdue: 'Em atraso', pending: 'Pendente',
  negotiated: 'Negociado', cancelled: 'Cancelado', renegotiated: 'Renegociado',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}
function fmtCurrency(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtGrade(n: number | null) {
  if (n == null) return '—';
  return n.toFixed(1);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{className?: string}>; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{className?: string}>; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30">
        <Icon className="w-4 h-4 text-brand-primary dark:text-brand-secondary" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'resumo',      label: 'Resumo',      icon: GraduationCap },
  { key: 'academico',   label: 'Acadêmico',   icon: BookOpen       },
  { key: 'financeiro',  label: 'Financeiro',  icon: DollarSign     },
  { key: 'documentos',  label: 'Documentos',  icon: Paperclip      },
  { key: 'observacoes', label: 'Observações', icon: MessageSquare  },
] as const;
type TabKey = typeof TABS[number]['key'];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<Student | null>(null);
  const [classData, setClassData] = useState<SchoolClass | null>(null);
  const [segment, setSegment] = useState<SchoolSegment | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [installments, setInstallments] = useState<FinancialInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('resumo');

  // Photo editing
  const [cropPhotoSrc, setCropPhotoSrc] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    const [studentRes, resultsRes, installmentsRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId).single(),
      supabase
        .from('student_results')
        .select('id, discipline_id, period1_avg, period2_avg, period3_avg, period4_avg, recovery_grade, final_avg, attendance_pct, result')
        .eq('student_id', studentId)
        .eq('school_year', new Date().getFullYear()),
      supabase
        .from('financial_installments')
        .select('id, installment_number, due_date, amount, status, paid_at, payment_method')
        .eq('student_id', studentId)
        .order('due_date', { ascending: false })
        .limit(12),
    ]);

    const s = studentRes.data as Student | null;
    setStudent(s);

    if (s?.class_id) {
      const { data: cls } = await supabase.from('school_classes').select('*').eq('id', s.class_id).single();
      setClassData(cls as SchoolClass);
      if (cls?.segment_id) {
        const { data: seg } = await supabase.from('school_segments').select('*').eq('id', cls.segment_id).single();
        setSegment(seg as SchoolSegment);
      }
    }

    // Enrich results with discipline labels
    const rawResults = (resultsRes.data ?? []) as Omit<StudentResult, 'discipline_label'>[];
    if (rawResults.length > 0) {
      const discIds = [...new Set(rawResults.map((r) => r.discipline_id))];
      const { data: discs } = await supabase
        .from('disciplines')
        .select('id, name')
        .in('id', discIds);
      const discMap = new Map((discs ?? []).map((d: {id: string; name: string}) => [d.id, d.name]));
      setResults(rawResults.map((r) => ({ ...r, discipline_label: discMap.get(r.discipline_id) ?? r.discipline_id })));
    }

    setInstallments((installmentsRes.data ?? []) as FinancialInstallment[]);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  // ── Photo upload ──────────────────────────────────────────────────────────

  async function handlePhotoSave(dataUrl: string) {
    setCropPhotoSrc(null);
    if (!student) return;
    setUploadingPhoto(true);
    try {
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const path = `${student.id}/photo.jpg`;
      await supabase.storage.from('student-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(path);
      const photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('students').update({ photo_url: photoUrl }).eq('id', student.id);
      setStudent((prev) => prev ? { ...prev, photo_url: photoUrl } : prev);
      setPhotoSaved(true);
      setTimeout(() => setPhotoSaved(false), 2000);
    } finally {
      setUploadingPhoto(false);
    }
  }

  // ── Loading / not found ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }
  if (!student) {
    return (
      <div className="p-8 text-center text-gray-400">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" />
        <p>Aluno não encontrado.</p>
        <button onClick={() => navigate('/admin/alunos')} className="mt-4 text-brand-primary text-sm hover:underline">
          Voltar para a lista
        </button>
      </div>
    );
  }

  const pendingInstallments = installments.filter((i) => i.status === 'pending' || i.status === 'overdue');
  const overdueInstallments = installments.filter((i) => i.status === 'overdue');
  const avgAttendance = results.length > 0
    ? (results.reduce((s, r) => s + (r.attendance_pct ?? 100), 0) / results.length).toFixed(0)
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 print:space-y-4">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 print:border-0 print:p-0">
        <div className="flex items-start gap-6">

          {/* Photo */}
          <div className="relative flex-shrink-0 group print:block">
            <div className="w-24 h-32 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
              {student.photo_url ? (
                <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500">
                  <Camera className="w-7 h-7" />
                  <span className="text-[10px]">Sem foto</span>
                </div>
              )}
            </div>
            {/* Upload overlay */}
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 print:hidden"
              title="Trocar foto"
            >
              {uploadingPhoto ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : photoSaved ? (
                <Check className="w-5 h-5 text-white" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setCropPhotoSrc(reader.result as string);
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{student.full_name}</h1>
                <p className="text-sm text-gray-400 mt-0.5 font-mono">{student.enrollment_number}</p>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir ficha
                </button>
                <button
                  onClick={() => navigate('/admin/alunos')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-4">
              <InfoRow icon={GraduationCap} label="Segmento" value={segment?.name} />
              <InfoRow icon={BookOpen} label="Turma" value={classData?.name} />
              <InfoRow icon={Calendar} label="Nascimento" value={fmtDate(student.birth_date)} />
              <InfoRow icon={Users} label="Responsável" value={student.guardian_name} />
              <InfoRow icon={Phone} label="Telefone" value={student.guardian_phone} />
            </div>

            <div className="mt-3">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[student.status] ?? STATUS_COLORS.inactive}`}>
                {STATUS_LABELS[student.status] ?? student.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
        {[
          { label: 'Disciplinas', value: results.length || '—', icon: BookOpen, color: 'text-brand-primary' },
          { label: 'Frequência média', value: avgAttendance ? `${avgAttendance}%` : '—', icon: BarChart2, color: avgAttendance && Number(avgAttendance) < 75 ? 'text-red-500' : 'text-emerald-500' },
          { label: 'Parcelas em aberto', value: pendingInstallments.length || '0', icon: DollarSign, color: overdueInstallments.length > 0 ? 'text-red-500' : 'text-amber-500' },
          { label: 'Documentos', value: student.document_urls?.length || '0', icon: Paperclip, color: 'text-gray-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
            <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
            <div>
              <p className="text-[11px] text-gray-400">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{String(value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab rail (hidden on print) ── */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-1.5 print:hidden">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === key
                ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/15'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-brand-primary dark:hover:text-white'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${activeTab === key ? 'text-brand-secondary' : ''}`} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="space-y-4 print:space-y-4">

        {/* RESUMO */}
        {(activeTab === 'resumo') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SectionCard title="Dados do Aluno" icon={GraduationCap}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={GraduationCap} label="Nome" value={student.full_name} />
                <InfoRow icon={FileText} label="CPF" value={student.cpf} />
                <InfoRow icon={Calendar} label="Nascimento" value={fmtDate(student.birth_date)} />
                <InfoRow icon={Calendar} label="Matriculado em" value={fmtDate(student.enrolled_at)} />
                <InfoRow icon={MapPin} label="Endereço"
                  value={student.student_street ? `${student.student_street}${student.student_number ? ', ' + student.student_number : ''} — ${student.student_city}/${student.student_state}` : null}
                />
              </div>
            </SectionCard>

            <SectionCard title="Responsável" icon={Users}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={Users} label="Nome" value={student.guardian_name} />
                <InfoRow icon={FileText} label="CPF" value={student.guardian_cpf} />
                <InfoRow icon={Phone} label="Telefone" value={student.guardian_phone} />
                <InfoRow icon={Mail} label="E-mail" value={student.guardian_email} />
                <InfoRow icon={MapPin} label="Endereço"
                  value={student.guardian_street ? `${student.guardian_street}${student.guardian_number ? ', ' + student.guardian_number : ''} — ${student.guardian_city}/${student.guardian_state}` : null}
                />
              </div>
            </SectionCard>

            {(student.father_name || student.mother_name) && (
              <SectionCard title="Filiação" icon={Users}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {student.father_name && <>
                    <InfoRow icon={Users} label="Pai" value={student.father_name} />
                    <InfoRow icon={Phone} label="Telefone do pai" value={student.father_phone} />
                  </>}
                  {student.mother_name && <>
                    <InfoRow icon={Users} label="Mãe" value={student.mother_name} />
                    <InfoRow icon={Phone} label="Telefone da mãe" value={student.mother_phone} />
                  </>}
                </div>
              </SectionCard>
            )}

            <SectionCard title="Histórico Escolar" icon={BookOpen}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow icon={BookOpen} label="Primeira escola?" value={student.first_school ? 'Sim' : student.first_school === false ? 'Não' : null} />
                <InfoRow icon={BookOpen} label="Última série cursada" value={student.last_grade} />
                <InfoRow icon={BookOpen} label="Escola anterior" value={student.previous_school_name} />
              </div>
            </SectionCard>
          </div>
        )}

        {/* ACADÊMICO */}
        {(activeTab === 'academico') && (
          <SectionCard title="Resultados Acadêmicos" icon={BookOpen}>
            {results.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhum resultado lançado para o ano letivo atual.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left pb-2 font-semibold">Disciplina</th>
                      <th className="text-center pb-2 font-semibold">1º Bim</th>
                      <th className="text-center pb-2 font-semibold">2º Bim</th>
                      <th className="text-center pb-2 font-semibold">3º Bim</th>
                      <th className="text-center pb-2 font-semibold">4º Bim</th>
                      <th className="text-center pb-2 font-semibold">Recup.</th>
                      <th className="text-center pb-2 font-semibold">Final</th>
                      <th className="text-center pb-2 font-semibold">Freq.</th>
                      <th className="text-center pb-2 font-semibold">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {results.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-2.5 font-medium text-gray-800 dark:text-gray-200">{r.discipline_label}</td>
                        <td className="py-2.5 text-center text-gray-600 dark:text-gray-400">{fmtGrade(r.period1_avg)}</td>
                        <td className="py-2.5 text-center text-gray-600 dark:text-gray-400">{fmtGrade(r.period2_avg)}</td>
                        <td className="py-2.5 text-center text-gray-600 dark:text-gray-400">{fmtGrade(r.period3_avg)}</td>
                        <td className="py-2.5 text-center text-gray-600 dark:text-gray-400">{fmtGrade(r.period4_avg)}</td>
                        <td className="py-2.5 text-center text-gray-600 dark:text-gray-400">{fmtGrade(r.recovery_grade)}</td>
                        <td className={`py-2.5 text-center font-semibold ${r.final_avg != null && r.final_avg < 5 ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
                          {fmtGrade(r.final_avg)}
                        </td>
                        <td className={`py-2.5 text-center ${r.attendance_pct != null && r.attendance_pct < 75 ? 'text-red-500 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                          {r.attendance_pct != null ? `${r.attendance_pct}%` : '—'}
                        </td>
                        <td className="py-2.5 text-center">
                          {r.result ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              r.result === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              r.result === 'failed_grade' || r.result === 'failed_attendance' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              r.result === 'recovery' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              'bg-gray-100 text-gray-500 dark:bg-gray-700'
                            }`}>
                              {r.result === 'approved' ? 'Aprovado' : r.result === 'failed_grade' ? 'Reprovado (nota)' : r.result === 'failed_attendance' ? 'Reprovado (freq.)' : r.result === 'recovery' ? 'Recuperação' : 'Em andamento'}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {/* FINANCEIRO */}
        {(activeTab === 'financeiro') && (
          <SectionCard title="Parcelas (últimas 12)" icon={DollarSign}>
            {installments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma parcela encontrada.</p>
            ) : (
              <div className="space-y-2">
                {installments.map((inst) => {
                  const Icon = INSTALLMENT_ICONS[inst.status] ?? Clock;
                  return (
                    <div key={inst.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${INSTALLMENT_COLORS[inst.status]}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            Parcela {inst.installment_number} · vence {fmtDate(inst.due_date)}
                          </p>
                          {inst.paid_at && (
                            <p className="text-xs text-gray-400">Pago em {fmtDate(inst.paid_at)}{inst.payment_method ? ` · ${inst.payment_method}` : ''}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${INSTALLMENT_COLORS[inst.status]}`}>{fmtCurrency(inst.amount)}</p>
                        <p className={`text-[10px] ${INSTALLMENT_COLORS[inst.status]}`}>{INSTALLMENT_LABELS[inst.status]}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        )}

        {/* DOCUMENTOS */}
        {(activeTab === 'documentos') && (
          <SectionCard title="Documentos Anexados" icon={Paperclip}>
            {(!student.document_urls || student.document_urls.length === 0) ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhum documento anexado.</p>
            ) : (
              <div className="space-y-2">
                {student.document_urls.map((url, i) => {
                  const name = url.split('/').pop()?.split('?')[0] ?? `Documento ${i + 1}`;
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all"
                    >
                      <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{decodeURIComponent(name)}</span>
                      <FileText className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}
          </SectionCard>
        )}

        {/* OBSERVAÇÕES */}
        {(activeTab === 'observacoes') && (
          <SectionCard title="Observações Internas" icon={MessageSquare}>
            {student.internal_notes ? (
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{student.internal_notes}</p>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma observação registrada.</p>
            )}
          </SectionCard>
        )}

      </div>

      {/* Print: render all sections together */}
      <div className="hidden print:block space-y-4">
        <p className="text-xs text-gray-400 text-right">Gerado em {new Date().toLocaleString('pt-BR')}</p>
      </div>

      {/* ImageCropModal */}
      {cropPhotoSrc && (
        <ImageCropModal
          src={cropPhotoSrc}
          onSave={handlePhotoSave}
          onClose={() => setCropPhotoSrc(null)}
        />
      )}
    </div>
  );
}

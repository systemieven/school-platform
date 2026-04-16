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
import type {
  Student, SchoolClass, SchoolSegment,
  StudentHealthRecord, StudentMedicalCertificate, MedicationEntry, BloodType,
} from '../../types/admin.types';
import {
  ArrowLeft, Camera, Printer, Loader2, GraduationCap, Users, Phone,
  Mail, Calendar, MapPin, FileText, BookOpen, BarChart2, DollarSign,
  Paperclip, MessageSquare, AlertCircle, CheckCircle, Clock, XCircle, Check,
  HeartPulse, Plus, Pencil, X, ChevronDown, ShieldCheck, Heart, Stethoscope,
} from 'lucide-react';
import ImageCropModal from '../../components/ImageCropModal';
import { Drawer, DrawerCard } from '../../components/Drawer';

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
  { key: 'saude',       label: 'Saúde',       icon: HeartPulse     },
  { key: 'documentos',  label: 'Documentos',  icon: Paperclip      },
  { key: 'observacoes', label: 'Observações', icon: MessageSquare  },
] as const;
type TabKey = typeof TABS[number]['key'];

// ── Saúde helpers ──────────────────────────────────────────────────────────────

const BLOOD_TYPES: Array<BloodType | ''> = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ALLERGY_CATS = ['alimentar', 'medicamentosa', 'ambiental', 'outras'];

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function certStatus(validUntil: string): 'valid' | 'expiring_soon' | 'expired' {
  const today = new Date();
  const exp = new Date(validUntil);
  if (exp < today) return 'expired';
  const diff = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 30) return 'expiring_soon';
  return 'valid';
}

const CERT_STATUS_LABELS: Record<string, string> = {
  valid: 'Válido',
  expiring_soon: 'Vence em breve',
  expired: 'Vencido',
};

const CERT_STATUS_COLORS: Record<string, string> = {
  valid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  expiring_soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ── Health Record Drawer ───────────────────────────────────────────────────────

function HealthRecordDrawer({
  open,
  record,
  studentId,
  onClose,
  onSaved,
}: {
  open: boolean;
  record: StudentHealthRecord | null;
  studentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  const [bloodType, setBloodType]             = useState<BloodType | ''>('');
  const [healthPlan, setHealthPlan]           = useState('');
  const [healthPlanNumber, setHealthPlanNumber] = useState('');
  const [hasAllergies, setHasAllergies]       = useState(false);
  const [allergiesRaw, setAllergiesRaw]       = useState('');
  const [allergyNotes, setAllergyNotes]       = useState('');
  const [allergyCategories, setAllergyCategories] = useState<string[]>([]);
  const [usesMedication, setUsesMedication]   = useState(false);
  const [medications, setMedications]         = useState<MedicationEntry[]>([]);
  const [canReceiveMedication, setCanReceiveMedication] = useState(true);
  const [medicationGuidance, setMedicationGuidance]     = useState('');
  const [foodRestrictions, setFoodRestrictions]         = useState('');
  const [chronicRaw, setChronicRaw]           = useState('');
  const [hasSpecialNeeds, setHasSpecialNeeds] = useState(false);
  const [specialNeeds, setSpecialNeeds]       = useState('');
  const [learningDifficulties, setLearningDifficulties] = useState('');
  const [emergencyName, setEmergencyName]     = useState('');
  const [emergencyPhone, setEmergencyPhone]   = useState('');
  const [emergencyRel, setEmergencyRel]       = useState('');
  const [authorizedPhoto, setAuthorizedPhoto] = useState(true);
  const [authorizedFirstAid, setAuthorizedFirstAid]   = useState(true);
  const [authorizedEvacuation, setAuthorizedEvacuation] = useState(true);
  const [notes, setNotes]                     = useState('');

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30';

  useEffect(() => {
    if (!open) return;
    if (record) {
      setBloodType(record.blood_type ?? '');
      setHealthPlan(record.health_plan ?? '');
      setHealthPlanNumber(record.health_plan_number ?? '');
      setHasAllergies(record.has_allergies);
      setAllergiesRaw((record.allergies ?? []).join(', '));
      setAllergyNotes(record.allergy_notes ?? '');
      setAllergyCategories((record.allergy_categories ?? []) as string[]);
      setUsesMedication(record.uses_medication);
      setMedications(record.medications ?? []);
      setCanReceiveMedication(record.can_receive_medication ?? true);
      setMedicationGuidance(record.medication_guidance ?? '');
      setFoodRestrictions(record.food_restrictions ?? '');
      setChronicRaw((record.chronic_conditions ?? []).join(', '));
      setHasSpecialNeeds(record.has_special_needs);
      setSpecialNeeds(record.special_needs ?? '');
      setLearningDifficulties(record.learning_difficulties ?? '');
      setEmergencyName(record.emergency_contact_name ?? '');
      setEmergencyPhone(record.emergency_contact_phone ?? '');
      setEmergencyRel(record.emergency_contact_rel ?? '');
      setAuthorizedPhoto(record.authorized_photo);
      setAuthorizedFirstAid(record.authorized_first_aid);
      setAuthorizedEvacuation(record.authorized_evacuation);
      setNotes(record.notes ?? '');
    } else {
      setBloodType(''); setHealthPlan(''); setHealthPlanNumber('');
      setHasAllergies(false); setAllergiesRaw(''); setAllergyNotes('');
      setAllergyCategories([]); setUsesMedication(false); setMedications([]);
      setCanReceiveMedication(true); setMedicationGuidance('');
      setFoodRestrictions(''); setChronicRaw('');
      setHasSpecialNeeds(false); setSpecialNeeds(''); setLearningDifficulties('');
      setEmergencyName(''); setEmergencyPhone(''); setEmergencyRel('');
      setAuthorizedPhoto(true); setAuthorizedFirstAid(true); setAuthorizedEvacuation(true);
      setNotes('');
    }
    setSaved(false); setError('');
  }, [open, record]);

  function toggleAllergyCategory(cat: string) {
    setAllergyCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        student_id: studentId,
        blood_type: bloodType || null,
        health_plan: healthPlan.trim() || null,
        health_plan_number: healthPlanNumber.trim() || null,
        has_allergies: hasAllergies,
        allergies: hasAllergies ? allergiesRaw.split(',').map((v) => v.trim()).filter(Boolean) : null,
        allergy_notes: hasAllergies ? allergyNotes.trim() || null : null,
        allergy_categories: hasAllergies ? allergyCategories : [],
        uses_medication: usesMedication,
        medications: usesMedication ? medications : null,
        can_receive_medication: canReceiveMedication,
        medication_guidance: !canReceiveMedication ? medicationGuidance.trim() || null : null,
        food_restrictions: foodRestrictions.trim() || null,
        chronic_conditions: chronicRaw.split(',').map((v) => v.trim()).filter(Boolean),
        has_special_needs: hasSpecialNeeds,
        special_needs: hasSpecialNeeds ? specialNeeds.trim() || null : null,
        learning_difficulties: learningDifficulties.trim() || null,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        emergency_contact_rel: emergencyRel.trim() || null,
        authorized_photo: authorizedPhoto,
        authorized_first_aid: authorizedFirstAid,
        authorized_evacuation: authorizedEvacuation,
        notes: notes.trim() || null,
      };
      const { error: saveError } = record
        ? await supabase.from('student_health_records').update(payload).eq('id', record.id)
        : await supabase.from('student_health_records').upsert(payload, { onConflict: 'student_id' });
      if (saveError) throw saveError;
      setSaved(true);
      onSaved();
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <div className="flex gap-3">
      <button onClick={onClose} disabled={saving}
        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <HeartPulse className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar Ficha'}
      </button>
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Ficha de Saúde" icon={HeartPulse} width="w-[520px]" footer={footer}>
      <DrawerCard title="Dados Básicos" icon={Heart}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo Sanguíneo</label>
            <div className="relative">
              <select value={bloodType} onChange={(e) => setBloodType(e.target.value as BloodType | '')} className={`${inputCls} appearance-none pr-8`}>
                {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt || '— Não informado —'}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Plano de Saúde</label>
              <input value={healthPlan} onChange={(e) => setHealthPlan(e.target.value)} className={inputCls} placeholder="Nome do plano" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nº do Plano</label>
              <input value={healthPlanNumber} onChange={(e) => setHealthPlanNumber(e.target.value)} className={inputCls} placeholder="Carteirinha" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Condições Crônicas (separadas por vírgula)</label>
            <input value={chronicRaw} onChange={(e) => setChronicRaw(e.target.value)} className={inputCls} placeholder="Diabetes, Asma, Epilepsia" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Restrições Alimentares</label>
            <textarea value={foodRestrictions} onChange={(e) => setFoodRestrictions(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Ex: sem glúten, vegetariano…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Observações gerais</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Alergias" icon={Heart}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Possui alergias</span>
            <Toggle checked={hasAllergies} onChange={() => setHasAllergies(!hasAllergies)} />
          </div>
          {hasAllergies && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Categorias</label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGY_CATS.map((cat) => (
                    <button key={cat} type="button" onClick={() => toggleAllergyCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${allergyCategories.includes(cat) ? 'bg-brand-primary text-white border-brand-primary' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-primary'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Alergias (separadas por vírgula)</label>
                <input value={allergiesRaw} onChange={(e) => setAllergiesRaw(e.target.value)} className={inputCls} placeholder="Amendoim, Lactose, Penicilina" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observações sobre alergias</label>
                <textarea value={allergyNotes} onChange={(e) => setAllergyNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>
            </>
          )}
        </div>
      </DrawerCard>

      <DrawerCard title="Medicamentos" icon={Heart}
        headerExtra={usesMedication ? (
          <button onClick={() => setMedications((p) => [...p, { name: '', dose: '', frequency: '', instructions: '' }])}
            className="flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary-dark font-medium">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        ) : undefined}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Usa medicamentos de uso contínuo</span>
            <Toggle checked={usesMedication} onChange={() => setUsesMedication(!usesMedication)} />
          </div>
          {usesMedication && medications.map((med, idx) => (
            <div key={idx} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase">Medicamento {idx + 1}</span>
                <button onClick={() => setMedications((p) => p.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {(['name', 'dose', 'frequency', 'instructions'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs text-gray-400 mb-0.5">
                    {field === 'name' ? 'Nome' : field === 'dose' ? 'Dose' : field === 'frequency' ? 'Frequência' : 'Instruções'}
                  </label>
                  <input value={med[field]}
                    onChange={(e) => setMedications((p) => p.map((m, i) => i === idx ? { ...m, [field]: e.target.value } : m))}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
                </div>
              ))}
            </div>
          ))}
          <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Pode receber medicação na escola</span>
              <Toggle checked={canReceiveMedication} onChange={() => setCanReceiveMedication(!canReceiveMedication)} />
            </div>
            {!canReceiveMedication && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Orientações para não administração</label>
                <textarea value={medicationGuidance} onChange={(e) => setMedicationGuidance(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Descreva as orientações…" />
              </div>
            )}
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Necessidades Especiais" icon={Heart}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Possui necessidades especiais</span>
            <Toggle checked={hasSpecialNeeds} onChange={() => setHasSpecialNeeds(!hasSpecialNeeds)} />
          </div>
          {hasSpecialNeeds && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
              <textarea value={specialNeeds} onChange={(e) => setSpecialNeeds(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Dificuldades de Aprendizagem</label>
            <textarea value={learningDifficulties} onChange={(e) => setLearningDifficulties(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Dislexia, TDAH, etc." />
          </div>
        </div>
      </DrawerCard>

      <DrawerCard title="Contato de Emergência e Autorizações" icon={ShieldCheck}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Contato</label>
              <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className={inputCls} placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Telefone</label>
              <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className={inputCls} placeholder="(81) 99999-9999" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Parentesco</label>
              <input value={emergencyRel} onChange={(e) => setEmergencyRel(e.target.value)} className={inputCls} placeholder="Avó, Tio…" />
            </div>
          </div>
          <div className="space-y-2 pt-1">
            {([
              ['photo', 'Autoriza uso de imagem/foto', authorizedPhoto, () => setAuthorizedPhoto(!authorizedPhoto)] as const,
              ['first_aid', 'Autoriza primeiros socorros', authorizedFirstAid, () => setAuthorizedFirstAid(!authorizedFirstAid)] as const,
              ['evacuation', 'Autoriza evacuação de emergência', authorizedEvacuation, () => setAuthorizedEvacuation(!authorizedEvacuation)] as const,
            ]).map(([key, label, val, toggle]) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={val} onChange={toggle}
                  className="w-4 h-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </DrawerCard>
      {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mx-1">{error}</p>}
    </Drawer>
  );
}

// ── Certificate Drawer ────────────────────────────────────────────────────────

function CertificateDrawer({
  open,
  studentId,
  onClose,
  onSaved,
}: {
  open: boolean;
  studentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorCrm, setDoctorCrm]   = useState('');
  const [observations, setObservations] = useState('');
  const [file, setFile]         = useState<File | null>(null);

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30';

  useEffect(() => {
    if (open) {
      setIssueDate(''); setValidUntil(''); setDoctorName(''); setDoctorCrm('');
      setObservations(''); setFile(null); setSaved(false); setError('');
    }
  }, [open]);

  async function handleSave() {
    if (!issueDate || !validUntil || !doctorName.trim() || !doctorCrm.trim()) {
      setError('Preencha todos os campos obrigatórios'); return;
    }
    setSaving(true);
    try {
      let filePath: string | null = null;
      let fileUrl: string | null = null;

      if (file) {
        const ext = file.name.split('.').pop() ?? 'pdf';
        filePath = `${studentId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('atestados').upload(filePath, file, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('atestados').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }

      const { error: insertErr } = await supabase.from('student_medical_certificates').insert({
        student_id: studentId,
        issue_date: issueDate,
        valid_until: validUntil,
        doctor_name: doctorName.trim(),
        doctor_crm: doctorCrm.trim(),
        observations: observations.trim() || null,
        file_path: filePath,
        file_url: fileUrl,
        uploaded_via: 'admin',
      });
      if (insertErr) throw insertErr;
      setSaved(true);
      onSaved();
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <div className="flex gap-3">
      <button onClick={onClose} disabled={saving}
        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving}
        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'}`}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Stethoscope className="w-4 h-4" />}
        {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Adicionar Atestado'}
      </button>
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} title="Novo Atestado Médico" icon={Stethoscope} width="w-[440px]" footer={footer}>
      <DrawerCard title="Dados do Atestado" icon={Stethoscope}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Data de Emissão *</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Válido até *</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nome do Médico *</label>
            <input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className={inputCls} placeholder="Dr. João Silva" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">CRM *</label>
            <input value={doctorCrm} onChange={(e) => setDoctorCrm(e.target.value)} className={inputCls} placeholder="CRM/PE 12345" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
            <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Arquivo (PDF / imagem)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 dark:text-gray-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20" />
          </div>
        </div>
      </DrawerCard>
      {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg mx-1">{error}</p>}
    </Drawer>
  );
}

// ── StudentHealthTab ──────────────────────────────────────────────────────────

function StudentHealthTab({ studentId }: { studentId: string }) {
  const [record, setRecord]       = useState<StudentHealthRecord | null>(null);
  const [certs, setCerts]         = useState<StudentMedicalCertificate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [healthDrawer, setHealthDrawer] = useState(false);
  const [certDrawer, setCertDrawer]     = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'ficha' | 'atestados'>('ficha');

  const load = useCallback(async () => {
    setLoading(true);
    const [healthRes, certsRes] = await Promise.all([
      supabase.from('student_health_records').select('*').eq('student_id', studentId).maybeSingle(),
      supabase.from('student_medical_certificates').select('*').eq('student_id', studentId).order('created_at', { ascending: false }),
    ]);
    setRecord(healthRes.data as StudentHealthRecord | null);
    setCerts((certsRes.data ?? []) as StudentMedicalCertificate[]);
    setLoading(false);
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-50 dark:bg-gray-900 rounded-xl p-1">
        {(['ficha', 'atestados'] as const).map((t) => (
          <button key={t} onClick={() => setActiveSubTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeSubTab === t ? 'bg-white dark:bg-gray-800 shadow text-brand-primary' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {t === 'ficha' ? 'Ficha de Saúde' : 'Atestados'}
          </button>
        ))}
      </div>

      {/* Ficha de Saúde sub-tab */}
      {activeSubTab === 'ficha' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {record ? `Atualizado em ${fmtDate(record.updated_at)}` : 'Ficha ainda não criada'}
            </p>
            <button onClick={() => setHealthDrawer(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors">
              <Pencil className="w-3.5 h-3.5" /> {record ? 'Editar' : 'Criar Ficha'}
            </button>
          </div>

          {!record ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma ficha de saúde cadastrada.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Dados Básicos" icon={HeartPulse}>
                <div className="space-y-3">
                  {record.blood_type && <InfoRow icon={HeartPulse} label="Tipo Sanguíneo" value={record.blood_type} />}
                  {record.health_plan && <InfoRow icon={HeartPulse} label="Plano de Saúde" value={`${record.health_plan}${record.health_plan_number ? ` — ${record.health_plan_number}` : ''}`} />}
                  {(record.chronic_conditions ?? []).length > 0 && (
                    <div className="flex items-start gap-2.5">
                      <HeartPulse className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide">Condições Crônicas</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(record.chronic_conditions ?? []).map((c) => (
                            <span key={c} className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full text-xs">{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {record.food_restrictions && <InfoRow icon={HeartPulse} label="Restrições Alimentares" value={record.food_restrictions} />}
                  {record.notes && <InfoRow icon={HeartPulse} label="Observações" value={record.notes} />}
                </div>
              </SectionCard>

              <SectionCard title="Alergias" icon={HeartPulse}>
                {!record.has_allergies ? (
                  <p className="text-sm text-gray-400">Sem alergias registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {(record.allergies ?? []).length > 0 && (
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Alergias</p>
                        <div className="flex flex-wrap gap-1">
                          {(record.allergies ?? []).map((a) => (
                            <span key={a} className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full text-xs">{a}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(record.allergy_categories ?? []).length > 0 && (
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Categorias</p>
                        <div className="flex flex-wrap gap-1">
                          {(record.allergy_categories ?? []).map((c) => (
                            <span key={c} className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {record.allergy_notes && <p className="text-xs text-gray-600 dark:text-gray-400">{record.allergy_notes}</p>}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Medicamentos" icon={HeartPulse}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${record.uses_medication ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {record.uses_medication ? 'Usa medicamentos de uso contínuo' : 'Sem medicamentos de uso contínuo'}
                    </span>
                  </div>
                  {record.uses_medication && (record.medications ?? []).map((med, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-xs space-y-1">
                      <p className="font-semibold text-gray-700 dark:text-gray-200">{med.name} — {med.dose}</p>
                      <p className="text-gray-500">{med.frequency}{med.instructions ? ` · ${med.instructions}` : ''}</p>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                    <span className={`w-2 h-2 rounded-full ${record.can_receive_medication ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {record.can_receive_medication ? 'Pode receber medicação na escola' : 'NÃO pode receber medicação na escola'}
                    </span>
                  </div>
                  {!record.can_receive_medication && record.medication_guidance && (
                    <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{record.medication_guidance}</p>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Necessidades Especiais & Emergência" icon={ShieldCheck}>
                <div className="space-y-2">
                  {record.has_special_needs && record.special_needs && (
                    <InfoRow icon={HeartPulse} label="Necessidades Especiais" value={record.special_needs} />
                  )}
                  {record.learning_difficulties && (
                    <InfoRow icon={HeartPulse} label="Dificuldades de Aprendizagem" value={record.learning_difficulties} />
                  )}
                  {record.emergency_contact_name && (
                    <InfoRow icon={Phone} label="Contato de Emergência" value={`${record.emergency_contact_name}${record.emergency_contact_rel ? ` (${record.emergency_contact_rel})` : ''} · ${record.emergency_contact_phone ?? ''}`} />
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      [record.authorized_photo, 'Foto autorizada'],
                      [record.authorized_first_aid, 'Primeiros socorros'],
                      [record.authorized_evacuation, 'Evacuação'],
                    ].map(([auth, label]) => (
                      <span key={String(label)} className={`px-2 py-0.5 rounded-full text-xs ${auth ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                        {String(label)}
                      </span>
                    ))}
                  </div>
                </div>
              </SectionCard>
            </div>
          )}
        </div>
      )}

      {/* Atestados sub-tab */}
      {activeSubTab === 'atestados' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">{certs.length} atestado(s) registrado(s)</p>
            <button onClick={() => setCertDrawer(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors">
              <Plus className="w-3.5 h-3.5" /> Adicionar Atestado
            </button>
          </div>
          {certs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum atestado registrado.</p>
          ) : (
            <div className="space-y-2">
              {certs.map((cert) => {
                const status = certStatus(cert.valid_until);
                return (
                  <div key={cert.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CERT_STATUS_COLORS[status]}`}>
                          {CERT_STATUS_LABELS[status]}
                        </span>
                        {!cert.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Substituído</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{cert.doctor_name}</p>
                      <p className="text-xs text-gray-400">CRM: {cert.doctor_crm} · Válido até: {fmtDate(cert.valid_until)}</p>
                      {cert.observations && <p className="text-xs text-gray-500 mt-0.5">{cert.observations}</p>}
                    </div>
                    {cert.file_url && (
                      <a href={cert.file_url} target="_blank" rel="noopener noreferrer"
                        className="ml-3 p-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all">
                        <Paperclip className="w-4 h-4 text-gray-400" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <HealthRecordDrawer open={healthDrawer} record={record} studentId={studentId} onClose={() => setHealthDrawer(false)} onSaved={load} />
      <CertificateDrawer open={certDrawer} studentId={studentId} onClose={() => setCertDrawer(false)} onSaved={load} />
    </div>
  );
}

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

        {/* SAÚDE */}
        {(activeTab === 'saude') && student && (
          <StudentHealthTab studentId={student.id} />
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

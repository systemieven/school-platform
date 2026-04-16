/**
 * SaudePage — Portal do Responsável: Ficha de Saúde
 *
 * Fase 11.C — mostra a ficha de saúde do filho(a), atestado vigente,
 * formulário de proposta de atualização e histórico de solicitações.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGuardian } from '../../contexts/GuardianAuthContext';
import {
  HeartPulse, Loader2, Check, Stethoscope, Plus, Pencil,
  AlertTriangle, Clock, CheckCircle2, XCircle,
  Paperclip, X,
} from 'lucide-react';
import type {
  StudentHealthRecord,
  StudentMedicalCertificate,
  HealthRecordUpdateRequest,
  HealthUpdateRequestStatus,
  MedicationEntry,
} from '../../../admin/types/admin.types';
import { HEALTH_UPDATE_STATUS_LABELS } from '../../../admin/types/admin.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

const STATUS_BADGE: Record<HealthUpdateRequestStatus, string> = {
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-700',
};

const STATUS_ICONS: Record<HealthUpdateRequestStatus, React.ComponentType<{ className?: string }>> = {
  pending:   Clock,
  confirmed: CheckCircle2,
  rejected:  XCircle,
};

function certBadge(validUntil: string) {
  const today = new Date();
  const exp   = new Date(validUntil);
  if (exp < today) return { label: 'Vencido', cls: 'bg-red-100 text-red-700' };
  const diff  = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 30) return { label: 'Vence em breve', cls: 'bg-amber-100 text-amber-700' };
  return { label: 'Válido', cls: 'bg-emerald-100 text-emerald-700' };
}

const ALLERGY_CATS = ['alimentar', 'medicamentosa', 'ambiental', 'outras'];
const REQUIRED_FIELDS_LABELS: Record<string, string> = {
  food_restrictions:     'Restrições Alimentares',
  has_allergies:         'Alergias',
  allergies:             'Lista de alergias',
  allergy_notes:         'Obs. alergias',
  allergy_categories:    'Categorias de alergias',
  uses_medication:       'Usa medicamentos',
  medications:           'Medicamentos',
  can_receive_medication:'Pode receber medicação',
  medication_guidance:   'Orientações medicação',
  chronic_conditions:    'Condições crônicas',
  has_special_needs:     'Necessidades especiais',
  special_needs:         'Descrição NE',
};

type SaveState = 'idle' | 'saving' | 'saved';

// ── Component ─────────────────────────────────────────────────────────────────

export default function SaudePage() {
  const { guardian, currentStudentId } = useGuardian();

  const [record, setRecord]   = useState<StudentHealthRecord | null>(null);
  const [certs, setCerts]     = useState<StudentMedicalCertificate[]>([]);
  const [requests, setRequests] = useState<HealthRecordUpdateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowGuardianUpdates, setAllowGuardianUpdates] = useState(true);

  const [activeTab, setActiveTab] = useState<'ficha' | 'atestado' | 'proposta' | 'historico'>('ficha');

  // Certificate upload
  const [certState, setCertState] = useState<SaveState>('idle');
  const [certError, setCertError] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorCrm, setDoctorCrm]   = useState('');
  const [observations, setObservations] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);

  // Health update proposal
  const [propState, setPropState] = useState<SaveState>('idle');
  const [propError, setPropError] = useState('');
  const [propSuccess, setPropSuccess] = useState(false);
  const [propFoodRestrictions, setPropFoodRestrictions] = useState('');
  const [propHasAllergies, setPropHasAllergies]         = useState(false);
  const [propAllergiesRaw, setPropAllergiesRaw]         = useState('');
  const [propAllergyNotes, setPropAllergyNotes]         = useState('');
  const [propAllergyCategories, setPropAllergyCategories] = useState<string[]>([]);
  const [propUsesMedication, setPropUsesMedication]     = useState(false);
  const [propMedications, setPropMedications]           = useState<MedicationEntry[]>([]);
  const [propCanReceiveMedication, setPropCanReceiveMedication] = useState(true);
  const [propMedicationGuidance, setPropMedicationGuidance]     = useState('');
  const [propChronicRaw, setPropChronicRaw]             = useState('');
  const [propHasSpecialNeeds, setPropHasSpecialNeeds]   = useState(false);
  const [propSpecialNeeds, setPropSpecialNeeds]         = useState('');

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30';

  // Load data
  const load = useCallback(async () => {
    if (!currentStudentId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [healthRes, certsRes, reqRes, settingsRes] = await Promise.all([
        supabase.from('student_health_records').select('*').eq('student_id', currentStudentId).maybeSingle(),
        supabase.from('student_medical_certificates').select('*').eq('student_id', currentStudentId).order('created_at', { ascending: false }),
        supabase.from('health_record_update_requests').select('*').eq('student_id', currentStudentId).order('created_at', { ascending: false }),
        supabase.from('system_settings').select('value').eq('category', 'academico').eq('key', 'health.allow_guardian_updates').maybeSingle(),
      ]);
      const h = healthRes.data as StudentHealthRecord | null;
      setRecord(h);
      setCerts((certsRes.data ?? []) as StudentMedicalCertificate[]);
      setRequests((reqRes.data ?? []) as HealthRecordUpdateRequest[]);
      setAllowGuardianUpdates(settingsRes.data?.value !== false && settingsRes.data?.value !== 'false');
      // Seed proposal form from current data
      if (h) {
        setPropFoodRestrictions(h.food_restrictions ?? '');
        setPropHasAllergies(h.has_allergies);
        setPropAllergiesRaw((h.allergies ?? []).join(', '));
        setPropAllergyNotes(h.allergy_notes ?? '');
        setPropAllergyCategories((h.allergy_categories ?? []) as string[]);
        setPropUsesMedication(h.uses_medication);
        setPropMedications(h.medications ?? []);
        setPropCanReceiveMedication(h.can_receive_medication ?? true);
        setPropMedicationGuidance(h.medication_guidance ?? '');
        setPropChronicRaw((h.chronic_conditions ?? []).join(', '));
        setPropHasSpecialNeeds(h.has_special_needs);
        setPropSpecialNeeds(h.special_needs ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [currentStudentId]);

  useEffect(() => { load(); }, [load]);

  // Guardian profile id
  const guardianProfileId = (guardian as unknown as { id?: string } | null)?.id ?? null;

  async function handleCertUpload() {
    if (!issueDate || !validUntil || !doctorName.trim() || !doctorCrm.trim()) {
      setCertError('Preencha todos os campos obrigatórios'); return;
    }
    if (!currentStudentId) return;
    setCertState('saving'); setCertError('');
    try {
      let filePath: string | null = null;
      let fileUrl: string | null = null;
      if (certFile) {
        const ext = certFile.name.split('.').pop() ?? 'pdf';
        filePath = `${currentStudentId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('atestados').upload(filePath, certFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('atestados').getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
      }
      const { error: insertErr } = await supabase.from('student_medical_certificates').insert({
        student_id: currentStudentId,
        issue_date: issueDate,
        valid_until: validUntil,
        doctor_name: doctorName.trim(),
        doctor_crm: doctorCrm.trim(),
        observations: observations.trim() || null,
        file_path: filePath,
        file_url: fileUrl,
        uploaded_via: 'guardian_portal',
      });
      if (insertErr) throw insertErr;
      setCertState('saved');
      setIssueDate(''); setValidUntil(''); setDoctorName(''); setDoctorCrm('');
      setObservations(''); setCertFile(null);
      await load();
      setActiveTab('atestado');
      setTimeout(() => setCertState('idle'), 900);
    } catch (e: unknown) {
      setCertError((e as Error).message ?? 'Erro ao enviar atestado');
      setCertState('idle');
    }
  }

  async function handleProposeUpdate() {
    if (!currentStudentId || !guardianProfileId) return;
    if (!record) { setPropError('Ficha de saúde não encontrada.'); return; }
    setPropState('saving'); setPropError(''); setPropSuccess(false);
    try {
      const snapshot: Record<string, unknown> = {
        food_restrictions: record.food_restrictions,
        has_allergies: record.has_allergies,
        allergies: record.allergies,
        allergy_notes: record.allergy_notes,
        allergy_categories: record.allergy_categories,
        uses_medication: record.uses_medication,
        medications: record.medications,
        can_receive_medication: record.can_receive_medication,
        medication_guidance: record.medication_guidance,
        chronic_conditions: record.chronic_conditions,
        has_special_needs: record.has_special_needs,
        special_needs: record.special_needs,
      };

      const proposed: Record<string, unknown> = {
        food_restrictions: propFoodRestrictions.trim() || null,
        has_allergies: propHasAllergies,
        allergies: propHasAllergies ? propAllergiesRaw.split(',').map((v) => v.trim()).filter(Boolean) : [],
        allergy_notes: propHasAllergies ? propAllergyNotes.trim() || null : null,
        allergy_categories: propHasAllergies ? propAllergyCategories : [],
        uses_medication: propUsesMedication,
        medications: propUsesMedication ? propMedications : [],
        can_receive_medication: propCanReceiveMedication,
        medication_guidance: !propCanReceiveMedication ? propMedicationGuidance.trim() || null : null,
        chronic_conditions: propChronicRaw.split(',').map((v) => v.trim()).filter(Boolean),
        has_special_needs: propHasSpecialNeeds,
        special_needs: propHasSpecialNeeds ? propSpecialNeeds.trim() || null : null,
      };

      const { error: insertErr } = await supabase.from('health_record_update_requests').insert({
        student_id: currentStudentId,
        guardian_id: guardianProfileId,
        proposed_data: proposed,
        current_snapshot: snapshot,
        status: 'pending',
      });
      if (insertErr) throw insertErr;
      setPropSuccess(true);
      setPropState('saved');
      await load();
      setTimeout(() => { setPropState('idle'); setPropSuccess(false); }, 1200);
    } catch (e: unknown) {
      setPropError((e as Error).message ?? 'Erro ao enviar solicitação');
      setPropState('idle');
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const activeCert = certs.find((c) => c.is_active) ?? null;

  const TABS = [
    { key: 'ficha',     label: 'Ficha', icon: HeartPulse },
    { key: 'atestado',  label: 'Atestado', icon: Stethoscope },
    { key: 'proposta',  label: 'Propor Atualização', icon: Pencil },
    { key: 'historico', label: 'Histórico', icon: Clock },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-brand-primary dark:text-brand-secondary" />
          Ficha de Saúde
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Visualize e solicite atualizações na ficha de saúde do(a) aluno(a).
        </p>
      </div>

      {/* Tab rail */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-1.5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl transition-all ${
              activeTab === key
                ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/15'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-brand-primary'
            }`}>
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Ficha ── */}
      {activeTab === 'ficha' && (
        <div className="space-y-4">
          {!record ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
              <HeartPulse className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Ficha de saúde ainda não cadastrada.</p>
              <p className="text-gray-400 text-xs mt-1">Entre em contato com a secretaria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Basic info card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-900/40 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dados Básicos</p>
                </div>
                <div className="p-5 space-y-3">
                  {record.blood_type && (
                    <div>
                      <p className="text-xs text-gray-400">Tipo Sanguíneo</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{record.blood_type}</p>
                    </div>
                  )}
                  {record.health_plan && (
                    <div>
                      <p className="text-xs text-gray-400">Plano de Saúde</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{record.health_plan}{record.health_plan_number ? ` — ${record.health_plan_number}` : ''}</p>
                    </div>
                  )}
                  {record.food_restrictions && (
                    <div>
                      <p className="text-xs text-gray-400">Restrições Alimentares</p>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{record.food_restrictions}</p>
                    </div>
                  )}
                  {(record.chronic_conditions ?? []).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Condições Crônicas</p>
                      <div className="flex flex-wrap gap-1">
                        {(record.chronic_conditions ?? []).map((c) => (
                          <span key={c} className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Allergies */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-900/40 px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex-1">Alergias</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${record.has_allergies ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                    {record.has_allergies ? 'Sim' : 'Não'}
                  </span>
                </div>
                {record.has_allergies && (
                  <div className="p-5 space-y-2">
                    {(record.allergies ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(record.allergies ?? []).map((a) => (
                          <span key={a} className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{a}</span>
                        ))}
                      </div>
                    )}
                    {record.allergy_notes && <p className="text-sm text-gray-600 dark:text-gray-400">{record.allergy_notes}</p>}
                  </div>
                )}
              </div>

              {/* Medication */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-900/40 px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex-1">Medicamentos</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${record.uses_medication ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {record.uses_medication ? 'Em uso' : 'Nenhum'}
                  </span>
                </div>
                <div className="p-5 space-y-2">
                  {record.uses_medication && (record.medications ?? []).map((med, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-xs">
                      <p className="font-semibold text-gray-700 dark:text-gray-200">{med.name} — {med.dose}</p>
                      <p className="text-gray-500">{med.frequency}{med.instructions ? ` · ${med.instructions}` : ''}</p>
                    </div>
                  ))}
                  <div className={`flex items-center gap-2 text-sm ${record.can_receive_medication ? 'text-emerald-700' : 'text-red-700'}`}>
                    {record.can_receive_medication ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {record.can_receive_medication ? 'Pode receber medicação na escola' : 'Não pode receber medicação na escola'}
                  </div>
                  {!record.can_receive_medication && record.medication_guidance && (
                    <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{record.medication_guidance}</p>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-400 text-right">Atualizado em {fmtDate(record.updated_at)}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Atestado ── */}
      {activeTab === 'atestado' && (
        <div className="space-y-4">
          {/* Active certificate */}
          {activeCert ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${certBadge(activeCert.valid_until).cls}`}>
                  {certBadge(activeCert.valid_until).label}
                </span>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Atestado Vigente</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Médico</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{activeCert.doctor_name} · CRM {activeCert.doctor_crm}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Validade</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">{fmtDate(activeCert.valid_until)}</p>
              </div>
              {activeCert.file_url && (
                <a href={activeCert.file_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all">
                  <Paperclip className="w-3.5 h-3.5" /> Ver arquivo
                </a>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-700 p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">Nenhum atestado vigente encontrado.</p>
            </div>
          )}

          {/* Upload new certificate */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-900/40 px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Enviar Novo Atestado</p>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2}
                  className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Arquivo (PDF / imagem)</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-600 dark:text-gray-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20" />
              </div>
              {certError && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{certError}</p>}
              <button onClick={handleCertUpload} disabled={certState === 'saving'}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  certState === 'saved' ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
                }`}>
                {certState === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : certState === 'saved' ? <Check className="w-4 h-4" /> : <Stethoscope className="w-4 h-4" />}
                {certState === 'saving' ? 'Enviando…' : certState === 'saved' ? 'Enviado!' : 'Enviar Atestado'}
              </button>
            </div>
          </div>

          {/* All certificates history */}
          {certs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1">Histórico de Atestados</p>
              {certs.map((cert) => (
                <div key={cert.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${certBadge(cert.valid_until).cls}`}>{certBadge(cert.valid_until).label}</span>
                      {!cert.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Substituído</span>}
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{cert.doctor_name}</p>
                    <p className="text-xs text-gray-400">CRM: {cert.doctor_crm} · Válido até: {fmtDate(cert.valid_until)}</p>
                  </div>
                  {cert.file_url && (
                    <a href={cert.file_url} target="_blank" rel="noopener noreferrer"
                      className="ml-3 p-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all">
                      <Paperclip className="w-4 h-4 text-gray-400" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Proposta ── */}
      {activeTab === 'proposta' && (
        <div className="space-y-4">
          {!allowGuardianUpdates ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Atualizações pelo portal estão desativadas.</p>
              <p className="text-xs text-gray-400 mt-1">Entre em contato com a secretaria para atualizar a ficha.</p>
            </div>
          ) : !record ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center">
              <p className="text-sm text-gray-500">A ficha de saúde precisa ser criada pela secretaria antes de propor atualizações.</p>
            </div>
          ) : (
            <>
              {propSuccess && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Sua atualização foi enviada e será analisada pela secretaria.
                  </p>
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-900/40 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Editar Ficha de Saúde</p>
                </div>
                <div className="p-5 space-y-4">
                  {/* Food restrictions */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Restrições Alimentares</label>
                    <textarea value={propFoodRestrictions} onChange={(e) => setPropFoodRestrictions(e.target.value)}
                      rows={2} className={`${inputCls} resize-none`} placeholder="Ex: sem glúten, vegetariano…" />
                  </div>

                  {/* Allergies toggle */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Possui alergias</span>
                      <button type="button" onClick={() => setPropHasAllergies(!propHasAllergies)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${propHasAllergies ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${propHasAllergies ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    {propHasAllergies && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Categorias</label>
                          <div className="flex flex-wrap gap-2">
                            {ALLERGY_CATS.map((cat) => (
                              <button key={cat} type="button"
                                onClick={() => setPropAllergyCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat])}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${propAllergyCategories.includes(cat) ? 'bg-brand-primary text-white border-brand-primary' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-primary'}`}>
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Alergias (separadas por vírgula)</label>
                          <input value={propAllergiesRaw} onChange={(e) => setPropAllergiesRaw(e.target.value)} className={inputCls} placeholder="Amendoim, Lactose" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
                          <textarea value={propAllergyNotes} onChange={(e) => setPropAllergyNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Medications toggle */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Usa medicamentos de uso contínuo</span>
                      <button type="button" onClick={() => setPropUsesMedication(!propUsesMedication)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${propUsesMedication ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${propUsesMedication ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    {propUsesMedication && (
                      <div className="space-y-2">
                        {propMedications.map((med, idx) => (
                          <div key={idx} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500">Medicamento {idx + 1}</span>
                              <button onClick={() => setPropMedications((p) => p.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {(['name', 'dose', 'frequency', 'instructions'] as const).map((field) => (
                              <div key={field}>
                                <label className="block text-xs text-gray-400 mb-0.5">
                                  {field === 'name' ? 'Nome' : field === 'dose' ? 'Dose' : field === 'frequency' ? 'Frequência' : 'Instruções'}
                                </label>
                                <input value={med[field]}
                                  onChange={(e) => setPropMedications((p) => p.map((m, i) => i === idx ? { ...m, [field]: e.target.value } : m))}
                                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
                              </div>
                            ))}
                          </div>
                        ))}
                        <button type="button"
                          onClick={() => setPropMedications((p) => [...p, { name: '', dose: '', frequency: '', instructions: '' }])}
                          className="text-xs text-brand-primary hover:text-brand-primary-dark font-medium flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5" /> Adicionar medicamento
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Pode receber medicação na escola</span>
                      <button type="button" onClick={() => setPropCanReceiveMedication(!propCanReceiveMedication)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${propCanReceiveMedication ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${propCanReceiveMedication ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    {!propCanReceiveMedication && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Orientações para não administração</label>
                        <textarea value={propMedicationGuidance} onChange={(e) => setPropMedicationGuidance(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
                      </div>
                    )}
                  </div>

                  {/* Chronic conditions */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Condições Crônicas (separadas por vírgula)</label>
                    <input value={propChronicRaw} onChange={(e) => setPropChronicRaw(e.target.value)} className={inputCls} placeholder="Diabetes, Asma" />
                  </div>

                  {/* Special needs */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Possui necessidades especiais</span>
                      <button type="button" onClick={() => setPropHasSpecialNeeds(!propHasSpecialNeeds)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${propHasSpecialNeeds ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${propHasSpecialNeeds ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    {propHasSpecialNeeds && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
                        <textarea value={propSpecialNeeds} onChange={(e) => setPropSpecialNeeds(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
                      </div>
                    )}
                  </div>

                  {propError && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{propError}</p>}

                  <button onClick={handleProposeUpdate} disabled={propState === 'saving'}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      propState === 'saved' ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
                    }`}>
                    {propState === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : propState === 'saved' ? <Check className="w-4 h-4" /> : <HeartPulse className="w-4 h-4" />}
                    {propState === 'saving' ? 'Enviando…' : propState === 'saved' ? 'Enviado!' : 'Enviar Proposta de Atualização'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Histórico ── */}
      {activeTab === 'historico' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Nenhuma solicitação enviada.</p>
            </div>
          ) : requests.map((req) => {
            const StatusIcon = STATUS_ICONS[req.status];
            return (
              <div key={req.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <p className="text-sm font-medium text-gray-800 dark:text-white">Atualização de ficha</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[req.status]}`}>
                    {HEALTH_UPDATE_STATUS_LABELS[req.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{fmtDate(req.created_at)}</p>

                {/* Show changed fields */}
                <div className="space-y-1">
                  {Object.entries(req.proposed_data).map(([field, newVal]) => {
                    const oldVal = req.current_snapshot[field];
                    const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
                    if (!changed) return null;
                    const label = REQUIRED_FIELDS_LABELS[field] ?? field;
                    return (
                      <div key={field} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
                        <span className="font-medium text-gray-600 dark:text-gray-400 w-28 flex-shrink-0">{label}</span>
                        <span className="text-red-400 line-through truncate max-w-[100px]">{String(oldVal ?? '—')}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-emerald-600 dark:text-emerald-400 truncate max-w-[100px]">{String(newVal)}</span>
                      </div>
                    );
                  })}
                </div>

                {req.rejection_reason && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                    Motivo da recusa: {req.rejection_reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

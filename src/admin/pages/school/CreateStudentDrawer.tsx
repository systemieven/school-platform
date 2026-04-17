import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  User,
  Layers,
  FileText,
  Paperclip,
  Loader2,
  Trash2,
  Check,
  Camera,
} from 'lucide-react';
import ImageCropModal from '../../components/ImageCropModal';
import { supabase } from '../../../lib/supabase';
import { logAudit } from '../../../lib/audit';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { Drawer, DrawerCard } from '../../components/Drawer';
import { SelectDropdown } from '../../components/FormField';
import CapacityOverrideModal, { parseCapacityError } from '../../components/CapacityOverrideModal';
import { maskCPF, maskPhone, maskCEP, isValidCPF, isValidEmail } from '../../lib/masks';
import type { Student, SchoolSegment, SchoolSeries, SchoolClass } from '../../types/admin.types';

/* ────────────────────────────────────────────────────────────── */

interface Props {
  onClose: () => void;
  onCreated: (s: Student) => void;
}

const INPUT =
  'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:border-brand-primary dark:focus:border-brand-secondary outline-none transition-colors';

const LABEL = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

interface AddressFields {
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const emptyAddress = (): AddressFields => ({
  zip_code: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
});

/* ────────────────────────────────────────────────────────────── */

export default function CreateStudentDrawer({ onClose, onCreated }: Props) {
  const { profile, hasRole } = useAdminAuth();
  const canOverrideCapacity = hasRole('admin', 'super_admin');

  // ── Guardian ──
  const [guardianName, setGuardianName] = useState('');
  const [guardianCpf, setGuardianCpf] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianAddr, setGuardianAddr] = useState<AddressFields>(emptyAddress());
  const [loadingCepGuardian, setLoadingCepGuardian] = useState(false);

  // ── Student ──
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [studentCpf, setStudentCpf] = useState('');
  const [sameAddress, setSameAddress] = useState(true);
  const [studentAddr, setStudentAddr] = useState<AddressFields>(emptyAddress());
  const [loadingCepStudent, setLoadingCepStudent] = useState(false);

  // ── History ──
  const [firstSchool, setFirstSchool] = useState(true);
  const [lastGrade, setLastGrade] = useState('');
  const [previousSchool, setPreviousSchool] = useState('');

  // ── Father ──
  const [fatherName, setFatherName] = useState('');
  const [fatherCpf, setFatherCpf] = useState('');
  const [fatherPhone, setFatherPhone] = useState('');
  const [fatherEmail, setFatherEmail] = useState('');

  // ── Mother ──
  const [motherName, setMotherName] = useState('');
  const [motherCpf, setMotherCpf] = useState('');
  const [motherPhone, setMotherPhone] = useState('');
  const [motherEmail, setMotherEmail] = useState('');

  // ── Segment, Series & Class ──
  const [segments, setSegments] = useState<SchoolSegment[]>([]);
  const [seriesList, setSeriesList] = useState<SchoolSeries[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [segmentId, setSegmentId] = useState('');
  const [seriesId, setSeriesId] = useState('');
  const [classId, setClassId] = useState('');
  const currentSchoolYear = new Date().getFullYear();

  // ── Photo (3×4) ──
  const [cropPhotoSrc, setCropPhotoSrc] = useState<string | null>(null);
  const [pendingPhotoDataUrl, setPendingPhotoDataUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Notes ──
  const [internalNotes, setInternalNotes] = useState('');

  // ── Documents ──
  const [files, setFiles] = useState<File[]>([]);

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  // ── Capacity override modal state ──
  const [capacityModal, setCapacityModal] = useState<{
    current: number;
    max: number;
    className: string;
  } | null>(null);

  /* ── Load segments on mount ── */
  useEffect(() => {
    supabase
      .from('school_segments')
      .select('*')
      .eq('is_active', true)
      .order('position')
      .then(({ data }) => {
        if (data) setSegments(data as SchoolSegment[]);
      });
  }, []);

  /* ── Load series when segment changes ── */
  useEffect(() => {
    setSeriesId('');
    setClassId('');
    setClasses([]);
    if (!segmentId) {
      setSeriesList([]);
      return;
    }
    supabase
      .from('school_series')
      .select('*')
      .eq('segment_id', segmentId)
      .eq('is_active', true)
      .order('order_index')
      .then(({ data }) => {
        if (data) setSeriesList(data as SchoolSeries[]);
      });
  }, [segmentId]);

  /* ── Load classes when series changes (filtered by current school year) ── */
  useEffect(() => {
    setClassId('');
    if (!seriesId) {
      setClasses([]);
      return;
    }
    supabase
      .from('school_classes')
      .select('*')
      .eq('series_id', seriesId)
      .eq('school_year', currentSchoolYear)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setClasses(data as SchoolClass[]);
      });
  }, [seriesId, currentSchoolYear]);

  /* ── ViaCEP lookup helper ── */
  async function lookupCep(
    cep: string,
    setter: React.Dispatch<React.SetStateAction<AddressFields>>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setter((prev) => ({
          ...prev,
          street: data.logradouro ?? prev.street,
          neighborhood: data.bairro ?? prev.neighborhood,
          city: data.localidade ?? prev.city,
          state: data.uf ?? prev.state,
        }));
      }
    } catch {
      /* ignore fetch errors */
    } finally {
      setLoading(false);
    }
  }

  /* ── File handling ── */
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    const valid = incoming.filter((f) => {
      if (f.size > 5 * 1024 * 1024) return false;
      if (!/\.(pdf|jpg|jpeg|png)$/i.test(f.name)) return false;
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
    e.target.value = '';
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  /* ── Validation ── */
  function validate(): string | null {
    if (!fullName.trim()) return 'full_name';
    if (!guardianName.trim()) return 'guardian_name';
    if (!guardianPhone.trim()) return 'guardian_phone';
    if (!birthDate) return 'birth_date';

    if (guardianCpf && !isValidCPF(guardianCpf)) return 'guardian_cpf';
    if (studentCpf && !isValidCPF(studentCpf)) return 'student_cpf';
    if (fatherCpf && !isValidCPF(fatherCpf)) return 'father_cpf';
    if (motherCpf && !isValidCPF(motherCpf)) return 'mother_cpf';

    if (guardianEmail && !isValidEmail(guardianEmail)) return 'guardian_email';
    if (fatherEmail && !isValidEmail(fatherEmail)) return 'father_email';
    if (motherEmail && !isValidEmail(motherEmail)) return 'mother_email';

    return null;
  }

  /* ── Submit ── */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const invalidField = validate();
    if (invalidField) {
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${invalidField}"]`);
      el?.focus();
      setError('Preencha ou corrija os campos obrigatórios.');
      return;
    }

    setSaving(true);
    await runSubmit(false);
  }

  /**
   * Executa a inserção via RPC `create_student_with_capacity`.
   * Quando `force=true`, o backend (depois de validar role admin) seta o GUC
   * `app.capacity_override` e bypassa o trigger, gravando audit log.
   */
  async function runSubmit(force: boolean) {
    setError('');
    try {
      // 1. Generate enrollment number
      const { data: enrollNum, error: rpcErr } = await supabase.rpc('generate_enrollment_number');
      if (rpcErr) throw rpcErr;

      const addr = sameAddress ? guardianAddr : studentAddr;

      const payload = {
        enrollment_number: enrollNum as string,
        full_name: fullName.trim(),
        birth_date: birthDate || null,
        cpf: studentCpf ? studentCpf.replace(/\D/g, '') : null,
        guardian_name: guardianName.trim(),
        guardian_cpf: guardianCpf ? guardianCpf.replace(/\D/g, '') : null,
        guardian_phone: guardianPhone.replace(/\D/g, ''),
        guardian_email: guardianEmail.trim() || null,
        guardian_zip_code: guardianAddr.zip_code.replace(/\D/g, '') || null,
        guardian_street: guardianAddr.street.trim() || null,
        guardian_number: guardianAddr.number.trim() || null,
        guardian_complement: guardianAddr.complement.trim() || null,
        guardian_neighborhood: guardianAddr.neighborhood.trim() || null,
        guardian_city: guardianAddr.city.trim() || null,
        guardian_state: guardianAddr.state.trim() || null,
        student_zip_code: addr.zip_code.replace(/\D/g, '') || null,
        student_street: addr.street.trim() || null,
        student_number: addr.number.trim() || null,
        student_complement: addr.complement.trim() || null,
        student_neighborhood: addr.neighborhood.trim() || null,
        student_city: addr.city.trim() || null,
        student_state: addr.state.trim() || null,
        first_school: firstSchool,
        last_grade: firstSchool ? null : lastGrade.trim() || null,
        previous_school_name: firstSchool ? null : previousSchool.trim() || null,
        class_id: classId || null,
        segment: segmentId
          ? segments.find((s) => s.id === segmentId)?.name ?? null
          : null,
        father_name: fatherName.trim() || null,
        father_cpf: fatherCpf ? fatherCpf.replace(/\D/g, '') : null,
        father_phone: fatherPhone.replace(/\D/g, '') || null,
        father_email: fatherEmail.trim() || null,
        mother_name: motherName.trim() || null,
        mother_cpf: motherCpf ? motherCpf.replace(/\D/g, '') : null,
        mother_phone: motherPhone.replace(/\D/g, '') || null,
        mother_email: motherEmail.trim() || null,
        internal_notes: internalNotes.trim() || null,
        status: 'active' as const,
        document_urls: [] as string[],
      };

      // 2. Insert student via RPC (respects capacity trigger; force=true bypasses for admins)
      const { data: inserted, error: insErr } = await supabase.rpc(
        'create_student_with_capacity',
        { payload: payload as unknown as Record<string, unknown>, force },
      );
      if (insErr) {
        const cap = parseCapacityError(insErr);
        if (cap) {
          const cls = classes.find((c) => c.id === cap.classId);
          setCapacityModal({
            current: cap.current,
            max: cap.max,
            className: cls?.name ?? '',
          });
          setSaving(false);
          return;
        }
        throw insErr;
      }
      if (!inserted) throw new Error('Inserção retornou vazia.');

      // 3. Upload documents
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `${inserted.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('student-documents')
          .upload(path, file);
        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from('student-documents')
            .getPublicUrl(path);
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      // 4. Update document_urls if any uploaded
      if (uploadedUrls.length > 0) {
        await supabase
          .from('students')
          .update({ document_urls: uploadedUrls })
          .eq('id', inserted.id);
      }

      // 4b. Upload photo if selected
      let photoUrl: string | null = null;
      if (pendingPhotoDataUrl) {
        try {
          const blob = await fetch(pendingPhotoDataUrl).then((r) => r.blob());
          const path = `${inserted.id}/photo.jpg`;
          const { error: photoErr } = await supabase.storage
            .from('student-photos')
            .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
          if (!photoErr) {
            const { data: urlData } = supabase.storage
              .from('student-photos')
              .getPublicUrl(path);
            photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
            await supabase
              .from('students')
              .update({ photo_url: photoUrl })
              .eq('id', inserted.id);
          }
        } catch {
          /* photo upload failure is non-fatal */
        }
      }

      // 5. Audit
      await logAudit({
        action: 'create',
        module: 'students',
        recordId: inserted.id,
        description: `Aluno "${fullName}" criado por ${profile?.full_name ?? profile?.email ?? 'admin'}`,
        newData: payload as unknown as Record<string, unknown>,
      });

      // 6. Show saved feedback, then call parent callback
      const student = {
        ...inserted,
        document_urls: uploadedUrls.length > 0 ? uploadedUrls : inserted.document_urls,
        photo_url: photoUrl ?? inserted.photo_url ?? null,
      } as Student;

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onCreated(student);
      }, 900);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar aluno.');
    } finally {
      setSaving(false);
    }
  }

  /* ── Address sub-form (3-col grid) ── */
  function renderAddress(
    prefix: string,
    addr: AddressFields,
    setAddr: React.Dispatch<React.SetStateAction<AddressFields>>,
    loadingCep: boolean,
    setLoadingCep: React.Dispatch<React.SetStateAction<boolean>>,
  ) {
    return (
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
        {/* CEP */}
        <div>
          <label className={LABEL}>CEP</label>
          <div className="relative">
            <input
              name={`${prefix}_zip_code`}
              className={INPUT}
              value={addr.zip_code}
              onChange={(e) => {
                const masked = maskCEP(e.target.value);
                setAddr((p) => ({ ...p, zip_code: masked }));
              }}
              onBlur={() => lookupCep(addr.zip_code, setAddr, setLoadingCep)}
              placeholder="00000-000"
            />
            {loadingCep && (
              <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>
        </div>

        {/* Rua — 2 colunas */}
        <div className="col-span-2">
          <label className={LABEL}>Rua</label>
          <input
            name={`${prefix}_street`}
            className={INPUT}
            value={addr.street}
            onChange={(e) => setAddr((p) => ({ ...p, street: e.target.value }))}
          />
        </div>

        {/* Número */}
        <div>
          <label className={LABEL}>Número</label>
          <input
            name={`${prefix}_number`}
            className={INPUT}
            value={addr.number}
            onChange={(e) => setAddr((p) => ({ ...p, number: e.target.value }))}
          />
        </div>

        {/* Complemento — 2 colunas */}
        <div className="col-span-2">
          <label className={LABEL}>Complemento</label>
          <input
            name={`${prefix}_complement`}
            className={INPUT}
            value={addr.complement}
            onChange={(e) => setAddr((p) => ({ ...p, complement: e.target.value }))}
          />
        </div>

        {/* Bairro */}
        <div>
          <label className={LABEL}>Bairro</label>
          <input
            name={`${prefix}_neighborhood`}
            className={INPUT}
            value={addr.neighborhood}
            onChange={(e) => setAddr((p) => ({ ...p, neighborhood: e.target.value }))}
          />
        </div>

        {/* Cidade */}
        <div>
          <label className={LABEL}>Cidade</label>
          <input
            name={`${prefix}_city`}
            className={INPUT}
            value={addr.city}
            onChange={(e) => setAddr((p) => ({ ...p, city: e.target.value }))}
          />
        </div>

        {/* Estado */}
        <div>
          <label className={LABEL}>UF</label>
          <input
            name={`${prefix}_state`}
            className={INPUT}
            value={addr.state}
            onChange={(e) => setAddr((p) => ({ ...p, state: e.target.value }))}
            maxLength={2}
            placeholder="UF"
          />
        </div>
      </div>
    );
  }

  /* ──────────────────────────── RENDER ──────────────────────────── */

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title="Novo Aluno"
      icon={GraduationCap}
      width="w-[640px]"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || saved}
            onClick={() => formRef.current?.requestSubmit()}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              saved
                ? 'bg-emerald-500 text-white'
                : 'bg-brand-primary hover:bg-brand-primary-dark text-white disabled:opacity-50'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" />
             : saved  ? <Check className="w-4 h-4" />
                      : <GraduationCap className="w-4 h-4" />}
            {saving ? 'Salvando…' : saved ? 'Aluno criado!' : 'Criar Aluno'}
          </button>
        </div>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* ── 0. Foto do Aluno ── */}
        <DrawerCard title="Foto do Aluno" icon={Camera}>
          <div className="flex items-center gap-5">
            {/* Preview */}
            <div
              className="relative w-20 h-[107px] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-200 dark:border-gray-600 flex-shrink-0 cursor-pointer group"
              onClick={() => photoInputRef.current?.click()}
              title="Clique para selecionar foto"
            >
              {pendingPhotoDataUrl ? (
                <img
                  src={pendingPhotoDataUrl}
                  alt="Pré-visualização"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-gray-500">
                  <Camera className="w-6 h-6" />
                  <span className="text-[10px] text-center leading-tight px-1">Foto 3×4</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Instructions + actions */}
            <div className="flex-1 space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                Foto de identificação do aluno
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-snug">
                Recomendado: fundo branco, rosto centralizado.<br />
                JPEG, PNG ou WebP · máx. 5 MB.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {pendingPhotoDataUrl ? 'Trocar foto' : 'Selecionar foto'}
                </button>
                {pendingPhotoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setPendingPhotoDataUrl(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Hidden file input */}
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
        </DrawerCard>

        {/* ── 1. Responsável ── */}
        <DrawerCard title="Responsável" icon={Users}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Nome *</label>
              <input
                name="guardian_name"
                className={INPUT}
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>CPF</label>
              <input
                name="guardian_cpf"
                className={INPUT}
                value={guardianCpf}
                onChange={(e) => setGuardianCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className={LABEL}>Telefone *</label>
              <input
                name="guardian_phone"
                className={INPUT}
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className={LABEL}>E-mail</label>
              <input
                name="guardian_email"
                type="email"
                className={INPUT}
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
              />
            </div>
          </div>
          {renderAddress('guardian', guardianAddr, setGuardianAddr, loadingCepGuardian, setLoadingCepGuardian)}
        </DrawerCard>

        {/* ── 2. Aluno ── */}
        <DrawerCard title="Aluno" icon={GraduationCap}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={LABEL}>Nome completo *</label>
              <input
                name="full_name"
                className={INPUT}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Data de nascimento *</label>
              <input
                name="birth_date"
                type="date"
                className={INPUT}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>CPF</label>
              <input
                name="student_cpf"
                className={INPUT}
                value={studentCpf}
                onChange={(e) => setStudentCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={sameAddress}
              onChange={(e) => setSameAddress(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-brand-primary focus:ring-brand-primary"
            />
            Mesmo endereço do responsável
          </label>

          {!sameAddress &&
            renderAddress('student', studentAddr, setStudentAddr, loadingCepStudent, setLoadingCepStudent)}
        </DrawerCard>

        {/* ── 3. Segmento, Série e Turma ── */}
        <DrawerCard title="Segmento, Série e Turma" icon={Layers}>
          <div className="grid grid-cols-3 gap-3">
            <SelectDropdown label="Segmento" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">Selecione...</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </SelectDropdown>
            <SelectDropdown label="Série" value={seriesId} onChange={(e) => setSeriesId(e.target.value)} disabled={!segmentId}>
              <option value="">Selecione...</option>
              {seriesList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </SelectDropdown>
            <SelectDropdown label={`Turma (${currentSchoolYear})`} value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!seriesId}>
              <option value="">Selecione...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectDropdown>
          </div>
          {seriesId && classes.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Nenhuma turma cadastrada para esta série no ano letivo {currentSchoolYear}.
            </p>
          )}
          {!classId && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Aluno sem turma não receberá comunicados direcionados por segmento ou turma.
            </p>
          )}
        </DrawerCard>

        {/* ── 4. Histórico Escolar ── */}
        <DrawerCard title="Histórico Escolar" icon={BookOpen}>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={firstSchool}
              onChange={(e) => setFirstSchool(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-brand-primary focus:ring-brand-primary"
            />
            Primeira escola do aluno
          </label>

          {!firstSchool && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Última série cursada</label>
                <input
                  name="last_grade"
                  className={INPUT}
                  value={lastGrade}
                  onChange={(e) => setLastGrade(e.target.value)}
                />
              </div>
              <div>
                <label className={LABEL}>Escola anterior</label>
                <input
                  name="previous_school_name"
                  className={INPUT}
                  value={previousSchool}
                  onChange={(e) => setPreviousSchool(e.target.value)}
                />
              </div>
            </div>
          )}
        </DrawerCard>

        {/* ── 5. Pai ── */}
        <DrawerCard title="Pai" icon={User}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Nome</label>
              <input
                name="father_name"
                className={INPUT}
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>CPF</label>
              <input
                name="father_cpf"
                className={INPUT}
                value={fatherCpf}
                onChange={(e) => setFatherCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className={LABEL}>Telefone</label>
              <input
                name="father_phone"
                className={INPUT}
                value={fatherPhone}
                onChange={(e) => setFatherPhone(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className={LABEL}>E-mail</label>
              <input
                name="father_email"
                type="email"
                className={INPUT}
                value={fatherEmail}
                onChange={(e) => setFatherEmail(e.target.value)}
              />
            </div>
          </div>
        </DrawerCard>

        {/* ── 6. Mãe ── */}
        <DrawerCard title="Mãe" icon={User}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Nome</label>
              <input
                name="mother_name"
                className={INPUT}
                value={motherName}
                onChange={(e) => setMotherName(e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>CPF</label>
              <input
                name="mother_cpf"
                className={INPUT}
                value={motherCpf}
                onChange={(e) => setMotherCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className={LABEL}>Telefone</label>
              <input
                name="mother_phone"
                className={INPUT}
                value={motherPhone}
                onChange={(e) => setMotherPhone(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className={LABEL}>E-mail</label>
              <input
                name="mother_email"
                type="email"
                className={INPUT}
                value={motherEmail}
                onChange={(e) => setMotherEmail(e.target.value)}
              />
            </div>
          </div>
        </DrawerCard>

        {/* ── 7. Observações ── */}
        <DrawerCard title="Observações" icon={FileText}>
          <textarea
            name="internal_notes"
            className={`${INPUT} min-h-[80px] resize-none`}
            rows={3}
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Observações internas sobre o aluno..."
          />
        </DrawerCard>

        {/* ── 8. Documentos ── */}
        <DrawerCard title="Documentos" icon={Paperclip}>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 dark:text-gray-400
              file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
              file:text-xs file:font-medium file:bg-brand-primary/10 file:text-brand-primary
              hover:file:bg-brand-primary/20 cursor-pointer"
          />
          <p className="text-xs text-gray-400">PDF, JPG ou PNG — máx. 5 MB cada</p>

          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-1.5"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="ml-2 text-red-400 hover:text-red-500 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DrawerCard>
      </form>

      {cropPhotoSrc && (
        <ImageCropModal
          src={cropPhotoSrc}
          onSave={(dataUrl) => { setPendingPhotoDataUrl(dataUrl); setCropPhotoSrc(null); }}
          onClose={() => setCropPhotoSrc(null)}
        />
      )}

      <CapacityOverrideModal
        open={!!capacityModal}
        onClose={() => setCapacityModal(null)}
        canOverride={canOverrideCapacity}
        currentCount={capacityModal?.current ?? 0}
        maxStudents={capacityModal?.max ?? 0}
        className={capacityModal?.className}
        onConfirm={async () => {
          setCapacityModal(null);
          setSaving(true);
          await runSubmit(true);
        }}
      />
    </Drawer>
  );
}

// ── Role hierarchy ──
export const ROLES = ['super_admin', 'admin', 'coordinator', 'teacher', 'student', 'user'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  coordinator: 'Coordenador(a)',
  teacher: 'Professor(a)',
  student: 'Aluno(a)',
  user: 'Usuário',
};

/** Roles that can access /admin */
export const ADMIN_ROLES: Role[] = ['super_admin', 'admin', 'coordinator'];

// ── Profile (mirrors profiles table) ──
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  phone?: string | null;
  sector_keys: string[];          // visit reason keys assigned to this user
  is_active: boolean;
  must_change_password: boolean;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Password Policy ──
export interface PasswordPolicy {
  min_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special: boolean;
  /** 0 = never expires */
  password_lifetime_days: number;
  /** 0 = no restriction */
  password_history_count: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  min_length: 8,
  require_uppercase: false,
  require_lowercase: false,
  require_numbers: false,
  require_special: false,
  password_lifetime_days: 0,
  password_history_count: 0,
};

// ── System Settings ──
export interface SystemSetting {
  id: string;
  key: string;
  value: unknown; // jsonb — can be string, object, array, etc.
  category: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ── Confirmation Tracking ──
export type ConfirmationStatus = 'none' | 'awaiting' | 'confirmed' | 'cancelled';

export interface ConfirmationTracking {
  id: string;
  wa_message_id: string;
  appointment_id: string;
  template_id: string | null;
  phone: string;
  sent_at: string;
  responded_at: string | null;
  response_button_id: string | null;
  response_button_text: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'ignored';
  created_at: string;
}

// ── Visit Appointment ──
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'comparecimento';

export interface VisitAppointment {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  visit_reason: string;
  companions: unknown[];
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  internal_notes: string | null;
  origin: 'website' | 'internal' | 'in_person';
  contact_request_id: string | null;
  enrollment_id: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  reminder_sent: boolean;
  confirmation_sent: boolean;
  confirmation_status: ConfirmationStatus;
  created_at: string;
}

// ── Enrollment ──
export type EnrollmentStatus =
  | 'new' | 'under_review' | 'docs_pending' | 'docs_received'
  | 'interview_scheduled' | 'approved' | 'confirmed' | 'archived'
  | 'pending' | 'rejected';

export interface Enrollment {
  id: string;
  status: EnrollmentStatus;
  origin: 'website' | 'in_person' | 'phone' | 'referral';
  enrollment_number: string | null;
  segment: string | null;
  tags: string[];
  internal_notes: string | null;
  // Guardian
  guardian_name: string;
  guardian_cpf: string;
  guardian_phone: string;
  guardian_email: string | null;
  guardian_zip_code: string;
  guardian_street: string;
  guardian_number: string;
  guardian_complement: string | null;
  guardian_neighborhood: string;
  guardian_city: string;
  guardian_state: string;
  // Student
  student_name: string;
  student_birth_date: string;
  student_cpf: string | null;
  // Parents
  father_name: string;
  father_cpf: string;
  father_phone: string;
  father_email: string | null;
  mother_name: string;
  mother_cpf: string;
  mother_phone: string;
  mother_email: string | null;
  // School history
  first_school: boolean;
  last_grade: string | null;
  previous_school_name: string | null;
  // Admin
  reviewed_by: string | null;
  reviewed_at: string | null;
  confirmed_at: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  docs_checklist: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

// ── Contact Request ──
export type ContactStatus = 'new' | 'first_contact' | 'follow_up' | 'resolved' | 'archived' | 'contacted' | 'converted' | 'closed';

export interface ContactRequest {
  id: string;
  status: ContactStatus;
  name: string;
  phone: string;
  email: string | null;
  contact_reason: string | null;
  contact_via: string | null;
  message: string | null;
  best_time: string | null;
  segment_interest: string | null;
  student_count: string | null;
  how_found_us: string | null;
  wants_visit: boolean;
  is_lead: boolean;
  tags: string[];
  internal_notes: string | null;
  next_contact_date: string | null;
  assigned_to: string | null;
  converted_to_enrollment_id: string | null;
  converted_to_appointment_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Notification ──
export type NotificationType = 'new_appointment' | 'new_enrollment' | 'new_contact' | 'status_change' | 'wa_disconnected';

export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  related_module: string | null;
  related_record_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ── WhatsApp Template ──
export type TemplateCategory = string;
export type MessageType      = 'text' | 'media' | 'buttons' | 'list';

// ── Button types matching UazAPI v2 /send/menu format ──
export type TemplateButtonType = 'reply' | 'url' | 'copy' | 'call';

export interface TemplateButton {
  id:    string;
  text:  string;
  type:  TemplateButtonType;
  /** URL for 'url' type, phone for 'call', text to copy for 'copy', payload id for 'reply' */
  value: string;
}

// ── Pix key types matching UazAPI v2 /send/pix-button ──
export type PixKeyType = 'CPF' | 'CNPJ' | 'PHONE' | 'EMAIL' | 'EVP';

export interface TemplateContent {
  body?:          string;
  footer_text?:   string;

  // ── Media fields ──
  media_url?:     string;
  media_type?:    'image' | 'video' | 'document' | 'audio';
  media_source?:  'url' | 'upload';
  doc_name?:      string;

  // ── Shared image for buttons/list (imageButton in /send/menu) ──
  image_url?:     string;

  // ── Button fields (type: "button" in /send/menu) ──
  buttons?:       TemplateButton[];

  // ── List fields (type: "list" in /send/menu) ──
  list_button_text?: string;
  list_sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;

  // ── Pix button fields (/send/pix-button) ──
  pix_type?:      PixKeyType;
  pix_key?:       string;
  pix_name?:      string;
}

export interface WhatsAppTemplate {
  id:                    string;
  name:                  string;
  category:              TemplateCategory;
  message_type:          MessageType;
  content:               TemplateContent;
  variables:             string[];
  trigger_event:         'on_create' | 'on_status_change' | 'on_reminder' | null;
  trigger_conditions:    Record<string, unknown> | null;
  trigger_delay_minutes: number;
  is_active:             boolean;
  created_by:            string | null;
  created_at:            string;
  updated_at:            string;
}

// ── WhatsApp Message Log ──
export type MessageLogStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export interface WhatsAppMessageLog {
  id:               string;
  template_id:      string | null;
  recipient_phone:  string;
  recipient_name:   string | null;
  rendered_content: { body?: string; type?: string };
  variables_used:   Record<string, string> | null;
  wa_message_id:    string | null;
  status:           MessageLogStatus;
  error_message:    string | null;
  sent_at:          string | null;
  delivered_at:     string | null;
  read_at:          string | null;
  sent_by:          string | null;
  related_module:   string | null;
  related_record_id: string | null;
  created_at:       string;
  // joined
  template?:          { name: string; category: string } | null;
  sent_by_profile?:   { full_name: string } | null;
}

// ── Navigation ──
export interface NavItem {
  key: string;
  label: string;
  icon: string;          // Lucide icon name
  path: string;
  roles: Role[];         // legacy fallback — used when permissions haven't loaded yet
  moduleKey?: string;    // maps to modules.key for granular permission check
  badge?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── School Segment ──
export interface SchoolSegment {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coordinator_ids: string[];
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── School Class ──
export type Shift = 'morning' | 'afternoon' | 'full';

export interface SchoolClass {
  id: string;
  segment_id: string;
  name: string;
  year: number;
  shift: Shift | null;
  max_students: number | null;
  teacher_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Student ──
export type StudentStatus = 'active' | 'transferred' | 'graduated' | 'inactive';

export interface Student {
  id: string;
  user_id: string | null;
  enrollment_number: string;
  enrollment_id: string | null;
  class_id: string | null;
  full_name: string;
  birth_date: string | null;
  cpf: string | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string | null;
  status: StudentStatus;
  enrolled_at: string;
  created_at: string;
  updated_at: string;
  // Guardian address
  guardian_cpf: string | null;
  guardian_zip_code: string | null;
  guardian_street: string | null;
  guardian_number: string | null;
  guardian_complement: string | null;
  guardian_neighborhood: string | null;
  guardian_city: string | null;
  guardian_state: string | null;
  // Student address
  student_zip_code: string | null;
  student_street: string | null;
  student_number: string | null;
  student_complement: string | null;
  student_neighborhood: string | null;
  student_city: string | null;
  student_state: string | null;
  // School history
  first_school: boolean;
  last_grade: string | null;
  previous_school_name: string | null;
  segment: string | null;
  // Parents
  father_name: string | null;
  father_cpf: string | null;
  father_phone: string | null;
  father_email: string | null;
  mother_name: string | null;
  mother_cpf: string | null;
  mother_phone: string | null;
  mother_email: string | null;
  // Extra
  internal_notes: string | null;
  origin: string | null;
  document_urls: string[];
  // joined
  class?: SchoolClass | null;
  segment_rel?: SchoolSegment | null;
}

// ── Import Template ──
export interface ImportTemplateMapping { column: string; field: string; position: number; }
export interface ImportTemplate {
  id: string;
  name: string;
  description: string | null;
  target_table: string;
  mapping: ImportTemplateMapping[];
  created_by: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export const SHIFT_LABELS: Record<Shift, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  full: 'Integral',
};

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: 'Ativo',
  transferred: 'Transferido',
  graduated: 'Formado',
  inactive: 'Inativo',
};

// ── Class Material ────────────────────────────────────────────────────────────
export interface ClassMaterial {
  id: string;
  class_id: string;
  created_by: string;
  title: string;
  description: string | null;
  subject: string | null;
  external_url: string | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  creator?: { full_name: string | null } | null;
}

// ── Activity ──────────────────────────────────────────────────────────────────
export type ActivityType   = 'homework' | 'test' | 'project' | 'quiz' | 'other';
export type ActivityStatus = 'draft' | 'published' | 'closed';

export interface Activity {
  id: string;
  class_id: string;
  created_by: string;
  title: string;
  description: string | null;
  subject: string | null;
  type: ActivityType;
  status: ActivityStatus;
  due_date: string | null;
  max_score: number | null;
  created_at: string;
  updated_at: string;
  creator?: { full_name: string | null } | null;
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  homework: 'Lição de Casa',
  test:     'Prova',
  project:  'Projeto',
  quiz:     'Quiz',
  other:    'Outro',
};

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  draft:     'Rascunho',
  published: 'Publicada',
  closed:    'Encerrada',
};

// ── Grade ─────────────────────────────────────────────────────────────────────
export interface Grade {
  id: string;
  student_id: string;
  class_id: string;
  created_by: string;
  subject: string;
  period: string;
  activity_id: string | null;
  score: number;
  max_score: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  student?: { full_name: string; enrollment_number: string } | null;
  activity?: { title: string } | null;
}

// ── Attendance ────────────────────────────────────────────────────────────────
export type AttendanceStatus = 'present' | 'absent' | 'justified' | 'late';

export interface Attendance {
  id: string;
  student_id: string;
  class_id: string;
  created_by: string;
  date: string;
  status: AttendanceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  student?: { full_name: string; enrollment_number: string } | null;
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present:   'Presente',
  absent:    'Falta',
  justified: 'Justificada',
  late:      'Atraso',
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present:   'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  absent:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  justified: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  late:      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
};

// ── Library Resources (F5.4) ──────────────────────────────────────────────────

export type ResourceType = 'book' | 'article' | 'video' | 'link' | 'document';

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  book:     'Livro',
  article:  'Artigo',
  video:    'Vídeo',
  link:     'Link',
  document: 'Documento',
};

export const RESOURCE_TYPE_ICONS: Record<ResourceType, string> = {
  book:     'BookMarked',
  article:  'FileText',
  video:    'Video',
  link:     'Link2',
  document: 'File',
};

export type ResourceSubtype =
  | 'link'         // external URL (default)
  | 'youtube'      // YouTube embed
  | 'pdf'          // Supabase Storage PDF
  | 'image'        // Supabase Storage image
  | 'video_upload';// Supabase Storage video

export type LibraryTargetType = 'all' | 'segment' | 'class' | 'student';

export const LIBRARY_TARGET_LABELS: Record<LibraryTargetType, string> = {
  all:     'Todos',
  segment: 'Segmento',
  class:   'Turma',
  student: 'Aluno específico',
};

export interface LibraryResource {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  resource_type: ResourceType;
  resource_subtype: ResourceSubtype;
  subject: string | null;
  segment_ids: string[];
  class_ids: string[];
  student_ids: string[];
  external_url: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  target_type: LibraryTargetType;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  creator?: { full_name: string } | null;
}

// ── Announcements (F5.5) ──────────────────────────────────────────────────────

export type AnnouncementTarget = 'all' | 'segment' | 'class' | 'role';

export const ANNOUNCEMENT_TARGET_LABELS: Record<AnnouncementTarget, string> = {
  all:     'Todos',
  segment: 'Segmento',
  class:   'Turma',
  role:    'Cargo',
};

export interface Announcement {
  id: string;
  created_by: string;
  title: string;
  body: string;
  target_type: AnnouncementTarget;
  target_ids: string[];
  target_roles: string[];
  send_whatsapp: boolean;
  whatsapp_template_id: string | null;
  publish_at: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  creator?: { full_name: string } | null;
  reads?: { user_id: string }[];
}

// ── School Events (F5.6) ──────────────────────────────────────────────────────

export type EventTargetType = 'all' | 'segment' | 'class' | 'role';

export const EVENT_TARGET_LABELS: Record<EventTargetType, string> = {
  all:     'Todos',
  segment: 'Segmento',
  class:   'Turma',
  role:    'Cargo',
};

export type RsvpStatus = 'confirmed' | 'declined' | 'maybe';

export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  confirmed: 'Confirmado',
  declined:  'Recusado',
  maybe:     'Talvez',
};

export interface SchoolEvent {
  id:                     string;
  created_by:             string | null;
  title:                  string;
  description:            string | null;
  location:               string | null;
  event_date:             string;      // DATE as ISO string
  start_time:             string | null;
  end_time:               string | null;
  target_type:            EventTargetType;
  target_ids:             string[];
  target_roles:           string[];
  send_whatsapp_reminder: boolean;
  reminder_sent_at:       string | null;
  is_published:           boolean;
  created_at:             string;
  updated_at:             string;
  creator?:               { full_name: string } | null;
  rsvps?:                 { status: RsvpStatus }[];
}

export interface EventRsvp {
  id:           string;
  event_id:     string;
  student_id:   string;
  status:       RsvpStatus;
  responded_at: string;
}

// ── Attendance Module (F2.4) ──
export type AttendanceTicketStatus =
  | 'waiting'
  | 'called'
  | 'in_service'
  | 'finished'
  | 'abandoned'
  | 'no_show';

export interface AttendanceTicket {
  id: string;
  ticket_number: string;
  sector_key: string;
  sector_label: string;
  appointment_id: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  status: AttendanceTicketStatus;
  issued_at: string;
  called_at: string | null;
  service_started_at: string | null;
  finished_at: string | null;
  called_by: string | null;
  served_by: string | null;
  wait_seconds: number | null;
  service_seconds: number | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkin_distance_m: number | null;
  feedback_id: string | null;
  notes: string | null;
  // Transfer fields
  transferred_from_sector_key: string | null;
  transferred_from_sector_label: string | null;
  transfer_reason: string | null;
  transferred_at: string | null;
  transferred_by: string | null;
  priority_group: 0 | 1 | 2;
  scheduled_time: string | null;
  created_at: string;
}

export interface AttendanceTransferConfig {
  enabled: boolean;
  quick_reasons: string[];
}

export interface AttendanceTransferHistoryEntry {
  id: string;
  ticket_id: string;
  from_sector_key: string;
  from_sector_label: string;
  to_sector_key: string;
  to_sector_label: string;
  reason: string | null;
  transferred_by: string | null;
  created_at: string;
}

export interface AttendancePriorityQueueConfig {
  enabled: boolean;
  window_minutes_before: number;
  window_minutes_after: number;
  show_type_indicator: boolean;
}

export interface AttendanceHistoryEntry {
  id: string;
  ticket_id: string;
  event_type: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AttendanceFeedback {
  id: string;
  ticket_id: string;
  rating: number | null;
  answers: Record<string, unknown>;
  comments: string | null;
  submitted_at: string;
}

/**
 * Multi-select: mais de uma regra pode estar ativa ao mesmo tempo
 * (same_day + future, por exemplo). `any` quando true sobrescreve as
 * demais — qualquer data é aceita. Valores legados com o campo `mode`
 * são normalizados via `normalizeEligibilityRules()` no load.
 */
export interface AttendanceEligibilityRules {
  same_day: boolean;
  future: boolean;
  past_limited: boolean;
  any: boolean;
  past_days_limit: number;
  future_days_limit: number;
}

export interface AttendanceTicketFormat {
  prefix_mode: 'none' | 'sector' | 'custom';
  custom_prefix: string;
  digits: number;
  per_sector_counter: boolean;
  daily_reset: boolean;
}

export interface AttendanceSoundConfig {
  enabled: boolean;
  preset: 'bell' | 'chime' | 'ding' | 'buzzer';
}

export interface AttendanceClientScreenFields {
  show_last_called: boolean;
  show_sector: boolean;
  show_wait_estimate: boolean;
  show_instructions: boolean;
  instructions_text: string;
}

/**
 * Tipos de pergunta suportados pelo feedback pós-atendimento.
 * - `rating`        estrelas 1..N
 * - `text`          resposta livre em texto
 * - `single_choice` radio: usuário escolhe 1 opção (renderizado como botões)
 * - `multi_choice`  checkbox: usuário escolhe N opções (renderizado como botões)
 * - `scale`         slider numérico (ex: NPS 0-10)
 * - `yes_no`        atalho: Sim / Não (dois botões)
 * - `emoji`         escala visual 1..5 com emojis
 */
export type AttendanceQuestionType =
  | 'rating'
  | 'text'
  | 'single_choice'
  | 'multi_choice'
  | 'scale'
  | 'yes_no'
  | 'emoji';

export interface AttendanceQuestionBase {
  id: string;
  label: string;
  type: AttendanceQuestionType;
}

export interface AttendanceQuestionRating extends AttendanceQuestionBase {
  type: 'rating';
  /** Quantidade de estrelas. Default 5. */
  max?: number;
}

export interface AttendanceQuestionText extends AttendanceQuestionBase {
  type: 'text';
}

export interface AttendanceQuestionSingleChoice extends AttendanceQuestionBase {
  type: 'single_choice';
  options: string[];
}

export interface AttendanceQuestionMultiChoice extends AttendanceQuestionBase {
  type: 'multi_choice';
  options: string[];
}

export interface AttendanceQuestionScale extends AttendanceQuestionBase {
  type: 'scale';
  min: number;
  max: number;
  step?: number;
  /** Rótulos opcionais exibidos nas extremidades do slider. */
  min_label?: string;
  max_label?: string;
}

export interface AttendanceQuestionYesNo extends AttendanceQuestionBase {
  type: 'yes_no';
}

export interface AttendanceQuestionEmoji extends AttendanceQuestionBase {
  type: 'emoji';
}

export type AttendanceQuestion =
  | AttendanceQuestionRating
  | AttendanceQuestionText
  | AttendanceQuestionSingleChoice
  | AttendanceQuestionMultiChoice
  | AttendanceQuestionScale
  | AttendanceQuestionYesNo
  | AttendanceQuestionEmoji;

/**
 * Shape das respostas enviadas ao backend (campo `answers` do
 * attendance_feedback). Chave = question.id, valor depende do tipo:
 * - rating|scale|emoji       → number
 * - text|single_choice|yes_no → string
 * - multi_choice             → string[]
 */
export type AttendanceAnswerValue = number | string | string[];

export interface AttendanceFeedbackConfig {
  enabled: boolean;
  /** Texto exibido ao cliente logo acima da escala de avaliação. */
  prompt_text: string;
  scale: 'stars' | 'numeric';
  max: number;
  allow_comments: boolean;
  /** Quando false, a lista de `questions` é ignorada pelo formulário. */
  custom_questions_enabled: boolean;
  questions: AttendanceQuestion[];
}

export type TicketEffect = 'glow' | 'slide' | 'bounce' | 'neon';

export interface DisplayPanelConfig {
  password: string;
  show_history: boolean;
  show_visitor_name: boolean;
  ticket_effect: TicketEffect;
  sound_preset: 'bell' | 'chime' | 'ding' | 'buzzer';
  sound_repeat: number;
  history_count: number;
  sector_filter: string[];
  theme: 'dark-blue' | 'dark-green' | 'dark-gold' | 'light';
}

export interface InstitutionGeolocation {
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
}

// ── Financial Module (Fase 8) ────────────────────────────────────────────────

export type FinancialContractStatus = 'draft' | 'active' | 'suspended' | 'cancelled' | 'concluded';
export type FinancialInstallmentStatus = 'pending' | 'paid' | 'overdue' | 'negotiated' | 'cancelled' | 'renegotiated';
export type PaymentMethod = 'boleto' | 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'transfer' | 'other';
export type GatewayProvider = 'manual' | 'asaas' | 'efi' | 'iugu' | 'pagarme' | 'vindi' | 'pagseguro' | 'mercadopago' | 'sicredi';
export type GatewayEnvironment = 'sandbox' | 'production';

export interface FinancialPlan {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  installments: number;
  due_day: number;
  max_overdue_days: number;
  late_fee_pct: number;
  interest_rate_pct: number;
  segment_ids: string[];
  school_year: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialContract {
  id: string;
  student_id: string;
  plan_id: string;
  school_year: number;
  status: FinancialContractStatus;
  net_amount: number | null;
  gateway_id: string | null;
  notes: string | null;
  signed_document_url: string | null;
  signed_document_path: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  student?: { full_name: string; enrollment_number: string; class_id: string | null } | null;
  plan?: FinancialPlan | null;
}

export interface FinancialInstallment {
  id: string;
  contract_id: string;
  student_id: string;
  installment_number: number;
  reference_month: string;
  due_date: string;
  amount: number;
  amount_with_discount: number | null;
  status: FinancialInstallmentStatus;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: PaymentMethod | null;
  payment_notes: string | null;
  gateway_id: string | null;
  provider_charge_id: string | null;
  boleto_url: string | null;
  pix_code: string | null;
  payment_link: string | null;
  gateway_fee_cents: number | null;
  late_fee_amount: number;
  interest_amount: number;
  total_due: number | null;
  created_at: string;
  updated_at: string;
  // Joins
  student?: { full_name: string; enrollment_number: string } | null;
  contract?: { school_year: number; plan?: { name: string } | null } | null;
}

export interface PaymentGateway {
  id: string;
  provider: GatewayProvider;
  label: string;
  is_active: boolean;
  is_default: boolean;
  environment: GatewayEnvironment;
  credentials: Record<string, string>;
  webhook_secret: string | null;
  supported_methods: string[];
  created_at: string;
  updated_at: string;
}

export const CONTRACT_STATUS_LABELS: Record<FinancialContractStatus, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  suspended: 'Suspenso',
  cancelled: 'Cancelado',
  concluded: 'Concluído',
};

export const CONTRACT_STATUS_COLORS: Record<FinancialContractStatus, string> = {
  draft: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  active: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  suspended: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  concluded: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
};

export const INSTALLMENT_STATUS_LABELS: Record<FinancialInstallmentStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencida',
  negotiated: 'Negociada',
  cancelled: 'Cancelada',
  renegotiated: 'Renegociada',
};

export const INSTALLMENT_STATUS_COLORS: Record<FinancialInstallmentStatus, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  paid: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  overdue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  negotiated: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  renegotiated: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
};

export const GATEWAY_PROVIDER_LABELS: Record<GatewayProvider, string> = {
  manual: 'Manual (sem gateway)',
  asaas: 'Asaas',
  efi: 'Efí (Gerencianet)',
  iugu: 'Iugu',
  pagarme: 'Pagar.me',
  vindi: 'Vindi',
  pagseguro: 'PagSeguro',
  mercadopago: 'Mercado Pago',
  sicredi: 'Sicredi',
};

// ═══════════════════════════════════════════════════════════════════════════
// FINANCIAL — Descontos, Bolsas e Templates (v2)
// ═══════════════════════════════════════════════════════════════════════════

export type DiscountScope = 'global' | 'group' | 'student';
export type DiscountType = 'percentage' | 'fixed';

export interface ProgressiveDiscountRule {
  days_before_due: number;
  percentage: number;
}

export interface FinancialDiscount {
  id: string;
  name: string;
  description: string | null;
  scope: DiscountScope;
  plan_id: string | null;
  segment_id: string | null;
  class_id: string | null;
  student_id: string | null;
  discount_type: DiscountType;
  discount_value: number;
  progressive_rules: ProgressiveDiscountRule[];
  valid_from: string | null;
  valid_until: string | null;
  reason: string | null;
  priority: number;
  is_cumulative: boolean;
  school_year: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joins opcionais
  plan?: FinancialPlan | null;
  segment?: { id: string; name: string } | null;
  class_info?: { id: string; name: string } | null;
  student?: { id: string; full_name: string } | null;
}

export type ScholarshipType = 'percentage' | 'fixed' | 'full';
export type ScholarshipStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface FinancialScholarship {
  id: string;
  student_id: string;
  name: string;
  description: string | null;
  scholarship_type: ScholarshipType;
  scholarship_value: number;
  valid_from: string;
  valid_until: string;
  category: string;
  justification: string | null;
  document_url: string | null;
  status: ScholarshipStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  school_year: number;
  is_renewable: boolean;
  renewed_from: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joins opcionais
  student?: { id: string; full_name: string } | null;
}

export type ContractTemplateType = 'contract' | 'receipt' | 'boleto' | 'enrollment_form' | 'termination';

export interface ContractTemplateVariable {
  key: string;
  label: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string | null;
  template_type: ContractTemplateType;
  content: string;
  variables: ContractTemplateVariable[];
  style_config: Record<string, unknown>;
  segment_ids: string[];
  plan_ids: string[];
  is_default: boolean;
  is_active: boolean;
  school_year: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const DISCOUNT_SCOPE_LABELS: Record<DiscountScope, string> = {
  global: 'Global',
  group: 'Grupo',
  student: 'Aluno',
};

export const DISCOUNT_SCOPE_COLORS: Record<DiscountScope, string> = {
  global: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  group: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  student: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
};

export const SCHOLARSHIP_STATUS_LABELS: Record<ScholarshipStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
};

export const SCHOLARSHIP_STATUS_COLORS: Record<ScholarshipStatus, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  approved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  expired: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

export const SCHOLARSHIP_TYPE_LABELS: Record<ScholarshipType, string> = {
  percentage: 'Porcentagem',
  fixed: 'Valor fixo',
  full: 'Integral (100%)',
};

export const SCHOLARSHIP_CATEGORY_LABELS: Record<string, string> = {
  merito: 'Mérito',
  social: 'Social',
  filantropia: 'Filantropia',
  convenio: 'Convênio',
  irmao: 'Irmão',
  funcionario: 'Funcionário',
  outro: 'Outro',
};

export const CONTRACT_TEMPLATE_TYPE_LABELS: Record<ContractTemplateType, string> = {
  contract: 'Contrato',
  receipt: 'Recibo',
  boleto: 'Boleto',
  enrollment_form: 'Ficha de Matrícula',
  termination: 'Rescisão',
};

// ═══════════════════════════════════════════════════════════════════════════
// ACADEMIC — Fase 9
// ═══════════════════════════════════════════════════════════════════════════

// ── Enums ────────────────────────────────────────────────────────────────

export type CalendarEventType =
  | 'holiday'
  | 'exam_period'
  | 'recess'
  | 'deadline'
  | 'institutional'
  | 'period_start'
  | 'period_end';

export type FormulaType = 'simple' | 'weighted' | 'by_period' | 'custom';

export type GradeScale = 'numeric' | 'conceptual';

export type StudentResultStatus =
  | 'approved'
  | 'recovery'
  | 'failed_grade'
  | 'failed_attendance'
  | 'in_progress';

// ── Interfaces ───────────────────────────────────────────────────────────

export interface Discipline {
  id: string;
  name: string;
  code: string;
  weekly_hours: number;
  color: string;
  segment_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassDiscipline {
  id: string;
  class_id: string;
  discipline_id: string;
  teacher_id: string;
  created_at: string;
  // Joined
  discipline?: Discipline;
  teacher?: { id: string; full_name: string; avatar_url?: string };
}

export interface ClassSchedule {
  id: string;
  class_id: string;
  discipline_id: string;
  teacher_id: string;
  day_of_week: number; // 0=Dom ... 6=Sab
  start_time: string;  // "HH:mm:ss"
  end_time: string;    // "HH:mm:ss"
  created_at: string;
  // Joined
  discipline?: Discipline;
  teacher?: { id: string; full_name: string };
}

export interface SchoolCalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  start_date: string;
  end_date: string;
  school_year: number;
  period_number: number | null;
  segment_ids: string[];
  description: string | null;
  created_at: string;
}

export interface GradeFormula {
  id: string;
  segment_id: string;
  school_year: number;
  formula_type: FormulaType;
  config: Record<string, unknown>;
  passing_grade: number;
  recovery_grade: number;
  min_attendance_pct: number;
  grade_scale: GradeScale;
  created_at: string;
  updated_at: string;
  // Joined
  segment?: { id: string; name: string };
}

export interface StudentResult {
  id: string;
  student_id: string;
  discipline_id: string;
  class_id: string;
  school_year: number;
  period1_avg: number | null;
  period2_avg: number | null;
  period3_avg: number | null;
  period4_avg: number | null;
  recovery_grade: number | null;
  final_avg: number | null;
  attendance_pct: number | null;
  result: StudentResultStatus;
  created_at: string;
  updated_at: string;
  // Joined
  student?: { id: string; full_name: string; enrollment_number: string };
  discipline?: Discipline;
}

export interface StudentTranscript {
  id: string;
  student_id: string;
  school_year: number;
  class_id: string;
  segment_id: string;
  final_result: string;
  created_at: string;
  // Joined
  student?: { id: string; full_name: string; enrollment_number: string };
  segment?: { id: string; name: string };
  class?: { id: string; name: string };
}

// ── Labels & Colors ──────────────────────────────────────────────────────

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

export const DAY_OF_WEEK_SHORT: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  holiday: 'Feriado',
  exam_period: 'Período de Provas',
  recess: 'Recesso',
  deadline: 'Prazo',
  institutional: 'Institucional',
  period_start: 'Início de Período',
  period_end: 'Fim de Período',
};

export const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  holiday: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  exam_period: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  recess: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  deadline: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  institutional: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  period_start: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  period_end: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
};

export const FORMULA_TYPE_LABELS: Record<FormulaType, string> = {
  simple: 'Média Simples',
  weighted: 'Média Ponderada',
  by_period: 'Por Período',
  custom: 'Personalizada',
};

export const RESULT_STATUS_LABELS: Record<StudentResultStatus, string> = {
  approved: 'Aprovado',
  recovery: 'Recuperação',
  failed_grade: 'Reprovado (Nota)',
  failed_attendance: 'Reprovado (Falta)',
  in_progress: 'Em Andamento',
};

export const RESULT_STATUS_COLORS: Record<StudentResultStatus, string> = {
  approved: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  recovery: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  failed_grade: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  failed_attendance: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
};

export const GRADE_SCALE_LABELS: Record<GradeScale, string> = {
  numeric: 'Numérica (0-10)',
  conceptual: 'Conceitual (A-E)',
};


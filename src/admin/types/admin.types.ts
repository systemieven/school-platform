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
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  phone?: string | null;
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
  roles: Role[];         // roles that can see this item
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
  // joined
  class?: SchoolClass | null;
  segment?: SchoolSegment | null;
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
  created_at: string;
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
}

export interface AttendanceTicketFormat {
  prefix_mode: 'none' | 'sector' | 'custom';
  custom_prefix: string;
  digits: number;
  per_sector_counter: boolean;
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

export interface AttendanceFeedbackConfig {
  enabled: boolean;
  scale: 'stars' | 'numeric';
  max: number;
  allow_comments: boolean;
  questions: Array<{ id: string; label: string; type: 'rating' | 'text' }>;
}

export interface InstitutionGeolocation {
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
}


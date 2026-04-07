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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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

// ── Visit Appointment ──
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

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
  origin: 'website' | 'internal';
  contact_request_id: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  reminder_sent: boolean;
  confirmation_sent: boolean;
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
export type TemplateCategory = 'agendamento' | 'matricula' | 'contato' | 'geral' | 'boas_vindas';
export type MessageType      = 'text' | 'media' | 'buttons' | 'list';

export interface TemplateContent {
  body?:          string;
  media_url?:     string;
  media_type?:    'image' | 'video' | 'document' | 'audio';
  buttons?:       Array<{ id: string; text: string }>;
  list_title?:    string;
  list_sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
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

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _webhook_debug: {
        Row: {
          created_at: string | null
          event: string | null
          id: number
          raw_update: Json | null
          status_code: number | null
          track_id: string | null
          wa_key_id: string | null
        }
        Insert: {
          created_at?: string | null
          event?: string | null
          id?: number
          raw_update?: Json | null
          status_code?: number | null
          track_id?: string | null
          wa_key_id?: string | null
        }
        Update: {
          created_at?: string | null
          event?: string | null
          id?: number
          raw_update?: Json | null
          status_code?: number | null
          track_id?: string | null
          wa_key_id?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          max_score: number | null
          status: string
          subject: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          max_score?: number | null
          status?: string
          subject?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          max_score?: number | null
          status?: string
          subject?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          publish_at: string
          send_whatsapp: boolean
          target_ids: string[] | null
          target_roles: string[] | null
          target_type: string
          title: string
          updated_at: string
          whatsapp_template_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          publish_at?: string
          send_whatsapp?: boolean
          target_ids?: string[] | null
          target_roles?: string[] | null
          target_type?: string
          title: string
          updated_at?: string
          whatsapp_template_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          publish_at?: string
          send_whatsapp?: boolean
          target_ids?: string[] | null
          target_roles?: string[] | null
          target_type?: string
          title?: string
          updated_at?: string
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_whatsapp_template_id_fkey"
            columns: ["whatsapp_template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_history: {
        Row: {
          appointment_id: string
          created_at: string
          created_by: string | null
          description: string
          event_type: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          created_by?: string | null
          description: string
          event_type: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "visit_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          date: string
          id: string
          notes: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          date: string
          id?: string
          notes?: string | null
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_feedback: {
        Row: {
          answers: Json
          comments: string | null
          id: string
          rating: number | null
          submitted_at: string
          ticket_id: string
        }
        Insert: {
          answers?: Json
          comments?: string | null
          id?: string
          rating?: number | null
          submitted_at?: string
          ticket_id: string
        }
        Update: {
          answers?: Json
          comments?: string | null
          id?: string
          rating?: number | null
          submitted_at?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_feedback_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "attendance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_history: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          event_type: string
          id: string
          new_value: string | null
          old_value: string | null
          ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          event_type: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "attendance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_tickets: {
        Row: {
          appointment_id: string
          called_at: string | null
          called_by: string | null
          checkin_distance_m: number | null
          checkin_lat: number | null
          checkin_lng: number | null
          created_at: string
          feedback_id: string | null
          finished_at: string | null
          id: string
          issued_at: string
          notes: string | null
          priority_group: number
          scheduled_time: string | null
          sector_key: string
          sector_label: string
          served_by: string | null
          service_seconds: number | null
          service_started_at: string | null
          status: string
          ticket_number: string
          transfer_reason: string | null
          transferred_at: string | null
          transferred_by: string | null
          transferred_from_sector_key: string | null
          transferred_from_sector_label: string | null
          visitor_email: string | null
          visitor_name: string
          visitor_phone: string
          wait_seconds: number | null
        }
        Insert: {
          appointment_id: string
          called_at?: string | null
          called_by?: string | null
          checkin_distance_m?: number | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          created_at?: string
          feedback_id?: string | null
          finished_at?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          priority_group?: number
          scheduled_time?: string | null
          sector_key: string
          sector_label: string
          served_by?: string | null
          service_seconds?: number | null
          service_started_at?: string | null
          status?: string
          ticket_number: string
          transfer_reason?: string | null
          transferred_at?: string | null
          transferred_by?: string | null
          transferred_from_sector_key?: string | null
          transferred_from_sector_label?: string | null
          visitor_email?: string | null
          visitor_name: string
          visitor_phone: string
          wait_seconds?: number | null
        }
        Update: {
          appointment_id?: string
          called_at?: string | null
          called_by?: string | null
          checkin_distance_m?: number | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          created_at?: string
          feedback_id?: string | null
          finished_at?: string | null
          id?: string
          issued_at?: string
          notes?: string | null
          priority_group?: number
          scheduled_time?: string | null
          sector_key?: string
          sector_label?: string
          served_by?: string | null
          service_seconds?: number | null
          service_started_at?: string | null
          status?: string
          ticket_number?: string
          transfer_reason?: string | null
          transferred_at?: string | null
          transferred_by?: string | null
          transferred_from_sector_key?: string | null
          transferred_from_sector_label?: string | null
          visitor_email?: string | null
          visitor_name?: string
          visitor_phone?: string
          wait_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_tickets_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "visit_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tickets_called_by_fkey"
            columns: ["called_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tickets_feedback_fk"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "attendance_feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tickets_served_by_fkey"
            columns: ["served_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tickets_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_transfer_history: {
        Row: {
          created_at: string
          from_sector_key: string
          from_sector_label: string
          id: string
          reason: string | null
          ticket_id: string
          to_sector_key: string
          to_sector_label: string
          transferred_by: string | null
        }
        Insert: {
          created_at?: string
          from_sector_key: string
          from_sector_label: string
          id?: string
          reason?: string | null
          ticket_id: string
          to_sector_key: string
          to_sector_label: string
          transferred_by?: string | null
        }
        Update: {
          created_at?: string
          from_sector_key?: string
          from_sector_label?: string
          id?: string
          reason?: string | null
          ticket_id?: string
          to_sector_key?: string
          to_sector_label?: string
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_transfer_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "attendance_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_transfer_history_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          ip_address: unknown
          module: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: unknown
          module?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: unknown
          module?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      class_materials: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          description: string | null
          external_url: string | null
          id: string
          is_visible: boolean
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          description?: string | null
          external_url?: string | null
          id?: string
          is_visible?: boolean
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          external_url?: string | null
          id?: string
          is_visible?: boolean
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_materials_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmation_tracking: {
        Row: {
          appointment_id: string
          created_at: string | null
          delay_minutes: number
          id: string
          phone: string
          responded_at: string | null
          response_button_id: string | null
          response_button_text: string | null
          sent_at: string
          status: string
          template_id: string | null
          wa_message_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string | null
          delay_minutes?: number
          id?: string
          phone: string
          responded_at?: string | null
          response_button_id?: string | null
          response_button_text?: string | null
          sent_at?: string
          status?: string
          template_id?: string | null
          wa_message_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string | null
          delay_minutes?: number
          id?: string
          phone?: string
          responded_at?: string | null
          response_button_id?: string | null
          response_button_text?: string | null
          sent_at?: string
          status?: string
          template_id?: string | null
          wa_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmation_tracking_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "visit_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_tracking_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consented_at: string
          form_type: string
          holder_email: string | null
          holder_name: string | null
          id: string
          ip_address: string | null
          related_record_id: string | null
          user_agent: string | null
        }
        Insert: {
          consented_at?: string
          form_type: string
          holder_email?: string | null
          holder_name?: string | null
          id?: string
          ip_address?: string | null
          related_record_id?: string | null
          user_agent?: string | null
        }
        Update: {
          consented_at?: string
          form_type?: string
          holder_email?: string | null
          holder_name?: string | null
          id?: string
          ip_address?: string | null
          related_record_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      contact_history: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          description: string
          event_type: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          description: string
          event_type: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_requests: {
        Row: {
          assigned_to: string | null
          best_time: string | null
          contact_reason: string | null
          contact_via: string | null
          converted_to_appointment_id: string | null
          converted_to_enrollment_id: string | null
          created_at: string
          email: string | null
          how_found_us: string | null
          id: string
          internal_notes: string | null
          is_lead: boolean
          message: string | null
          name: string
          next_contact_date: string | null
          phone: string
          segment_interest: string | null
          status: string
          student_count: string | null
          tags: string[]
          updated_at: string
          wants_visit: boolean | null
        }
        Insert: {
          assigned_to?: string | null
          best_time?: string | null
          contact_reason?: string | null
          contact_via?: string | null
          converted_to_appointment_id?: string | null
          converted_to_enrollment_id?: string | null
          created_at?: string
          email?: string | null
          how_found_us?: string | null
          id?: string
          internal_notes?: string | null
          is_lead?: boolean
          message?: string | null
          name: string
          next_contact_date?: string | null
          phone: string
          segment_interest?: string | null
          status?: string
          student_count?: string | null
          tags?: string[]
          updated_at?: string
          wants_visit?: boolean | null
        }
        Update: {
          assigned_to?: string | null
          best_time?: string | null
          contact_reason?: string | null
          contact_via?: string | null
          converted_to_appointment_id?: string | null
          converted_to_enrollment_id?: string | null
          created_at?: string
          email?: string | null
          how_found_us?: string | null
          id?: string
          internal_notes?: string | null
          is_lead?: boolean
          message?: string | null
          name?: string
          next_contact_date?: string | null
          phone?: string
          segment_interest?: string | null
          status?: string
          student_count?: string | null
          tags?: string[]
          updated_at?: string
          wants_visit?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_converted_to_appointment_id_fkey"
            columns: ["converted_to_appointment_id"]
            isOneToOne: false
            referencedRelation: "visit_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_requests_converted_to_enrollment_id_fkey"
            columns: ["converted_to_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_documents: {
        Row: {
          created_at: string
          enrollment_id: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          storage_path: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_documents_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_history: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          enrollment_id: string
          event_type: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          enrollment_id: string
          event_type: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          enrollment_id?: string
          event_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_history_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          confirmed_at: string | null
          created_at: string
          docs_checklist: Json
          enrollment_number: string | null
          father_cpf: string
          father_email: string | null
          father_name: string
          father_phone: string
          first_school: boolean
          guardian_city: string
          guardian_complement: string | null
          guardian_cpf: string
          guardian_email: string | null
          guardian_name: string
          guardian_neighborhood: string
          guardian_number: string
          guardian_phone: string
          guardian_state: string
          guardian_street: string
          guardian_zip_code: string
          id: string
          internal_notes: string | null
          last_grade: string | null
          mother_cpf: string
          mother_email: string | null
          mother_name: string
          mother_phone: string
          origin: string
          previous_school_name: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          segment: string | null
          status: string
          student_birth_date: string
          student_city: string
          student_complement: string | null
          student_cpf: string | null
          student_name: string
          student_neighborhood: string
          student_number: string
          student_state: string
          student_street: string
          student_zip_code: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          docs_checklist?: Json
          enrollment_number?: string | null
          father_cpf: string
          father_email?: string | null
          father_name: string
          father_phone?: string
          first_school?: boolean
          guardian_city: string
          guardian_complement?: string | null
          guardian_cpf: string
          guardian_email?: string | null
          guardian_name: string
          guardian_neighborhood: string
          guardian_number: string
          guardian_phone: string
          guardian_state: string
          guardian_street: string
          guardian_zip_code: string
          id?: string
          internal_notes?: string | null
          last_grade?: string | null
          mother_cpf: string
          mother_email?: string | null
          mother_name: string
          mother_phone?: string
          origin?: string
          previous_school_name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          segment?: string | null
          status?: string
          student_birth_date: string
          student_city: string
          student_complement?: string | null
          student_cpf?: string | null
          student_name: string
          student_neighborhood: string
          student_number: string
          student_state: string
          student_street: string
          student_zip_code: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          docs_checklist?: Json
          enrollment_number?: string | null
          father_cpf?: string
          father_email?: string | null
          father_name?: string
          father_phone?: string
          first_school?: boolean
          guardian_city?: string
          guardian_complement?: string | null
          guardian_cpf?: string
          guardian_email?: string | null
          guardian_name?: string
          guardian_neighborhood?: string
          guardian_number?: string
          guardian_phone?: string
          guardian_state?: string
          guardian_street?: string
          guardian_zip_code?: string
          id?: string
          internal_notes?: string | null
          last_grade?: string | null
          mother_cpf?: string
          mother_email?: string | null
          mother_name?: string
          mother_phone?: string
          origin?: string
          previous_school_name?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          segment?: string | null
          status?: string
          student_birth_date?: string
          student_city?: string
          student_complement?: string | null
          student_cpf?: string | null
          student_name?: string
          student_neighborhood?: string
          student_number?: string
          student_state?: string
          student_street?: string
          student_zip_code?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          event_id: string
          id: string
          responded_at: string
          status: string
          student_id: string
        }
        Insert: {
          event_id: string
          id?: string
          responded_at?: string
          status?: string
          student_id: string
        }
        Update: {
          event_id?: string
          id?: string
          responded_at?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "school_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          activity_id: string | null
          class_id: string
          created_at: string
          created_by: string
          id: string
          max_score: number
          notes: string | null
          period: string
          score: number
          student_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          class_id: string
          created_at?: string
          created_by: string
          id?: string
          max_score?: number
          notes?: string | null
          period: string
          score: number
          student_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          class_id?: string
          created_at?: string
          created_by?: string
          id?: string
          max_score?: number
          notes?: string | null
          period?: string
          score?: number
          student_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          created_at: string | null
          description: string | null
          from_stage: string | null
          id: string
          lead_id: string
          performed_by: string | null
          to_stage: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          from_stage?: string | null
          id?: string
          lead_id: string
          performed_by?: string | null
          to_stage?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          from_stage?: string | null
          id?: string
          lead_id?: string
          performed_by?: string | null
          to_stage?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stages: {
        Row: {
          auto_actions: Json | null
          color: string
          id: string
          is_active: boolean | null
          label: string
          name: string
          position: number
        }
        Insert: {
          auto_actions?: Json | null
          color: string
          id?: string
          is_active?: boolean | null
          label: string
          name: string
          position: number
        }
        Update: {
          auto_actions?: Json | null
          color?: string
          id?: string
          is_active?: boolean | null
          label?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          converted_at: string | null
          created_at: string | null
          email: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          name: string
          next_contact_date: string | null
          phone: string
          priority: string
          score: number | null
          segment_interest: string | null
          source_module: string
          source_record_id: string | null
          stage: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          name: string
          next_contact_date?: string | null
          phone: string
          priority?: string
          score?: number | null
          segment_interest?: string | null
          source_module?: string
          source_record_id?: string | null
          stage?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          name?: string
          next_contact_date?: string | null
          phone?: string
          priority?: string
          score?: number | null
          segment_interest?: string | null
          source_module?: string
          source_record_id?: string | null
          stage?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_resources: {
        Row: {
          class_ids: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          external_url: string | null
          file_url: string | null
          id: string
          is_visible: boolean
          resource_subtype: string
          resource_type: string
          segment_ids: string[] | null
          student_ids: string[] | null
          subject: string | null
          target_type: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          class_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_url?: string | null
          file_url?: string | null
          id?: string
          is_visible?: boolean
          resource_subtype?: string
          resource_type?: string
          segment_ids?: string[] | null
          student_ids?: string[] | null
          subject?: string | null
          target_type?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          class_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_url?: string | null
          file_url?: string | null
          id?: string
          is_visible?: boolean
          resource_subtype?: string
          resource_type?: string
          segment_ids?: string[] | null
          student_ids?: string[] | null
          subject?: string | null
          target_type?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          depends_on: string[]
          description: string | null
          group: string
          icon: string | null
          is_active: boolean
          key: string
          label: string
          position: number
        }
        Insert: {
          created_at?: string
          depends_on?: string[]
          description?: string | null
          group?: string
          icon?: string | null
          is_active?: boolean
          key: string
          label: string
          position?: number
        }
        Update: {
          created_at?: string
          depends_on?: string[]
          description?: string | null
          group?: string
          icon?: string | null
          is_active?: boolean
          key?: string
          label?: string
          position?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          enabled_types: string[]
          sound_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          enabled_types?: string[]
          sound_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          enabled_types?: string[]
          sound_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          read_at: string | null
          recipient_id: string
          related_module: string | null
          related_record_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          read_at?: string | null
          recipient_id: string
          related_module?: string | null
          related_record_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          read_at?: string | null
          recipient_id?: string
          related_module?: string | null
          related_record_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      password_history: {
        Row: {
          created_at: string | null
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          must_change_password: boolean
          password_changed_at: string | null
          phone: string | null
          role: string
          sector_keys: string[]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          must_change_password?: boolean
          password_changed_at?: string | null
          phone?: string | null
          role?: string
          sector_keys?: string[]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          password_changed_at?: string | null
          phone?: string | null
          role?: string
          sector_keys?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module_key: string
          role: string
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key: string
          role: string
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
        ]
      }
      school_classes: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          max_students: number | null
          name: string
          segment_id: string
          shift: string | null
          teacher_ids: string[] | null
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          name: string
          segment_id: string
          shift?: string | null
          teacher_ids?: string[] | null
          updated_at?: string | null
          year?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          name?: string
          segment_id?: string
          shift?: string | null
          teacher_ids?: string[] | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_classes_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "school_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      school_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string
          id: string
          is_published: boolean
          location: string | null
          reminder_sent_at: string | null
          send_whatsapp_reminder: boolean
          start_time: string | null
          target_ids: string[]
          target_roles: string[]
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          id?: string
          is_published?: boolean
          location?: string | null
          reminder_sent_at?: string | null
          send_whatsapp_reminder?: boolean
          start_time?: string | null
          target_ids?: string[]
          target_roles?: string[]
          target_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          id?: string
          is_published?: boolean
          location?: string | null
          reminder_sent_at?: string | null
          send_whatsapp_reminder?: boolean
          start_time?: string | null
          target_ids?: string[]
          target_roles?: string[]
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_segments: {
        Row: {
          coordinator_ids: string[] | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          position: number
          slug: string
          updated_at: string | null
        }
        Insert: {
          coordinator_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          position?: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          coordinator_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          position?: number
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          auth_user_id: string | null
          birth_date: string | null
          class_id: string | null
          cpf: string | null
          created_at: string | null
          enrolled_at: string | null
          enrollment_id: string | null
          enrollment_number: string
          full_name: string
          guardian_email: string | null
          guardian_name: string
          guardian_phone: string
          id: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          birth_date?: string | null
          class_id?: string | null
          cpf?: string | null
          created_at?: string | null
          enrolled_at?: string | null
          enrollment_id?: string | null
          enrollment_number: string
          full_name: string
          guardian_email?: string | null
          guardian_name: string
          guardian_phone: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          birth_date?: string | null
          class_id?: string | null
          cpf?: string | null
          created_at?: string | null
          enrolled_at?: string | null
          enrollment_id?: string | null
          enrollment_number?: string
          full_name?: string
          guardian_email?: string | null
          guardian_name?: string
          guardian_phone?: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "school_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          approved_at: string | null
          avatar_url: string | null
          content: string
          created_at: string
          email: string | null
          id: string
          parent_name: string
          provider: string | null
          rating: number
          social_id: string | null
          status: string
          student_grade: string | null
        }
        Insert: {
          approved_at?: string | null
          avatar_url?: string | null
          content: string
          created_at?: string
          email?: string | null
          id?: string
          parent_name: string
          provider?: string | null
          rating?: number
          social_id?: string | null
          status?: string
          student_grade?: string | null
        }
        Update: {
          approved_at?: string | null
          avatar_url?: string | null
          content?: string
          created_at?: string
          email?: string | null
          id?: string
          parent_name?: string
          provider?: string | null
          rating?: number
          social_id?: string | null
          status?: string
          student_grade?: string | null
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string
          granted_by: string | null
          id: string
          module_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string
          granted_by?: string | null
          id?: string
          module_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string
          granted_by?: string | null
          id?: string
          module_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
        ]
      }
      visit_appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          buffer_minutes: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          companions: Json
          confirmation_sent: boolean
          confirmation_status: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          contact_request_id: string | null
          created_at: string
          duration_minutes: number
          enrollment_id: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          origin: string
          reminder_sent: boolean
          reminders_sent: Json
          status: string
          visit_reason: string
          visitor_email: string | null
          visitor_name: string
          visitor_phone: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          buffer_minutes?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          companions?: Json
          confirmation_sent?: boolean
          confirmation_status?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          contact_request_id?: string | null
          created_at?: string
          duration_minutes?: number
          enrollment_id?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          origin?: string
          reminder_sent?: boolean
          reminders_sent?: Json
          status?: string
          visit_reason: string
          visitor_email?: string | null
          visitor_name: string
          visitor_phone: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          buffer_minutes?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          companions?: Json
          confirmation_sent?: boolean
          confirmation_status?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          contact_request_id?: string | null
          created_at?: string
          duration_minutes?: number
          enrollment_id?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          origin?: string
          reminder_sent?: boolean
          reminders_sent?: Json
          status?: string
          visit_reason?: string
          visitor_email?: string | null
          visitor_name?: string
          visitor_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_appointments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_appointments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_appointments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_blocked_dates: {
        Row: {
          blocked_date: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      visit_settings: {
        Row: {
          duration_minutes: number
          end_hour: number
          id: string
          is_active: boolean
          lunch_end: number
          lunch_start: number
          max_companions: number
          reason_key: string
          reason_label: string
          start_hour: number
        }
        Insert: {
          duration_minutes?: number
          end_hour?: number
          id?: string
          is_active?: boolean
          lunch_end?: number
          lunch_start?: number
          max_companions?: number
          reason_key: string
          reason_label: string
          start_hour?: number
        }
        Update: {
          duration_minutes?: number
          end_hour?: number
          id?: string
          is_active?: boolean
          lunch_end?: number
          lunch_start?: number
          max_companions?: number
          reason_key?: string
          reason_label?: string
          start_hour?: number
        }
        Relationships: []
      }
      whatsapp_message_log: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          read_at: string | null
          recipient_name: string | null
          recipient_phone: string
          related_module: string | null
          related_record_id: string | null
          rendered_content: Json
          sent_at: string | null
          sent_by: string | null
          status: string
          template_id: string | null
          variables_used: Json | null
          wa_message_id: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone: string
          related_module?: string | null
          related_record_id?: string | null
          rendered_content?: Json
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          variables_used?: Json | null
          wa_message_id?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          related_module?: string | null
          related_record_id?: string | null
          rendered_content?: Json
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_id?: string | null
          variables_used?: Json | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_providers: {
        Row: {
          api_token: string
          created_at: string | null
          id: string
          instance_url: string
          is_default: boolean
          name: string
          notes: string | null
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          api_token?: string
          created_at?: string | null
          id?: string
          instance_url?: string
          is_default?: boolean
          name: string
          notes?: string | null
          profile_id?: string
          updated_at?: string | null
        }
        Update: {
          api_token?: string
          created_at?: string | null
          id?: string
          instance_url?: string
          is_default?: boolean
          name?: string
          notes?: string | null
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_template_categories: {
        Row: {
          color: string
          created_at: string | null
          id: string
          label: string
          slug: string
          sort_order: number
          updated_at: string | null
          variables: string[]
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          label: string
          slug: string
          sort_order?: number
          updated_at?: string | null
          variables?: string[]
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string | null
          variables?: string[]
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          category: string
          content: Json
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          message_type: string
          name: string
          trigger_conditions: Json | null
          trigger_delay_minutes: number | null
          trigger_event: string | null
          updated_at: string | null
          variables: string[] | null
        }
        Insert: {
          category: string
          content?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          message_type: string
          name: string
          trigger_conditions?: Json | null
          trigger_delay_minutes?: number | null
          trigger_event?: string | null
          updated_at?: string | null
          variables?: string[] | null
        }
        Update: {
          category?: string
          content?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          message_type?: string
          name?: string
          trigger_conditions?: Json | null
          trigger_delay_minutes?: number | null
          trigger_event?: string | null
          updated_at?: string | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_next_ticket: {
        Args: { p_caller_id?: string; p_sector_keys?: string[] }
        Returns: {
          appointment_id: string
          called_at: string | null
          called_by: string | null
          checkin_distance_m: number | null
          checkin_lat: number | null
          checkin_lng: number | null
          created_at: string
          feedback_id: string | null
          finished_at: string | null
          id: string
          issued_at: string
          notes: string | null
          priority_group: number
          scheduled_time: string | null
          sector_key: string
          sector_label: string
          served_by: string | null
          service_seconds: number | null
          service_started_at: string | null
          status: string
          ticket_number: string
          transfer_reason: string | null
          transferred_at: string | null
          transferred_by: string | null
          transferred_from_sector_key: string | null
          transferred_from_sector_label: string | null
          visitor_email: string | null
          visitor_name: string
          visitor_phone: string
          wait_seconds: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "attendance_tickets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      expire_pending_confirmations: { Args: never; Returns: undefined }
      generate_enrollment_number: { Args: never; Returns: string }
      get_effective_permissions: {
        Args: { p_user_id: string }
        Returns: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          module_key: string
        }[]
      }
      is_admin_or_coordinator: { Args: never; Returns: boolean }
      is_teacher_of_class: { Args: { p_class_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_description?: string
          p_module?: string
          p_new_data?: Json
          p_old_data?: Json
          p_record_id?: string
        }
        Returns: string
      }
      next_attendance_ticket_number: {
        Args: { p_format: Json; p_sector_key: string }
        Returns: string
      }
      notify_auto_trigger: {
        Args: {
          p_event: string
          p_module: string
          p_new_status?: string
          p_old_status?: string
          p_record_id: string
        }
        Returns: undefined
      }
      process_visit_reminders: { Args: never; Returns: undefined }
      recall_ticket: {
        Args: { p_caller_id: string; p_ticket_id: string }
        Returns: {
          appointment_id: string
          called_at: string | null
          called_by: string | null
          checkin_distance_m: number | null
          checkin_lat: number | null
          checkin_lng: number | null
          created_at: string
          feedback_id: string | null
          finished_at: string | null
          id: string
          issued_at: string
          notes: string | null
          priority_group: number
          scheduled_time: string | null
          sector_key: string
          sector_label: string
          served_by: string | null
          service_seconds: number | null
          service_started_at: string | null
          status: string
          ticket_number: string
          transfer_reason: string | null
          transferred_at: string | null
          transferred_by: string | null
          transferred_from_sector_key: string | null
          transferred_from_sector_label: string | null
          visitor_email: string | null
          visitor_name: string
          visitor_phone: string
          wait_seconds: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "attendance_tickets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

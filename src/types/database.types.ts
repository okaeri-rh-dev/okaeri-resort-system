export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_roles: {
        Row: {
          email: string;
          granted_at: string;
          granted_by: string | null;
          is_active: boolean;
          notes: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          email: string;
          granted_at?: string;
          granted_by?: string | null;
          is_active?: boolean;
          notes?: string | null;
          role: string;
          user_id: string;
        };
        Update: {
          email?: string;
          granted_at?: string;
          granted_by?: string | null;
          is_active?: boolean;
          notes?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          audit_id: string;
          category: string | null;
          changed_fields: string[] | null;
          correlation_id: string | null;
          created_at: string | null;
          description: string | null;
          event_type: string | null;
          ip_address: unknown;
          metadata: Json | null;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string | null;
          record_pk: Json | null;
          severity: string | null;
          source: string;
          table_name: string;
          user_agent: string | null;
          user_email: string | null;
          user_id: string | null;
          user_role: string | null;
        };
        Insert: {
          action: string;
          audit_id?: string;
          category?: string | null;
          changed_fields?: string[] | null;
          correlation_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_type?: string | null;
          ip_address?: unknown;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          record_pk?: Json | null;
          severity?: string | null;
          source?: string;
          table_name: string;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          user_role?: string | null;
        };
        Update: {
          action?: string;
          audit_id?: string;
          category?: string | null;
          changed_fields?: string[] | null;
          correlation_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_type?: string | null;
          ip_address?: unknown;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          record_pk?: Json | null;
          severity?: string | null;
          source?: string;
          table_name?: string;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          user_role?: string | null;
        };
        Relationships: [];
      };
      audit_logs_archive: {
        Row: {
          action: string;
          audit_id: string;
          category: string | null;
          changed_fields: string[] | null;
          correlation_id: string | null;
          created_at: string | null;
          description: string | null;
          event_type: string | null;
          ip_address: unknown;
          metadata: Json | null;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string | null;
          record_pk: Json | null;
          severity: string | null;
          source: string;
          table_name: string;
          user_agent: string | null;
          user_email: string | null;
          user_id: string | null;
          user_role: string | null;
        };
        Insert: {
          action: string;
          audit_id?: string;
          category?: string | null;
          changed_fields?: string[] | null;
          correlation_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_type?: string | null;
          ip_address?: unknown;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          record_pk?: Json | null;
          severity?: string | null;
          source?: string;
          table_name: string;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          user_role?: string | null;
        };
        Update: {
          action?: string;
          audit_id?: string;
          category?: string | null;
          changed_fields?: string[] | null;
          correlation_id?: string | null;
          created_at?: string | null;
          description?: string | null;
          event_type?: string | null;
          ip_address?: unknown;
          metadata?: Json | null;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string | null;
          record_pk?: Json | null;
          severity?: string | null;
          source?: string;
          table_name?: string;
          user_agent?: string | null;
          user_email?: string | null;
          user_id?: string | null;
          user_role?: string | null;
        };
        Relationships: [];
      };
      availability_blackouts: {
        Row: {
          blackout_id: string;
          blackout_type: string;
          created_at: string | null;
          created_by: string | null;
          end_date: string;
          reason: string | null;
          start_date: string;
          unit_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          blackout_id?: string;
          blackout_type: string;
          created_at?: string | null;
          created_by?: string | null;
          end_date: string;
          reason?: string | null;
          start_date: string;
          unit_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          blackout_id?: string;
          blackout_type?: string;
          created_at?: string | null;
          created_by?: string | null;
          end_date?: string;
          reason?: string | null;
          start_date?: string;
          unit_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "availability_blackouts_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["unit_id"];
          },
        ];
      };
      bookings: {
        Row: {
          booking_id: string;
          booking_reference: string;
          booking_status: string | null;
          check_in: string;
          check_out: string;
          contact_number: string;
          created_at: string | null;
          discount_amount: number | null;
          discount_percent: number | null;
          downpayment_required: number | null;
          email: string;
          guest_id: string | null;
          guest_name: string;
          internal_notes: string | null;
          is_guest_booking: boolean | null;
          is_multi_unit: boolean | null;
          num_guests: number;
          payment_method: string | null;
          payment_proof_url: string | null;
          payment_status: string | null;
          pricing_snapshot: Json | null;
          requested_unit_count: number | null;
          special_requests: string | null;
          total_amount: number;
          unit_assignment_status: string | null;
          unit_count: number | null;
          base_amount: number | null;
          total_surcharges: number | null;
          updated_at: string | null;
          upload_expires_at: string | null;
          upload_status: string | null;
        };
        Insert: {
          booking_id?: string;
          booking_reference: string;
          booking_status?: string | null;
          check_in: string;
          check_out: string;
          contact_number: string;
          created_at?: string | null;
          discount_amount?: number | null;
          discount_percent?: number | null;
          downpayment_required?: number | null;
          email: string;
          guest_id?: string | null;
          guest_name: string;
          internal_notes?: string | null;
          is_guest_booking?: boolean | null;
          is_multi_unit?: boolean | null;
          num_guests: number;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          payment_status?: string | null;
          pricing_snapshot?: Json | null;
          requested_unit_count?: number | null;
          special_requests?: string | null;
          total_amount: number;
          unit_assignment_status?: string | null;
          unit_count?: number | null;
          base_amount?: number | null;
          total_surcharges?: number | null;
          updated_at?: string | null;
          upload_expires_at?: string | null;
          upload_status?: string | null;
        };
        Update: {
          booking_id?: string;
          booking_reference?: string;
          booking_status?: string | null;
          check_in?: string;
          check_out?: string;
          contact_number?: string;
          created_at?: string | null;
          discount_amount?: number | null;
          discount_percent?: number | null;
          downpayment_required?: number | null;
          email?: string;
          guest_id?: string | null;
          guest_name?: string;
          internal_notes?: string | null;
          is_guest_booking?: boolean | null;
          is_multi_unit?: boolean | null;
          num_guests?: number;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          payment_status?: string | null;
          pricing_snapshot?: Json | null;
          requested_unit_count?: number | null;
          special_requests?: string | null;
          total_amount?: number;
          unit_assignment_status?: string | null;
          unit_count?: number | null;
          base_amount?: number | null;
          total_surcharges?: number | null;
          updated_at?: string | null;
          upload_expires_at?: string | null;
          upload_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["guest_id"];
          },
        ];
      };
      bookings_conflict_backup: {
        Row: {
          booking_id: string | null;
          booking_reference: string | null;
          booking_status: string | null;
          check_in: string | null;
          check_out: string | null;
          contact_number: string | null;
          created_at: string | null;
          email: string | null;
          guest_id: string | null;
          guest_name: string | null;
          internal_notes: string | null;
          is_guest_booking: boolean | null;
          num_guests: number | null;
          payment_method: string | null;
          payment_proof_url: string | null;
          payment_status: string | null;
          special_requests: string | null;
          total_amount: number | null;
          unit_id: string | null;
          updated_at: string | null;
          upload_expires_at: string | null;
          upload_status: string | null;
        };
        Insert: {
          booking_id?: string | null;
          booking_reference?: string | null;
          booking_status?: string | null;
          check_in?: string | null;
          check_out?: string | null;
          contact_number?: string | null;
          created_at?: string | null;
          email?: string | null;
          guest_id?: string | null;
          guest_name?: string | null;
          internal_notes?: string | null;
          is_guest_booking?: boolean | null;
          num_guests?: number | null;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          payment_status?: string | null;
          special_requests?: string | null;
          total_amount?: number | null;
          unit_id?: string | null;
          updated_at?: string | null;
          upload_expires_at?: string | null;
          upload_status?: string | null;
        };
        Update: {
          booking_id?: string | null;
          booking_reference?: string | null;
          booking_status?: string | null;
          check_in?: string | null;
          check_out?: string | null;
          contact_number?: string | null;
          created_at?: string | null;
          email?: string | null;
          guest_id?: string | null;
          guest_name?: string | null;
          internal_notes?: string | null;
          is_guest_booking?: boolean | null;
          num_guests?: number | null;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          payment_status?: string | null;
          special_requests?: string | null;
          total_amount?: number | null;
          unit_id?: string | null;
          updated_at?: string | null;
          upload_expires_at?: string | null;
          upload_status?: string | null;
        };
        Relationships: [];
      };
      booking_units: {
        Row: {
          assigned_guests: number | null;
          booking_id: string;
          booking_unit_id: string;
          created_at: string | null;
          extra_person_charge: number;
          guest_names: string[] | null;
          subtotal: number;
          unit_id: string;
          unit_notes: string | null;
          unit_price: number;
          updated_at: string | null;
          weekend_surcharge: number;
        };
        Insert: {
          assigned_guests?: number | null;
          booking_id: string;
          booking_unit_id?: string;
          created_at?: string | null;
          extra_person_charge?: number;
          guest_names?: string[] | null;
          subtotal: number;
          unit_id: string;
          unit_notes?: string | null;
          unit_price: number;
          updated_at?: string | null;
          weekend_surcharge?: number;
        };
        Update: {
          assigned_guests?: number | null;
          booking_id?: string;
          booking_unit_id?: string;
          created_at?: string | null;
          extra_person_charge?: number;
          guest_names?: string[] | null;
          subtotal?: number;
          unit_id?: string;
          unit_notes?: string | null;
          unit_price?: number;
          updated_at?: string | null;
          weekend_surcharge?: number;
        };
        Relationships: [
          {
            foreignKeyName: "booking_units_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "booking_units_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["unit_id"];
          },
        ];
      };
      booking_unit_availability: {
        Row: {
          availability_id: string;
          booking_id: string;
          booking_status: string;
          check_in: string;
          check_out: string;
          created_at: string | null;
          unit_id: string;
          updated_at: string | null;
        };
        Insert: {
          availability_id?: string;
          booking_id: string;
          booking_status: string;
          check_in: string;
          check_out: string;
          created_at?: string | null;
          unit_id: string;
          updated_at?: string | null;
        };
        Update: {
          availability_id?: string;
          booking_id?: string;
          booking_status?: string;
          check_in?: string;
          check_out?: string;
          created_at?: string | null;
          unit_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_unit_availability_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "booking_unit_availability_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["unit_id"];
          },
        ];
      };
      discount_rules: {
        Row: {
          conditions: Json;
          created_at: string | null;
          description: string | null;
          discount_type: string;
          discount_value: number;
          id: string;
          is_active: boolean | null;
          max_discount: number | null;
          name: string;
          priority: number | null;
          updated_at: string | null;
        };
        Insert: {
          conditions: Json;
          created_at?: string | null;
          description?: string | null;
          discount_type?: string;
          discount_value: number;
          id?: string;
          is_active?: boolean | null;
          max_discount?: number | null;
          name: string;
          priority?: number | null;
          updated_at?: string | null;
        };
        Update: {
          conditions?: Json;
          created_at?: string | null;
          description?: string | null;
          discount_type?: string;
          discount_value?: number;
          id?: string;
          is_active?: boolean | null;
          max_discount?: number | null;
          name?: string;
          priority?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string | null;
          description: string;
          expense_date: string;
          expense_id: string;
          notes: string | null;
          receipt_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string | null;
          description: string;
          expense_date: string;
          expense_id?: string;
          notes?: string | null;
          receipt_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string | null;
          description?: string;
          expense_date?: string;
          expense_id?: string;
          notes?: string | null;
          receipt_url?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      guest_booking_unit_requests: {
        Row: {
          booking_id: string;
          created_at: string | null;
          guests_per_unit: number;
          id: string;
          updated_at: string | null;
        };
        Insert: {
          booking_id: string;
          created_at?: string | null;
          guests_per_unit: number;
          id?: string;
          updated_at?: string | null;
        };
        Update: {
          booking_id?: string;
          created_at?: string | null;
          guests_per_unit?: number;
          id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "guest_booking_unit_requests_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["booking_id"];
          },
        ];
      };
      guests: {
        Row: {
          created_at: string | null;
          email: string;
          guest_id: string;
          guest_name: string;
          phone_number: string;
          total_bookings: number | null;
          total_spent: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          guest_id?: string;
          guest_name: string;
          phone_number: string;
          total_bookings?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          guest_id?: string;
          guest_name?: string;
          phone_number?: string;
          total_bookings?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          booking_id: string;
          created_at: string | null;
          expires_at: string | null;
          key: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string | null;
          expires_at?: string | null;
          key: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string | null;
          expires_at?: string | null;
          key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["booking_id"];
          },
        ];
      };
      maintenance_logs: {
        Row: {
          cost: number | null;
          created_at: string | null;
          issue_description: string;
          log_id: string;
          notes: string | null;
          priority: string | null;
          reported_date: string | null;
          resolved_date: string | null;
          status: string | null;
          unit_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          cost?: number | null;
          created_at?: string | null;
          issue_description: string;
          log_id?: string;
          notes?: string | null;
          priority?: string | null;
          reported_date?: string | null;
          resolved_date?: string | null;
          status?: string | null;
          unit_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          cost?: number | null;
          created_at?: string | null;
          issue_description?: string;
          log_id?: string;
          notes?: string | null;
          priority?: string | null;
          reported_date?: string | null;
          resolved_date?: string | null;
          status?: string | null;
          unit_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["unit_id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          booking_id: string | null;
          created_at: string | null;
          notes: string | null;
          payment_date: string | null;
          payment_id: string;
          payment_method: string | null;
          proof_url: string | null;
        };
        Insert: {
          amount: number;
          booking_id?: string | null;
          created_at?: string | null;
          notes?: string | null;
          payment_date?: string | null;
          payment_id?: string;
          payment_method?: string | null;
          proof_url?: string | null;
        };
        Update: {
          amount?: number;
          booking_id?: string | null;
          created_at?: string | null;
          notes?: string | null;
          payment_date?: string | null;
          payment_id?: string;
          payment_method?: string | null;
          proof_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["booking_id"];
          },
        ];
      };
      pricing_config: {
        Row: {
          base_occupancy: number;
          base_rate: number;
          created_at: string | null;
          currency: string;
          downpayment_percent: number;
          extra_person_rate: number;
          id: string;
          max_capacity_per_unit: number;
          updated_at: string | null;
          weekend_rate: number;
        };
        Insert: {
          base_occupancy?: number;
          base_rate: number;
          created_at?: string | null;
          currency?: string;
          downpayment_percent?: number;
          extra_person_rate?: number;
          id?: string;
          max_capacity_per_unit?: number;
          updated_at?: string | null;
          weekend_rate: number;
        };
        Update: {
          base_occupancy?: number;
          base_rate?: number;
          created_at?: string | null;
          currency?: string;
          downpayment_percent?: number;
          extra_person_rate?: number;
          id?: string;
          max_capacity_per_unit?: number;
          updated_at?: string | null;
          weekend_rate?: number;
        };
        Relationships: [];
      };
      seasonal_rates: {
        Row: {
          id: string;
          season_id: string;
          name: string;
          start_date: string;
          end_date: string;
          multiplier: number;
          priority: number;
          is_active: boolean;
          description: string | null;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          name: string;
          start_date: string;
          end_date: string;
          multiplier: number;
          priority?: number;
          is_active?: boolean;
          description?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          season_id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          multiplier?: number;
          priority?: number;
          is_active?: boolean;
          description?: string | null;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      units: {
        Row: {
          amenities: Json | null;
          base_occupancy: number;
          base_rate: number;
          created_at: string | null;
          extra_person_rate: number;
          max_occupancy: number;
          unit_code: string;
          unit_id: string;
          unit_name: string;
          unit_status: string | null;
          unit_type: string;
          updated_at: string | null;
          weekend_rate: number;
        };
        Insert: {
          amenities?: Json | null;
          base_occupancy: number;
          base_rate: number;
          created_at?: string | null;
          extra_person_rate: number;
          max_occupancy: number;
          unit_code: string;
          unit_id?: string;
          unit_name: string;
          unit_status?: string | null;
          unit_type: string;
          updated_at?: string | null;
          weekend_rate: number;
        };
        Update: {
          amenities?: Json | null;
          base_occupancy?: number;
          base_rate?: number;
          created_at?: string | null;
          extra_person_rate?: number;
          max_occupancy?: number;
          unit_code?: string;
          unit_id?: string;
          unit_name?: string;
          unit_status?: string | null;
          unit_type?: string;
          updated_at?: string | null;
          weekend_rate?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      audit_archive_stats: {
        Row: {
          log_count: number | null;
          newest_log: string | null;
          oldest_log: string | null;
          status: string | null;
          total_size: string | null;
        };
        Relationships: [];
      };
      audit_index_stats: {
        Row: {
          index_size: string | null;
          indexname: unknown;
          rows_fetched: number | null;
          rows_read: number | null;
          schemaname: unknown;
          tablename: unknown;
          times_used: number | null;
        };
        Relationships: [];
      };
      audit_system_status: {
        Row: {
          component: string | null;
          count: number | null;
          details: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      archive_audit_logs: {
        Args: { cutoff_date: string; dry_run?: boolean };
        Returns: {
          archived_count: number;
          newest_archived: string;
          oldest_archived: string;
          tables_affected: string[];
        }[];
      };
      archive_logs_older_than_months: {
        Args: { dry_run?: boolean; months_old: number };
        Returns: {
          archived_count: number;
          newest_archived: string;
          oldest_archived: string;
          tables_affected: string[];
        }[];
      };
      assign_units_to_booking: {
        Args: { p_booking_id: string; p_unit_ids: string[] };
        Returns: undefined;
      };
      attach_audit_trigger: {
        Args: { target_table: string };
        Returns: undefined;
      };
      calculate_booking_pricing: {
        Args: { p_check_in: string; p_check_out: string; p_unit_requests: Json };
        Returns: Json;
      };
      can_view_all_audit_logs: { Args: never; Returns: boolean };
      check_unit_availability: {
        Args: { p_check_in: string; p_check_out: string; p_unit_id: string };
        Returns: boolean;
      };
      check_multi_unit_availability: {
        Args: {
          p_check_in: string;
          p_check_out: string;
          p_exclude_booking_id?: string;
          p_unit_ids: string[];
        };
        Returns: {
          conflicting_bookings: number;
          is_available: boolean;
          next_available_date: string | null;
          unit_id: string;
        }[];
      };
      cleanup_expired_idempotency_keys: { Args: never; Returns: number };
      cleanup_expired_payment_proofs: {
        Args: never;
        Returns: {
          file_path: string;
        }[];
      };
      create_guest_booking: {
        Args: {
          p_booking_data: Json;
          p_guest_data: Json;
          p_idempotency_key: string;
          p_unit_requests: Json;
        };
        Returns: Json;
      };
      detach_audit_trigger: {
        Args: { target_table: string };
        Returns: undefined;
      };
      generate_booking_reference: { Args: never; Returns: string };
      get_current_audit_role: { Args: never; Returns: string };
      get_public_aggregate_availability: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: {
          available_count: number;
          date: string;
        }[];
      };
      grant_audit_role: {
        Args: {
          grant_notes?: string;
          target_email: string;
          target_role: string;
          target_user_id: string;
        };
        Returns: undefined;
      };
      has_any_role: { Args: { check_user_id: string }; Returns: boolean };
      is_admin: { Args: { check_user_id: string }; Returns: boolean };
      is_admin_or_owner: { Args: { check_user_id: string }; Returns: boolean };
      is_audit_admin: { Args: never; Returns: boolean };
      is_audit_manager: { Args: never; Returns: boolean };
      is_audit_owner: { Args: never; Returns: boolean };
      is_manager: { Args: { check_user_id: string }; Returns: boolean };
      is_staff: { Args: { check_user_id: string }; Returns: boolean };
      monthly_archive_until: {
        Args: { dry_run?: boolean; final_cutoff_date: string };
        Returns: {
          logs_archived: number;
          month_archived: string;
        }[];
      };
      restore_logs_from_archive: {
        Args: { end_date: string; start_date: string };
        Returns: number;
      };
      revoke_audit_role: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;

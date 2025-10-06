export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
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
          ip_address: unknown | null;
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
          ip_address?: unknown | null;
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
          ip_address?: unknown | null;
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
          ip_address: unknown | null;
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
          ip_address?: unknown | null;
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
          ip_address?: unknown | null;
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
          unit_id: string;
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
          unit_id: string;
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
          unit_id?: string;
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
      availability_cache: {
        Row: {
          available_dates: string[];
          cache_expires_at: string;
          cache_id: string;
          created_at: string | null;
          date_range_end: string;
          date_range_start: string;
          unit_id: string;
        };
        Insert: {
          available_dates: string[];
          cache_expires_at: string;
          cache_id?: string;
          created_at?: string | null;
          date_range_end: string;
          date_range_start: string;
          unit_id: string;
        };
        Update: {
          available_dates?: string[];
          cache_expires_at?: string;
          cache_id?: string;
          created_at?: string | null;
          date_range_end?: string;
          date_range_start?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_cache_unit_id_fkey";
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
          email: string;
          guest_id: string | null;
          guest_name: string;
          internal_notes: string | null;
          is_guest_booking: boolean | null;
          num_guests: number;
          payment_method: string | null;
          payment_proof_url: string | null;
          payment_status: string | null;
          special_requests: string | null;
          total_amount: number;
          unit_id: string;
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
          email: string;
          guest_id?: string | null;
          guest_name: string;
          internal_notes?: string | null;
          is_guest_booking?: boolean | null;
          num_guests: number;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          payment_status?: string | null;
          special_requests?: string | null;
          total_amount: number;
          unit_id: string;
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
          email?: string;
          guest_id?: string | null;
          guest_name?: string;
          internal_notes?: string | null;
          is_guest_booking?: boolean | null;
          num_guests?: number;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          payment_status?: string | null;
          special_requests?: string | null;
          total_amount?: number;
          unit_id?: string;
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
          {
            foreignKeyName: "bookings_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["unit_id"];
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
          indexname: unknown | null;
          rows_fetched: number | null;
          rows_read: number | null;
          schemaname: unknown | null;
          tablename: unknown | null;
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
      attach_audit_trigger: {
        Args: { target_table: string };
        Returns: undefined;
      };
      can_view_all_audit_logs: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      check_unit_availability: {
        Args: { p_check_in: string; p_check_out: string; p_unit_id: string };
        Returns: boolean;
      };
      check_unit_availability_fast: {
        Args: {
          p_unit_id: string;
          p_check_in: string;
          p_check_out: string;
          p_exclude_booking_id?: string;
        };
        Returns: {
          is_available: boolean;
          conflicting_bookings: number;
          blackout_periods: number;
          unit_status: string;
        }[];
      };
      check_multi_unit_availability: {
        Args: {
          p_check_in: string;
          p_check_out: string;
          p_unit_types?: string[];
          p_min_occupancy?: number;
          p_max_rate?: number;
          p_limit?: number;
        };
        Returns: {
          unit_id: string;
          unit_name: string;
          unit_code: string;
          unit_type: string;
          max_occupancy: number;
          base_rate: number;
          weekend_rate: number;
          is_available: boolean;
          next_available_date: string | null;
        }[];
      };
      get_unit_availability_calendar: {
        Args: {
          p_unit_id: string;
          p_start_date: string;
          p_end_date: string;
        };
        Returns: {
          calendar_date: string;
          status: string;
          booking_id: string | null;
          guest_name: string | null;
          booking_reference: string | null;
        }[];
      };
      refresh_availability_cache: {
        Args: {
          p_unit_id?: string;
          p_days_ahead?: number;
        };
        Returns: number;
      };
      detach_audit_trigger: {
        Args: { target_table: string };
        Returns: undefined;
      };
      gbt_bit_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_bool_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_bool_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_bpchar_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_bytea_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_cash_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_cash_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_date_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_date_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_decompress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_enum_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_enum_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_float4_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_float4_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_float8_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_float8_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_inet_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_int2_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_int2_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_int4_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_int4_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_int8_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_int8_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_intv_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_intv_decompress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_intv_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_macad_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_macad_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_macad8_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_macad8_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_numeric_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_oid_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_oid_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_text_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_time_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_time_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_timetz_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_ts_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_ts_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_tstz_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_uuid_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_uuid_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_var_decompress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbt_var_fetch: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey_var_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey_var_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey16_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey16_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey2_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey2_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey32_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey32_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey4_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey4_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey8_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gbtreekey8_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      generate_booking_reference: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_current_audit_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
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
      is_admin: {
        Args: { check_user_id: string };
        Returns: boolean;
      };
      is_admin_or_owner: {
        Args: { check_user_id: string };
        Returns: boolean;
      };
      is_audit_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_audit_manager: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_audit_owner: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_manager: {
        Args: { check_user_id: string };
        Returns: boolean;
      };
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

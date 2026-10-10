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
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
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
      account_transfers: {
        Row: {
          amount: number;
          created_at: string | null;
          from_account_id: string;
          notes: string | null;
          to_account_id: string;
          transfer_date: string | null;
          transfer_id: string;
          transfer_reference: string;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          from_account_id: string;
          notes?: string | null;
          to_account_id: string;
          transfer_date?: string | null;
          transfer_id?: string;
          transfer_reference: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          from_account_id?: string;
          notes?: string | null;
          to_account_id?: string;
          transfer_date?: string | null;
          transfer_id?: string;
          transfer_reference?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_transfers_from_account_id_fkey";
            columns: ["from_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "account_transfers_to_account_id_fkey";
            columns: ["to_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["account_id"];
          },
        ];
      };
      accounts: {
        Row: {
          account_code: string;
          account_id: string;
          account_name: string;
          account_type: string;
          created_at: string | null;
          description: string | null;
          display_order: number | null;
          initial_balance: number | null;
          is_active: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          account_code: string;
          account_id?: string;
          account_name: string;
          account_type: string;
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          initial_balance?: number | null;
          is_active?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          account_code?: string;
          account_id?: string;
          account_name?: string;
          account_type?: string;
          created_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          initial_balance?: number | null;
          is_active?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
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
            referencedRelation: "booking_pricing_analytics";
            referencedColumns: ["booking_id"];
          },
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
      booking_units: {
        Row: {
          assigned_guests: number | null;
          booking_id: string;
          booking_unit_id: string;
          check_in_date: string | null;
          check_out_date: string | null;
          created_at: string | null;
          extra_person_charge: number | null;
          guest_names: string[] | null;
          status: string | null;
          subtotal: number;
          unit_id: string;
          unit_notes: string | null;
          unit_price: number;
          updated_at: string | null;
          weekend_surcharge: number | null;
        };
        Insert: {
          assigned_guests?: number | null;
          booking_id: string;
          booking_unit_id?: string;
          check_in_date?: string | null;
          check_out_date?: string | null;
          created_at?: string | null;
          extra_person_charge?: number | null;
          guest_names?: string[] | null;
          status?: string | null;
          subtotal: number;
          unit_id: string;
          unit_notes?: string | null;
          unit_price: number;
          updated_at?: string | null;
          weekend_surcharge?: number | null;
        };
        Update: {
          assigned_guests?: number | null;
          booking_id?: string;
          booking_unit_id?: string;
          check_in_date?: string | null;
          check_out_date?: string | null;
          created_at?: string | null;
          extra_person_charge?: number | null;
          guest_names?: string[] | null;
          status?: string | null;
          subtotal?: number;
          unit_id?: string;
          unit_notes?: string | null;
          unit_price?: number;
          updated_at?: string | null;
          weekend_surcharge?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_units_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "booking_pricing_analytics";
            referencedColumns: ["booking_id"];
          },
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
      bookings: {
        Row: {
          base_amount: number | null;
          booking_id: string;
          booking_reference: string;
          booking_status: string | null;
          check_in: string;
          check_out: string;
          contact_number: string | null;
          created_at: string | null;
          discount_amount: number | null;
          discount_percent: number | null;
          downpayment_required: number | null;
          email: string | null;
          guest_id: string | null;
          guest_name: string;
          internal_notes: string | null;
          is_guest_booking: boolean | null;
          is_multi_unit: boolean | null;
          is_walk_in: boolean;
          num_guests: number;
          payment_method: string | null;
          payment_proof_url: string | null;
          payment_status: string | null;
          pricing_metadata: Json | null;
          pricing_snapshot: Json | null;
          requested_unit_count: number | null;
          special_requests: string | null;
          tax_amount: number | null;
          total_amount: number;
          total_surcharges: number | null;
          unit_assignment_status: string | null;
          unit_count: number | null;
          updated_at: string | null;
          upload_expires_at: string | null;
          upload_status: string | null;
        };
        Insert: {
          base_amount?: number | null;
          booking_id?: string;
          booking_reference: string;
          booking_status?: string | null;
          check_in: string;
          check_out: string;
          contact_number?: string | null;
          created_at?: string | null;
          discount_amount?: number | null;
          discount_percent?: number | null;
          downpayment_required?: number | null;
          email?: string | null;
          guest_id?: string | null;
          guest_name: string;
          internal_notes?: string | null;
          is_guest_booking?: boolean | null;
          is_multi_unit?: boolean | null;
          is_walk_in?: boolean;
          num_guests: number;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          payment_status?: string | null;
          pricing_metadata?: Json | null;
          pricing_snapshot?: Json | null;
          requested_unit_count?: number | null;
          special_requests?: string | null;
          tax_amount?: number | null;
          total_amount: number;
          total_surcharges?: number | null;
          unit_assignment_status?: string | null;
          unit_count?: number | null;
          updated_at?: string | null;
          upload_expires_at?: string | null;
          upload_status?: string | null;
        };
        Update: {
          base_amount?: number | null;
          booking_id?: string;
          booking_reference?: string;
          booking_status?: string | null;
          check_in?: string;
          check_out?: string;
          contact_number?: string | null;
          created_at?: string | null;
          discount_amount?: number | null;
          discount_percent?: number | null;
          downpayment_required?: number | null;
          email?: string | null;
          guest_id?: string | null;
          guest_name?: string;
          internal_notes?: string | null;
          is_guest_booking?: boolean | null;
          is_multi_unit?: boolean | null;
          is_walk_in?: boolean;
          num_guests?: number;
          payment_method?: string | null;
          payment_proof_url?: string | null;
          payment_status?: string | null;
          pricing_metadata?: Json | null;
          pricing_snapshot?: Json | null;
          requested_unit_count?: number | null;
          special_requests?: string | null;
          tax_amount?: number | null;
          total_amount?: number;
          total_surcharges?: number | null;
          unit_assignment_status?: string | null;
          unit_count?: number | null;
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
      discount_rules: {
        Row: {
          conditions: NonNullable<Json>;
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
          conditions: NonNullable<Json>;
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
          conditions?: NonNullable<Json>;
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
      expense_categories: {
        Row: {
          created_at: string | null;
          display_order: number | null;
          id: string;
          is_active: boolean | null;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          display_order?: number | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          account_id: string | null;
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
          account_id?: string | null;
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
          account_id?: string | null;
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
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["account_id"];
          },
        ];
      };
      guest_assignments: {
        Row: {
          assignment_id: string;
          booking_unit_id: string;
          created_at: string | null;
          guest_id: string;
          is_primary: boolean | null;
          room_preferences: string | null;
        };
        Insert: {
          assignment_id?: string;
          booking_unit_id: string;
          created_at?: string | null;
          guest_id: string;
          is_primary?: boolean | null;
          room_preferences?: string | null;
        };
        Update: {
          assignment_id?: string;
          booking_unit_id?: string;
          created_at?: string | null;
          guest_id?: string;
          is_primary?: boolean | null;
          room_preferences?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "guest_assignments_booking_unit_id_fkey";
            columns: ["booking_unit_id"];
            isOneToOne: false;
            referencedRelation: "booking_units";
            referencedColumns: ["booking_unit_id"];
          },
          {
            foreignKeyName: "guest_assignments_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "guests";
            referencedColumns: ["guest_id"];
          },
        ];
      };
      guest_booking_unit_requests: {
        Row: {
          booking_id: string;
          created_at: string | null;
          guests_per_unit: number;
          id: string;
          quantity: number;
          special_requests: string | null;
          unit_type: string;
          updated_at: string | null;
        };
        Insert: {
          booking_id: string;
          created_at?: string | null;
          guests_per_unit: number;
          id?: string;
          quantity: number;
          special_requests?: string | null;
          unit_type: string;
          updated_at?: string | null;
        };
        Update: {
          booking_id?: string;
          created_at?: string | null;
          guests_per_unit?: number;
          id?: string;
          quantity?: number;
          special_requests?: string | null;
          unit_type?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "guest_booking_unit_requests_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "booking_pricing_analytics";
            referencedColumns: ["booking_id"];
          },
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
          email: string | null;
          guest_id: string;
          guest_name: string;
          phone_number: string | null;
          total_bookings: number | null;
          total_spent: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email?: string | null;
          guest_id?: string;
          guest_name: string;
          phone_number?: string | null;
          total_bookings?: number | null;
          total_spent?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          guest_id?: string;
          guest_name?: string;
          phone_number?: string | null;
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
            referencedRelation: "booking_pricing_analytics";
            referencedColumns: ["booking_id"];
          },
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
      payment_methods: {
        Row: {
          account_name: string | null;
          account_number: string | null;
          bank_name: string | null;
          created_at: string | null;
          display_name: string;
          display_order: number | null;
          icon_color: string | null;
          icon_name: string | null;
          id: string;
          instructions: string | null;
          is_active: boolean | null;
          method_type: string;
          provider_name: string;
          qr_code_storage_path: string | null;
          qr_code_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          account_name?: string | null;
          account_number?: string | null;
          bank_name?: string | null;
          created_at?: string | null;
          display_name: string;
          display_order?: number | null;
          icon_color?: string | null;
          icon_name?: string | null;
          id?: string;
          instructions?: string | null;
          is_active?: boolean | null;
          method_type: string;
          provider_name: string;
          qr_code_storage_path?: string | null;
          qr_code_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          account_name?: string | null;
          account_number?: string | null;
          bank_name?: string | null;
          created_at?: string | null;
          display_name?: string;
          display_order?: number | null;
          icon_color?: string | null;
          icon_name?: string | null;
          id?: string;
          instructions?: string | null;
          is_active?: boolean | null;
          method_type?: string;
          provider_name?: string;
          qr_code_storage_path?: string | null;
          qr_code_url?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          account_id: string | null;
          amount: number;
          booking_id: string | null;
          created_at: string | null;
          notes: string | null;
          payment_date: string | null;
          payment_id: string;
          payment_method: string | null;
          proof_url: string | null;
          status: string;
        };
        Insert: {
          account_id?: string | null;
          amount: number;
          booking_id?: string | null;
          created_at?: string | null;
          notes?: string | null;
          payment_date?: string | null;
          payment_id?: string;
          payment_method?: string | null;
          proof_url?: string | null;
          status?: string;
        };
        Update: {
          account_id?: string | null;
          amount?: number;
          booking_id?: string | null;
          created_at?: string | null;
          notes?: string | null;
          payment_date?: string | null;
          payment_id?: string;
          payment_method?: string | null;
          proof_url?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "booking_pricing_analytics";
            referencedColumns: ["booking_id"];
          },
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
          color: string | null;
          created_at: string | null;
          description: string | null;
          end_date: string;
          id: string;
          is_active: boolean | null;
          multiplier: number;
          name: string;
          priority: number;
          season_id: string;
          start_date: string;
          updated_at: string | null;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          end_date: string;
          id?: string;
          is_active?: boolean | null;
          multiplier: number;
          name: string;
          priority?: number;
          season_id: string;
          start_date: string;
          updated_at?: string | null;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          description?: string | null;
          end_date?: string;
          id?: string;
          is_active?: boolean | null;
          multiplier?: number;
          name?: string;
          priority?: number;
          season_id?: string;
          start_date?: string;
          updated_at?: string | null;
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
      booking_pricing_analytics: {
        Row: {
          booking_id: string | null;
          booking_reference: string | null;
          check_in: string | null;
          check_out: string | null;
          created_at: string | null;
          currency: string | null;
          downpayment_calculated: number | null;
          extra_person_total: number | null;
          has_seasonal_rates: boolean | null;
          nights: number | null;
          pricing_calculated_at: string | null;
          season_names: Json | null;
          subtotal: number | null;
          total_amount: number | null;
        };
        Insert: {
          booking_id?: string | null;
          booking_reference?: string | null;
          check_in?: string | null;
          check_out?: string | null;
          created_at?: string | null;
          currency?: never;
          downpayment_calculated?: never;
          extra_person_total?: never;
          has_seasonal_rates?: never;
          nights?: never;
          pricing_calculated_at?: never;
          season_names?: never;
          subtotal?: never;
          total_amount?: number | null;
        };
        Update: {
          booking_id?: string | null;
          booking_reference?: string | null;
          check_in?: string | null;
          check_out?: string | null;
          created_at?: string | null;
          currency?: never;
          downpayment_calculated?: never;
          extra_person_total?: never;
          has_seasonal_rates?: never;
          nights?: never;
          pricing_calculated_at?: never;
          season_names?: never;
          subtotal?: never;
          total_amount?: number | null;
        };
        Relationships: [];
      };
      public_unit_availability: {
        Row: {
          booking_status: string | null;
          check_in: string | null;
          check_out: string | null;
          unit_id: string | null;
        };
        Insert: {
          booking_status?: string | null;
          check_in?: string | null;
          check_out?: string | null;
          unit_id?: string | null;
        };
        Update: {
          booking_status?: string | null;
          check_in?: string | null;
          check_out?: string | null;
          unit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_unit_availability_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["unit_id"];
          },
        ];
      };
    };
    Functions: {
      archive_audit_logs:
        | {
            Args: { cutoff_date: string; dry_run?: boolean };
            Returns: {
              archived_count: number;
              newest_archived: string;
              oldest_archived: string;
              tables_affected: string[];
            }[];
          }
        | { Args: { p_before_date: string }; Returns: number };
      archive_logs_older_than_months:
        | {
            Args: { dry_run?: boolean; months_old: number };
            Returns: {
              archived_count: number;
              newest_archived: string;
              oldest_archived: string;
              tables_affected: string[];
            }[];
          }
        | { Args: { p_months?: number }; Returns: number };
      assign_units_to_booking: {
        Args: { p_booking_id: string; p_unit_ids: string[] };
        Returns: undefined;
      };
      attach_audit_trigger: { Args: { p_table_name: string }; Returns: undefined };
      calculate_booking_pricing: {
        Args: { p_check_in: string; p_check_out: string; p_unit_requests: Json };
        Returns: Json;
      };
      can_view_all_audit_logs: { Args: Record<PropertyKey, never>; Returns: boolean };
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
          next_available_date: string;
          unit_id: string;
        }[];
      };
      check_unit_availability: {
        Args: {
          p_check_in: string;
          p_check_out: string;
          p_exclude_booking_id?: string;
          p_unit_id: string;
        };
        Returns: boolean;
      };
      check_units_available_for_booking: {
        Args: { p_booking_id: string; p_unit_ids: string[] };
        Returns: {
          conflict_booking_id: string;
          is_available: boolean;
          unit_id: string;
        }[];
      };
      cleanup_expired_idempotency_keys: { Args: Record<PropertyKey, never>; Returns: number };
      cleanup_expired_payment_proofs: {
        Args: Record<PropertyKey, never>;
        Returns: {
          file_path: string;
        }[];
      };
      create_guest_booking:
        | {
            Args: {
              p_booking_data: Json;
              p_guest_data: Json;
              p_idempotency_key: string;
              p_unit_requests: Json;
            };
            Returns: Json;
          }
        | {
            Args: {
              p_booking_data: Json;
              p_guest_data?: Json;
              p_turnstile_token: string;
              p_unit_requests: Json;
            };
            Returns: Json;
          };
      create_multi_unit_booking: {
        Args: { p_booking_data: Json; p_guest_id?: string; p_units: Json[] };
        Returns: string;
      };
      derive_booking_payment_status: { Args: { p_booking_id: string }; Returns: string };
      detach_audit_trigger: { Args: { p_table_name: string }; Returns: undefined };
      generate_booking_reference: { Args: Record<PropertyKey, never>; Returns: string };
      generate_transfer_reference: { Args: Record<PropertyKey, never>; Returns: string };
      get_account_balance: {
        Args: { p_account_id: string; p_as_of_date?: string };
        Returns: number;
      };
      get_all_account_balances: {
        Args: { p_as_of_date?: string };
        Returns: {
          account_code: string;
          account_id: string;
          account_name: string;
          account_type: string;
          current_balance: number;
          initial_balance: number;
          total_expenses: number;
          total_payments: number;
          transfers_in: number;
          transfers_out: number;
        }[];
      };
      get_booking_units: {
        Args: { p_booking_id: string };
        Returns: {
          assigned_guests: number;
          subtotal: number;
          unit_code: string;
          unit_id: string;
          unit_name: string;
          unit_price: number;
          unit_type: string;
        }[];
      };
      get_current_audit_role: { Args: Record<PropertyKey, never>; Returns: string };
      get_public_aggregate_availability: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: {
          available_count: number;
          date: string;
        }[];
      };
      get_seasonal_rate_for_date: {
        Args: { check_date: string };
        Returns: {
          multiplier: number;
          name: string;
          priority: number;
          season_id: string;
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
      is_admin: { Args: { check_user_id?: string }; Returns: boolean };
      is_admin_or_owner: { Args: { check_user_id?: string }; Returns: boolean };
      is_audit_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_audit_manager: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_audit_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_manager: { Args: { check_user_id?: string }; Returns: boolean };
      is_manager_or_above: { Args: { check_user_id?: string }; Returns: boolean };
      is_staff: { Args: { check_user_id: string }; Returns: boolean };
      is_staff_or_above: { Args: { check_user_id?: string }; Returns: boolean };
      monthly_archive_until:
        | {
            Args: { dry_run?: boolean; final_cutoff_date: string };
            Returns: {
              logs_archived: number;
              month_archived: string;
            }[];
          }
        | {
            Args: { p_until_date: string };
            Returns: {
              archive_month: string;
              logs_archived: number;
            }[];
          };
      refresh_booking_payment_status: { Args: { p_booking_id: string }; Returns: undefined };
      restore_logs_from_archive:
        | { Args: { p_archive_month: string }; Returns: number }
        | { Args: { end_date: string; start_date: string }; Returns: number };
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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

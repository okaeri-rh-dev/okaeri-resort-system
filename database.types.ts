export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      availability_blackouts: {
        Row: {
          blackout_id: string;
          blackout_type: Database["public"]["Enums"]["blackout_type"];
          created_at: string;
          created_by: string | null;
          end_date: string;
          reason: string | null;
          start_date: string;
          unit_id: string;
          updated_at: string;
        };
        Insert: {
          blackout_id?: string;
          blackout_type: Database["public"]["Enums"]["blackout_type"];
          created_at?: string;
          created_by?: string | null;
          end_date: string;
          reason?: string | null;
          start_date: string;
          unit_id: string;
          updated_at?: string;
        };
        Update: {
          blackout_id?: string;
          blackout_type?: Database["public"]["Enums"]["blackout_type"];
          created_at?: string;
          created_by?: string | null;
          end_date?: string;
          reason?: string | null;
          start_date?: string;
          unit_id?: string;
          updated_at?: string;
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
          created_at: string;
          date_range_end: string;
          date_range_start: string;
          unit_id: string;
        };
        Insert: {
          available_dates: string[];
          cache_expires_at: string;
          cache_id?: string;
          created_at?: string;
          date_range_end: string;
          date_range_start: string;
          unit_id: string;
        };
        Update: {
          available_dates?: string[];
          cache_expires_at?: string;
          cache_id?: string;
          created_at?: string;
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
          booking_status: Database["public"]["Enums"]["booking_status"];
          check_in: string;
          check_out: string;
          contact_number: string;
          created_at: string;
          email: string;
          guest_id: string | null;
          guest_name: string;
          num_guests: number;
          payment_method: Database["public"]["Enums"]["payment_method"] | null;
          payment_status: Database["public"]["Enums"]["payment_status"];
          special_requests: string | null;
          total_amount: number;
          unit_id: string;
          updated_at: string;
        };
        Insert: {
          booking_id?: string;
          booking_reference: string;
          booking_status?: Database["public"]["Enums"]["booking_status"];
          check_in: string;
          check_out: string;
          contact_number: string;
          created_at?: string;
          email: string;
          guest_id?: string | null;
          guest_name: string;
          num_guests: number;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          special_requests?: string | null;
          total_amount: number;
          unit_id: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          booking_reference?: string;
          booking_status?: Database["public"]["Enums"]["booking_status"];
          check_in?: string;
          check_out?: string;
          contact_number?: string;
          created_at?: string;
          email?: string;
          guest_id?: string | null;
          guest_name?: string;
          num_guests?: number;
          payment_method?: Database["public"]["Enums"]["payment_method"] | null;
          payment_status?: Database["public"]["Enums"]["payment_status"];
          special_requests?: string | null;
          total_amount?: number;
          unit_id?: string;
          updated_at?: string;
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
      expenses: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          date: string;
          description: string | null;
          expense_id: string;
          receipt_url: string | null;
          updated_at: string;
          vendor: string | null;
        };
        Insert: {
          amount: number;
          category: string;
          created_at?: string;
          date: string;
          description?: string | null;
          expense_id?: string;
          receipt_url?: string | null;
          updated_at?: string;
          vendor?: string | null;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          date?: string;
          description?: string | null;
          expense_id?: string;
          receipt_url?: string | null;
          updated_at?: string;
          vendor?: string | null;
        };
        Relationships: [];
      };
      guests: {
        Row: {
          created_at: string;
          email: string;
          guest_id: string;
          guest_name: string;
          phone_number: string;
          total_bookings: number | null;
          total_spent: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          guest_id?: string;
          guest_name: string;
          phone_number: string;
          total_bookings?: number | null;
          total_spent?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          guest_id?: string;
          guest_name?: string;
          phone_number?: string;
          total_bookings?: number | null;
          total_spent?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      maintenance_logs: {
        Row: {
          completed_date: string | null;
          cost: number | null;
          created_at: string;
          description: string;
          log_id: string;
          maintenance_type: string;
          scheduled_date: string;
          status: string;
          unit_id: string;
          updated_at: string;
        };
        Insert: {
          completed_date?: string | null;
          cost?: number | null;
          created_at?: string;
          description: string;
          log_id?: string;
          maintenance_type: string;
          scheduled_date: string;
          status: string;
          unit_id: string;
          updated_at?: string;
        };
        Update: {
          completed_date?: string | null;
          cost?: number | null;
          created_at?: string;
          description?: string;
          log_id?: string;
          maintenance_type?: string;
          scheduled_date?: string;
          status?: string;
          unit_id?: string;
          updated_at?: string;
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
          booking_id: string;
          created_at: string;
          notes?: string | null;
          payment_date: string;
          payment_id: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          proof_url?: string | null;
          receipt_url: string | null;
          reference_number: string | null;
          transaction_date: string;
          verified_at?: string | null;
        };
        Insert: {
          amount: number;
          booking_id: string;
          created_at?: string;
          notes?: string | null;
          payment_date?: string;
          payment_id?: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          proof_url?: string | null;
          receipt_url?: string | null;
          reference_number?: string | null;
          transaction_date: string;
          verified_at?: string | null;
        };
        Update: {
          amount?: number;
          booking_id?: string;
          created_at?: string;
          notes?: string | null;
          payment_date?: string;
          payment_id?: string;
          payment_method?: Database["public"]["Enums"]["payment_method"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          proof_url?: string | null;
          receipt_url?: string | null;
          reference_number?: string | null;
          transaction_date?: string;
          verified_at?: string | null;
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
          amenities: string[] | null;
          base_occupancy: number;
          base_rate: number;
          cleaning_fee: number | null;
          created_at: string;
          description: string | null;
          extra_person_rate: number;
          images: string[] | null;
          max_occupancy: number;
          policies: string[] | null;
          unit_code: string;
          unit_id: string;
          unit_name: string;
          unit_status: Database["public"]["Enums"]["unit_status"];
          unit_type: Database["public"]["Enums"]["unit_type"];
          updated_at: string;
          weekend_rate: number;
        };
        Insert: {
          amenities?: string[] | null;
          base_occupancy?: number;
          base_rate: number;
          cleaning_fee?: number | null;
          created_at?: string;
          description?: string | null;
          extra_person_rate?: number;
          images?: string[] | null;
          max_occupancy: number;
          policies?: string[] | null;
          unit_code: string;
          unit_id?: string;
          unit_name: string;
          unit_status?: Database["public"]["Enums"]["unit_status"];
          unit_type: Database["public"]["Enums"]["unit_type"];
          updated_at?: string;
          weekend_rate: number;
        };
        Update: {
          amenities?: string[] | null;
          base_occupancy?: number;
          base_rate?: number;
          cleaning_fee?: number | null;
          created_at?: string;
          description?: string | null;
          extra_person_rate?: number;
          images?: string[] | null;
          max_occupancy?: number;
          policies?: string[] | null;
          unit_code?: string;
          unit_id?: string;
          unit_name?: string;
          unit_status?: Database["public"]["Enums"]["unit_status"];
          unit_type?: Database["public"]["Enums"]["unit_type"];
          updated_at?: string;
          weekend_rate?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
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
      check_unit_availability: {
        Args: {
          p_unit_id: string;
          p_check_in: string;
          p_check_out: string;
        };
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
      generate_booking_reference: {
        Args: Record<PropertyKey, never>;
        Returns: string;
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
        Returns: {
          total_cache_entries: number;
          valid_cache_entries: number;
          cache_hit_ratio_percent: number;
        }[];
      };
    };
    Enums: {
      blackout_type: "Maintenance" | "Renovation" | "Seasonal" | "Manual";
      booking_status: "Pending" | "Confirmed" | "CheckedIn" | "CheckedOut" | "Cancelled";
      payment_method: "Cash" | "GCash" | "BankTransfer" | "Card" | "Other";
      payment_status: "Pending" | "Partial" | "Completed" | "Refunded";
      unit_status: "Available" | "Occupied" | "Maintenance" | "Reserved";
      unit_type: "Standard" | "Deluxe" | "Suite" | "Villa";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    ? (PublicSchema["Tables"] & PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema["Enums"] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;

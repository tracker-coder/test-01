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
      audit_log: {
        Row: {
          action: string
          actor: string | null
          actor_name: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          summary: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name?: string
        }
        Relationships: []
      }
      banks: {
        Row: {
          account_number: string | null
          account_title: string
          bank_name: string
          created_at: string
          id: string
          is_active: boolean
          opening_balance: number
        }
        Insert: {
          account_number?: string | null
          account_title: string
          bank_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          opening_balance?: number
        }
        Update: {
          account_number?: string | null
          account_title?: string
          bank_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          opening_balance?: number
        }
        Relationships: []
      }
      cash_bank_transfers: {
        Row: {
          amount: number
          bank_id: string
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["transfer_dir"]
          id: string
          note: string | null
          tx_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_id: string
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["transfer_dir"]
          id?: string
          note?: string | null
          tx_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_id?: string
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["transfer_dir"]
          id?: string
          note?: string | null
          tx_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_bank_transfers_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bank_balances"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "cash_bank_transfers_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_ledger: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["ledger_dir"]
          id: string
          note: string | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["ledger_source"]
          tx_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["ledger_dir"]
          id?: string
          note?: string | null
          source_id?: string | null
          source_type: Database["public"]["Enums"]["ledger_source"]
          tx_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["ledger_dir"]
          id?: string
          note?: string | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["ledger_source"]
          tx_date?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          bank_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          is_prepaid: boolean
          is_recurring: boolean
          paid_by: Database["public"]["Enums"]["pay_source"]
          prepaid_from: string | null
          prepaid_to: string | null
          recurring_day: number | null
        }
        Insert: {
          amount: number
          bank_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_prepaid?: boolean
          is_recurring?: boolean
          paid_by: Database["public"]["Enums"]["pay_source"]
          prepaid_from?: string | null
          prepaid_to?: string | null
          recurring_day?: number | null
        }
        Update: {
          amount?: number
          bank_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          is_prepaid?: boolean
          is_recurring?: boolean
          paid_by?: Database["public"]["Enums"]["pay_source"]
          prepaid_from?: string | null
          prepaid_to?: string | null
          recurring_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bank_balances"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "expenses_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      party_openings: {
        Row: {
          amount: number
          as_of: string
          direction: string
          id: string
          note: string | null
          party_id: string
          party_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          as_of?: string
          direction: string
          id?: string
          note?: string | null
          party_id: string
          party_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          as_of?: string
          direction?: string
          id?: string
          note?: string | null
          party_id?: string
          party_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      party_payments: {
        Row: {
          amount: number
          bank_id: string | null
          created_at: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["pay_source"]
          note: string | null
          party_id: string
          party_type: string
          tx_date: string
        }
        Insert: {
          amount: number
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          method: Database["public"]["Enums"]["pay_source"]
          note?: string | null
          party_id: string
          party_type: string
          tx_date?: string
        }
        Update: {
          amount?: number
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["pay_source"]
          note?: string | null
          party_id?: string
          party_type?: string
          tx_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "party_payments_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bank_balances"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "party_payments_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      prepaid_topups: {
        Row: {
          amount: number
          bank_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          source: Database["public"]["Enums"]["pay_source"]
          tx_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          source?: Database["public"]["Enums"]["pay_source"]
          tx_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          source?: Database["public"]["Enums"]["pay_source"]
          tx_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepaid_topups_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bank_balances"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "prepaid_topups_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      product_openings: {
        Row: {
          as_of: string
          product_id: string
          quantity_g: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          as_of?: string
          product_id: string
          quantity_g?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          as_of?: string
          product_id?: string
          quantity_g?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_openings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_party_rates: {
        Row: {
          id: string
          last_used_at: string
          party_id: string
          party_type: Database["public"]["Enums"]["party_kind"]
          product_id: string
          rate: number
        }
        Insert: {
          id?: string
          last_used_at?: string
          party_id: string
          party_type: Database["public"]["Enums"]["party_kind"]
          product_id: string
          rate: number
        }
        Update: {
          id?: string
          last_used_at?: string
          party_id?: string
          party_type?: Database["public"]["Enums"]["party_kind"]
          product_id?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_party_rates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          product_id: string
          purchase_id: string
          quantity_g: number
          rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          product_id: string
          purchase_id: string
          quantity_g: number
          rate: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string
          purchase_id?: string
          quantity_g?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          bank_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_by: Database["public"]["Enums"]["pay_source"]
          purchase_date: string
          supplier_id: string | null
          total_amount: number
        }
        Insert: {
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_by?: Database["public"]["Enums"]["pay_source"]
          purchase_date?: string
          supplier_id?: string | null
          total_amount?: number
        }
        Update: {
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_by?: Database["public"]["Enums"]["pay_source"]
          purchase_date?: string
          supplier_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bank_balances"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "purchases_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          cutting_g: number
          id: string
          line_total: number
          product_id: string
          quantity_g: number
          rate: number
          sale_id: string
        }
        Insert: {
          created_at?: string
          cutting_g?: number
          id?: string
          line_total?: number
          product_id: string
          quantity_g: number
          rate: number
          sale_id: string
        }
        Update: {
          created_at?: string
          cutting_g?: number
          id?: string
          line_total?: number
          product_id?: string
          quantity_g?: number
          rate?: number
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          bank_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          loading_charges: number
          notes: string | null
          paid_by: string
          reference_no: string | null
          sale_date: string
          shipping_charges: number
          total_amount: number
        }
        Insert: {
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          loading_charges?: number
          notes?: string | null
          paid_by?: string
          reference_no?: string | null
          sale_date?: string
          shipping_charges?: number
          total_amount?: number
        }
        Update: {
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          loading_charges?: number
          notes?: string | null
          paid_by?: string
          reference_no?: string | null
          sale_date?: string
          shipping_charges?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bank_balances"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "sales_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_sales: {
        Row: {
          amount: number
          bank_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          note: string | null
          paid_by: string
          sale_date: string
          service_name: string
        }
        Insert: {
          amount: number
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          note?: string | null
          paid_by: string
          sale_date?: string
          service_name?: string
        }
        Update: {
          amount?: number
          bank_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          note?: string | null
          paid_by?: string
          sale_date?: string
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_sales_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bank_balances"
            referencedColumns: ["bank_id"]
          },
          {
            foreignKeyName: "service_sales_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          business_name: string
          currency: string
          id: number
          opening_cash: number
          opening_cash_date: string
          updated_at: string
        }
        Insert: {
          business_name?: string
          currency?: string
          id?: number
          opening_cash?: number
          opening_cash_date?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          currency?: string
          id?: number
          opening_cash?: number
          opening_cash_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      bank_balances: {
        Row: {
          account_title: string | null
          bank_id: string | null
          bank_name: string | null
          current_balance: number | null
          is_active: boolean | null
          opening_balance: number | null
          total_in: number | null
          total_out: number | null
        }
        Insert: {
          account_title?: string | null
          bank_id?: string | null
          bank_name?: string | null
          current_balance?: never
          is_active?: boolean | null
          opening_balance?: number | null
          total_in?: never
          total_out?: never
        }
        Update: {
          account_title?: string | null
          bank_id?: string | null
          bank_name?: string | null
          current_balance?: never
          is_active?: boolean | null
          opening_balance?: number | null
          total_in?: never
          total_out?: never
        }
        Relationships: []
      }
      bank_ledger: {
        Row: {
          amount: number | null
          bank_id: string | null
          created_at: string | null
          direction: Database["public"]["Enums"]["ledger_dir"] | null
          note: string | null
          source_id: string | null
          source_type: string | null
          tx_date: string | null
        }
        Relationships: []
      }
      cash_balance: {
        Row: {
          current_cash: number | null
        }
        Relationships: []
      }
      party_balances: {
        Row: {
          balance: number | null
          is_active: boolean | null
          name: string | null
          party_id: string | null
          party_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      ledger_dir: "in" | "out"
      ledger_source: "opening" | "sale" | "purchase" | "expense" | "adjustment"
      party_kind: "supplier" | "customer"
      pay_source: "cash" | "bank" | "credit"
      transfer_dir: "deposit" | "withdrawal"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      ledger_dir: ["in", "out"],
      ledger_source: ["opening", "sale", "purchase", "expense", "adjustment"],
      party_kind: ["supplier", "customer"],
      pay_source: ["cash", "bank", "credit"],
      transfer_dir: ["deposit", "withdrawal"],
    },
  },
} as const

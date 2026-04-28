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
      orders: {
        Row: {
          admin_commission: number
          buyer_id: string
          created_at: string
          credentials_email: string
          credentials_password: string
          id: string
          product_id: string
          seller_earning: number
          seller_id: string
          service_name: string
          status: Database["public"]["Enums"]["order_status"]
          total_paid: number
        }
        Insert: {
          admin_commission: number
          buyer_id: string
          created_at?: string
          credentials_email: string
          credentials_password: string
          id?: string
          product_id: string
          seller_earning: number
          seller_id: string
          service_name: string
          status?: Database["public"]["Enums"]["order_status"]
          total_paid: number
        }
        Update: {
          admin_commission?: number
          buyer_id?: string
          created_at?: string
          credentials_email?: string
          credentials_password?: string
          id?: string
          product_id?: string
          seller_earning?: number
          seller_id?: string
          service_name?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          credentials_email: string
          credentials_password: string
          description: string | null
          display_price: number
          duration: string | null
          id: string
          image_url: string | null
          seller_id: string
          service_name: string
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          updated_at: string
        }
        Insert: {
          base_price: number
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          credentials_email: string
          credentials_password: string
          description?: string | null
          display_price: number
          duration?: string | null
          id?: string
          image_url?: string | null
          seller_id: string
          service_name: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          credentials_email?: string
          credentials_password?: string
          description?: string | null
          display_price?: number
          duration?: string | null
          id?: string
          image_url?: string | null
          seller_id?: string
          service_name?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
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
      vendor_applications: {
        Row: {
          business_name: string
          created_at: string
          description: string | null
          id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Insert: {
          business_name: string
          created_at?: string
          description?: string | null
          id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Update: {
          business_name?: string
          created_at?: string
          description?: string | null
          id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          reviewed_at: string | null
          screenshot_path: string
          status: Database["public"]["Enums"]["topup_status"]
          upi_reference: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          screenshot_path: string
          status?: Database["public"]["Enums"]["topup_status"]
          upi_reference?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          screenshot_path?: string
          status?: Database["public"]["Enums"]["topup_status"]
          upi_reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          reviewed_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          upi_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          upi_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          upi_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_topup: { Args: { _topup_id: string }; Returns: undefined }
      approve_vendor: { Args: { _app_id: string }; Returns: undefined }
      approve_withdrawal: { Args: { _wd_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      purchase_product: { Args: { _product_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "seller" | "buyer"
      application_status: "pending" | "approved" | "rejected"
      order_status: "completed" | "refunded"
      product_category: "OTT" | "AI Tools" | "VPN" | "SMM" | "Other"
      product_status: "hidden" | "approved" | "rejected"
      topup_status: "pending" | "approved" | "rejected"
      withdrawal_status: "pending" | "approved" | "rejected"
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
    Enums: {
      app_role: ["admin", "seller", "buyer"],
      application_status: ["pending", "approved", "rejected"],
      order_status: ["completed", "refunded"],
      product_category: ["OTT", "AI Tools", "VPN", "SMM", "Other"],
      product_status: ["hidden", "approved", "rejected"],
      topup_status: ["pending", "approved", "rejected"],
      withdrawal_status: ["pending", "approved", "rejected"],
    },
  },
} as const

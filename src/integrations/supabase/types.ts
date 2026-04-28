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
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          ip: string | null
          landing_path: string | null
          referrer_url: string | null
          slug: string
          user_agent: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          ip?: string | null
          landing_path?: string | null
          referrer_url?: string | null
          slug: string
          user_agent?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          ip?: string | null
          landing_path?: string | null
          referrer_url?: string | null
          slug?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      affiliate_conversions: {
        Row: {
          affiliate_id: string
          buyer_id: string
          commission_amount: number
          commission_percent: number
          created_at: string
          id: string
          order_id: string
          order_total: number
          status: string
        }
        Insert: {
          affiliate_id: string
          buyer_id: string
          commission_amount: number
          commission_percent: number
          created_at?: string
          id?: string
          order_id: string
          order_total: number
          status?: string
        }
        Update: {
          affiliate_id?: string
          buyer_id?: string
          commission_amount?: number
          commission_percent?: number
          created_at?: string
          id?: string
          order_id?: string
          order_total?: number
          status?: string
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          approved_at: string | null
          commission_percent: number
          created_at: string
          id: string
          notes: string | null
          slug: string
          status: Database["public"]["Enums"]["affiliate_status"]
          total_clicks: number
          total_conversions: number
          total_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          commission_percent?: number
          created_at?: string
          id?: string
          notes?: string | null
          slug: string
          status?: Database["public"]["Enums"]["affiliate_status"]
          total_clicks?: number
          total_conversions?: number
          total_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          commission_percent?: number
          created_at?: string
          id?: string
          notes?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["affiliate_status"]
          total_clicks?: number
          total_conversions?: number
          total_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          title: string
          variant: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          title: string
          variant?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          title?: string
          variant?: string
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          discount_applied: number
          id: string
          order_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_applied: number
          id?: string
          order_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_applied?: number
          id?: string
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          auto_issue: boolean
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at: string | null
          first_order_only: boolean
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_value: number
          one_per_user: boolean
          owner_user_id: string | null
          scope: string
          used_count: number
        }
        Insert: {
          auto_issue?: boolean
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_value?: number
          one_per_user?: boolean
          owner_user_id?: string | null
          scope?: string
          used_count?: number
        }
        Update: {
          auto_issue?: boolean
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_value?: number
          one_per_user?: boolean
          owner_user_id?: string | null
          scope?: string
          used_count?: number
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          resolved: boolean
          severity: string
          signal: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean
          severity?: string
          signal: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean
          severity?: string
          signal?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_commission: number
          buyer_id: string
          created_at: string
          credential_id: string | null
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
          credential_id?: string | null
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
          credential_id?: string | null
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
      platform_settings: {
        Row: {
          commission_percent: number
          featured_limit: number
          id: number
          maintenance_mode: boolean
          trending_limit: number
          updated_at: string
          upi_id: string
        }
        Insert: {
          commission_percent?: number
          featured_limit?: number
          id?: number
          maintenance_mode?: boolean
          trending_limit?: number
          updated_at?: string
          upi_id?: string
        }
        Update: {
          commission_percent?: number
          featured_limit?: number
          id?: number
          maintenance_mode?: boolean
          trending_limit?: number
          updated_at?: string
          upi_id?: string
        }
        Relationships: []
      }
      product_credentials: {
        Row: {
          access_link: string | null
          assigned_at: string | null
          assigned_order_id: string | null
          created_at: string
          cred_email: string
          cred_password: string
          id: string
          notes: string | null
          product_id: string
          seller_id: string
          status: Database["public"]["Enums"]["credential_status"]
        }
        Insert: {
          access_link?: string | null
          assigned_at?: string | null
          assigned_order_id?: string | null
          created_at?: string
          cred_email: string
          cred_password: string
          id?: string
          notes?: string | null
          product_id: string
          seller_id: string
          status?: Database["public"]["Enums"]["credential_status"]
        }
        Update: {
          access_link?: string | null
          assigned_at?: string | null
          assigned_order_id?: string | null
          created_at?: string
          cred_email?: string
          cred_password?: string
          id?: string
          notes?: string | null
          product_id?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["credential_status"]
        }
        Relationships: [
          {
            foreignKeyName: "product_credentials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          avg_rating: number
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
          is_active: boolean
          is_featured: boolean
          is_trending: boolean
          rating_count: number
          seller_id: string
          service_name: string
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          updated_at: string
        }
        Insert: {
          avg_rating?: number
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
          is_active?: boolean
          is_featured?: boolean
          is_trending?: boolean
          rating_count?: number
          seller_id: string
          service_name: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          updated_at?: string
        }
        Update: {
          avg_rating?: number
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
          is_active?: boolean
          is_featured?: boolean
          is_trending?: boolean
          rating_count?: number
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
          ban_reason: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_banned: boolean
          phone: string | null
          referred_by: string | null
          signup_ip: string | null
          updated_at: string
        }
        Insert: {
          ban_reason?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_banned?: boolean
          phone?: string | null
          referred_by?: string | null
          signup_ip?: string | null
          updated_at?: string
        }
        Update: {
          ban_reason?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_banned?: boolean
          phone?: string | null
          referred_by?: string | null
          signup_ip?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          converted_at: string | null
          created_at: string
          id: string
          referred_user_id: string
          referrer_id: string
          reward_amount: number
          rewarded_at: string | null
          signup_ip: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          code: string
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_id: string
          reward_amount?: number
          rewarded_at?: string | null
          signup_ip?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          code?: string
          converted_at?: string | null
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_id?: string
          reward_amount?: number
          rewarded_at?: string | null
          signup_ip?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          id: string
          order_id: string
          processed_by: string | null
          reason: string | null
          seller_id: string
          status: Database["public"]["Enums"]["refund_status"]
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          id?: string
          order_id: string
          processed_by?: string | null
          reason?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          id?: string
          order_id?: string
          processed_by?: string | null
          reason?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["refund_status"]
        }
        Relationships: []
      }
      reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          order_id: string
          product_id: string
          rating: number
          seller_id: string
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          rating: number
          seller_id: string
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          rating?: number
          seller_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string | null
          created_at: string
          id: string
          related_order_id: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          related_order_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          related_order_id?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_admin_reply: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_admin_reply?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
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
          experience: string | null
          flag_reason: string | null
          id: string
          is_flagged: boolean
          product_type: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Insert: {
          business_name: string
          created_at?: string
          description?: string | null
          experience?: string | null
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          product_type?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          user_id: string
        }
        Update: {
          business_name?: string
          created_at?: string
          description?: string | null
          experience?: string | null
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          product_type?: string | null
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
      admin_set_affiliate: {
        Args: {
          _commission: number
          _slug: string
          _status?: Database["public"]["Enums"]["affiliate_status"]
          _user_id: string
        }
        Returns: string
      }
      approve_topup: { Args: { _topup_id: string }; Returns: undefined }
      approve_vendor: { Args: { _app_id: string }; Returns: undefined }
      approve_withdrawal: { Args: { _wd_id: string }; Returns: undefined }
      gen_referral_code: { Args: { _seed: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      issue_refund: {
        Args: { _order_id: string; _reason?: string }
        Returns: string
      }
      purchase_product:
        | {
            Args: { _coupon_code?: string; _product_id: string }
            Returns: string
          }
        | {
            Args: {
              _affiliate_slug?: string
              _coupon_code?: string
              _product_id: string
            }
            Returns: string
          }
      set_user_ban: {
        Args: { _banned: boolean; _reason?: string; _user_id: string }
        Returns: undefined
      }
      track_affiliate_click: {
        Args: {
          _ip: string
          _path: string
          _ref: string
          _slug: string
          _ua: string
        }
        Returns: undefined
      }
      validate_coupon: {
        Args: { _code: string; _subtotal: number }
        Returns: {
          coupon_id: string
          discount: number
          message: string
        }[]
      }
    }
    Enums: {
      affiliate_status: "pending" | "approved" | "suspended"
      app_role: "admin" | "seller" | "buyer"
      application_status: "pending" | "approved" | "rejected"
      credential_status: "available" | "assigned"
      discount_type: "percent" | "fixed"
      order_status: "completed" | "refunded"
      product_category: "OTT" | "AI Tools" | "VPN" | "SMM" | "Other"
      product_status: "hidden" | "approved" | "rejected"
      refund_status: "pending" | "processed" | "rejected"
      ticket_status: "open" | "pending_user" | "closed"
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
      affiliate_status: ["pending", "approved", "suspended"],
      app_role: ["admin", "seller", "buyer"],
      application_status: ["pending", "approved", "rejected"],
      credential_status: ["available", "assigned"],
      discount_type: ["percent", "fixed"],
      order_status: ["completed", "refunded"],
      product_category: ["OTT", "AI Tools", "VPN", "SMM", "Other"],
      product_status: ["hidden", "approved", "rejected"],
      refund_status: ["pending", "processed", "rejected"],
      ticket_status: ["open", "pending_user", "closed"],
      topup_status: ["pending", "approved", "rejected"],
      withdrawal_status: ["pending", "approved", "rejected"],
    },
  },
} as const

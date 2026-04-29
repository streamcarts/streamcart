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
          order_id: string | null
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
          order_id?: string | null
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
          order_id?: string | null
          order_total?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "admin_orders_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      category_items: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          category_id: string
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          category_id: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          category_id?: string
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string | null
          chat_id: string
          chat_image_path: string | null
          created_at: string
          cred_email: string | null
          cred_notes: string | null
          cred_password: string | null
          flag_reason: string | null
          id: string
          is_blocked: boolean
          is_flagged: boolean
          kind: string
          sender_id: string | null
        }
        Insert: {
          body?: string | null
          chat_id: string
          chat_image_path?: string | null
          created_at?: string
          cred_email?: string | null
          cred_notes?: string | null
          cred_password?: string | null
          flag_reason?: string | null
          id?: string
          is_blocked?: boolean
          is_flagged?: boolean
          kind?: string
          sender_id?: string | null
        }
        Update: {
          body?: string | null
          chat_id?: string
          chat_image_path?: string | null
          created_at?: string
          cred_email?: string | null
          cred_notes?: string | null
          cred_password?: string | null
          flag_reason?: string | null
          id?: string
          is_blocked?: boolean
          is_flagged?: boolean
          kind?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "order_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          buyer_id: string
          created_at: string
          details: string | null
          id: string
          order_id: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          seller_id: string
          status: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          details?: string | null
          id?: string
          order_id: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id: string
          status?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          details?: string | null
          id?: string
          order_id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          seller_id?: string
          status?: string
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
      device_sessions: {
        Row: {
          created_at: string
          device_fp: string | null
          event: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fp?: string | null
          event?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fp?: string | null
          event?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      earnings_holds: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string | null
          release_at: string
          released_at: string | null
          released_by: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id?: string | null
          release_at?: string
          released_at?: string | null
          released_by?: string | null
          source: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          release_at?: string
          released_at?: string | null
          released_by?: string | null
          source?: string
          status?: string
          user_id?: string
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          link: string | null
          push_sent: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          link?: string | null
          push_sent?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          link?: string | null
          push_sent?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_chats: {
        Row: {
          auto_complete_at: string | null
          buyer_id: string
          buyer_last_read_at: string
          completed_at: string | null
          created_at: string
          delivered_at: string | null
          id: string
          order_id: string
          response_due_at: string
          seller_id: string
          seller_last_read_at: string
          status: string
          updated_at: string
        }
        Insert: {
          auto_complete_at?: string | null
          buyer_id: string
          buyer_last_read_at?: string
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id: string
          response_due_at?: string
          seller_id: string
          seller_last_read_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auto_complete_at?: string | null
          buyer_id?: string
          buyer_last_read_at?: string
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string
          response_due_at?: string
          seller_id?: string
          seller_last_read_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_commission: number
          buyer_id: string
          chat_id: string | null
          created_at: string
          credential_id: string | null
          credentials_email: string | null
          credentials_password: string | null
          credentials_sent_at: string | null
          delivery_mode: Database["public"]["Enums"]["delivery_mode"]
          id: string
          product_id: string | null
          received_at: string | null
          seller_earning: number
          seller_id: string
          service_name: string
          status: Database["public"]["Enums"]["order_status"]
          tier_label: string | null
          total_paid: number
        }
        Insert: {
          admin_commission: number
          buyer_id: string
          chat_id?: string | null
          created_at?: string
          credential_id?: string | null
          credentials_email?: string | null
          credentials_password?: string | null
          credentials_sent_at?: string | null
          delivery_mode?: Database["public"]["Enums"]["delivery_mode"]
          id?: string
          product_id?: string | null
          received_at?: string | null
          seller_earning: number
          seller_id: string
          service_name: string
          status?: Database["public"]["Enums"]["order_status"]
          tier_label?: string | null
          total_paid: number
        }
        Update: {
          admin_commission?: number
          buyer_id?: string
          chat_id?: string | null
          created_at?: string
          credential_id?: string | null
          credentials_email?: string | null
          credentials_password?: string | null
          credentials_sent_at?: string | null
          delivery_mode?: Database["public"]["Enums"]["delivery_mode"]
          id?: string
          product_id?: string | null
          received_at?: string | null
          seller_earning?: number
          seller_id?: string
          service_name?: string
          status?: Database["public"]["Enums"]["order_status"]
          tier_label?: string | null
          total_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "product_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_orders: {
        Row: {
          admin_note: string | null
          affiliate_slug: string | null
          amount: number
          auto_match_score: number
          buyer_id: string
          coupon_code: string | null
          created_at: string
          expires_at: string
          id: string
          items: Json
          ocr_amount: number | null
          ocr_processed_at: string | null
          ocr_raw: string | null
          ocr_reference: string | null
          ocr_status: string
          order_ids: string[] | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_path: string
          status: string
          txn_id: string | null
          updated_at: string
          upi_reference: string | null
        }
        Insert: {
          admin_note?: string | null
          affiliate_slug?: string | null
          amount: number
          auto_match_score?: number
          buyer_id: string
          coupon_code?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          items: Json
          ocr_amount?: number | null
          ocr_processed_at?: string | null
          ocr_raw?: string | null
          ocr_reference?: string | null
          ocr_status?: string
          order_ids?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_path: string
          status?: string
          txn_id?: string | null
          updated_at?: string
          upi_reference?: string | null
        }
        Update: {
          admin_note?: string | null
          affiliate_slug?: string | null
          amount?: number
          auto_match_score?: number
          buyer_id?: string
          coupon_code?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          items?: Json
          ocr_amount?: number | null
          ocr_processed_at?: string | null
          ocr_raw?: string | null
          ocr_reference?: string | null
          ocr_status?: string
          order_ids?: string[] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_path?: string
          status?: string
          txn_id?: string | null
          updated_at?: string
          upi_reference?: string | null
        }
        Relationships: []
      }
      platform_durations: {
        Row: {
          created_at: string
          days: number
          id: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          days: number
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          days?: number
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      platform_pricing: {
        Row: {
          created_at: string
          duration_id: string
          id: string
          min_price: number
          platform_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_id: string
          id?: string
          min_price: number
          platform_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_id?: string
          id?: string
          min_price?: number
          platform_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_pricing_duration_id_fkey"
            columns: ["duration_id"]
            isOneToOne: false
            referencedRelation: "platform_durations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_pricing_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
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
      platforms: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          min_price: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          min_price?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          min_price?: number
          name?: string
          sort_order?: number
          updated_at?: string
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
          credentials_email: string | null
          credentials_password: string | null
          delivery_mode: Database["public"]["Enums"]["delivery_mode"]
          description: string | null
          device_logins: number | null
          device_types: string[]
          display_price: number
          duration: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          is_private_account: boolean
          is_trending: boolean
          plan_name: string | null
          platform: string | null
          platform_id: string | null
          price_tiers: Json
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
          credentials_email?: string | null
          credentials_password?: string | null
          delivery_mode?: Database["public"]["Enums"]["delivery_mode"]
          description?: string | null
          device_logins?: number | null
          device_types?: string[]
          display_price: number
          duration?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_private_account?: boolean
          is_trending?: boolean
          plan_name?: string | null
          platform?: string | null
          platform_id?: string | null
          price_tiers?: Json
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
          credentials_email?: string | null
          credentials_password?: string | null
          delivery_mode?: Database["public"]["Enums"]["delivery_mode"]
          description?: string | null
          device_logins?: number | null
          device_types?: string[]
          display_price?: number
          duration?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_private_account?: boolean
          is_trending?: boolean
          plan_name?: string | null
          platform?: string | null
          platform_id?: string | null
          price_tiers?: Json
          rating_count?: number
          seller_id?: string
          service_name?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ban_reason: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_banned: boolean
          is_restricted: boolean
          is_verified_seller: boolean
          last_seen_at: string | null
          phone: string | null
          referred_by: string | null
          restriction_reason: string | null
          signup_ip: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          ban_reason?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_banned?: boolean
          is_restricted?: boolean
          is_verified_seller?: boolean
          last_seen_at?: string | null
          phone?: string | null
          referred_by?: string | null
          restriction_reason?: string | null
          signup_ip?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          ban_reason?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_banned?: boolean
          is_restricted?: boolean
          is_verified_seller?: boolean
          last_seen_at?: string | null
          phone?: string | null
          referred_by?: string | null
          restriction_reason?: string | null
          signup_ip?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
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
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "admin_orders_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_flags: {
        Row: {
          chat_id: string | null
          created_at: string
          id: string
          message_id: string | null
          message_preview: string | null
          reason: string
          resolved: boolean
          seller_id: string
          severity: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          message_preview?: string | null
          reason: string
          resolved?: boolean
          seller_id: string
          severity?: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          message_preview?: string | null
          reason?: string
          resolved?: boolean
          seller_id?: string
          severity?: string
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
          whatsapp_number: string | null
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
          whatsapp_number?: string | null
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
          whatsapp_number?: string | null
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
          pending_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          pending_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          pending_balance?: number
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
          qr_screenshot_path: string | null
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
          qr_screenshot_path?: string | null
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
          qr_screenshot_path?: string | null
          reviewed_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          upi_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_orders_safe: {
        Row: {
          admin_commission: number | null
          buyer_id: string | null
          chat_id: string | null
          created_at: string | null
          credentials_email_masked: string | null
          credentials_password_masked: string | null
          credentials_sent_at: string | null
          delivery_mode: Database["public"]["Enums"]["delivery_mode"] | null
          id: string | null
          product_id: string | null
          received_at: string | null
          seller_earning: number | null
          seller_id: string | null
          service_name: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          tier_label: string | null
          total_paid: number | null
        }
        Insert: {
          admin_commission?: number | null
          buyer_id?: string | null
          chat_id?: string | null
          created_at?: string | null
          credentials_email_masked?: never
          credentials_password_masked?: never
          credentials_sent_at?: string | null
          delivery_mode?: Database["public"]["Enums"]["delivery_mode"] | null
          id?: string | null
          product_id?: string | null
          received_at?: string | null
          seller_earning?: number | null
          seller_id?: string | null
          service_name?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tier_label?: string | null
          total_paid?: number | null
        }
        Update: {
          admin_commission?: number | null
          buyer_id?: string | null
          chat_id?: string | null
          created_at?: string | null
          credentials_email_masked?: never
          credentials_password_masked?: never
          credentials_sent_at?: string | null
          delivery_mode?: Database["public"]["Enums"]["delivery_mode"] | null
          id?: string | null
          product_id?: string | null
          received_at?: string | null
          seller_earning?: number | null
          seller_id?: string | null
          service_name?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tier_label?: string | null
          total_paid?: number | null
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
    }
    Functions: {
      _admin_purchase_for_buyer: {
        Args: {
          _affiliate_slug?: string
          _buyer: string
          _coupon_code?: string
          _product_id: string
        }
        Returns: string
      }
      add_earning_to_hold: {
        Args: {
          _amount: number
          _order_id?: string
          _source: string
          _user_id: string
        }
        Returns: undefined
      }
      admin_clear_seller_restriction: {
        Args: { _note?: string; _seller_id: string }
        Returns: undefined
      }
      admin_release_hold: { Args: { _hold_id: string }; Returns: undefined }
      admin_release_user_holds: { Args: { _user_id: string }; Returns: number }
      admin_resolve_seller_flag: {
        Args: { _flag_id: string }
        Returns: undefined
      }
      admin_set_affiliate: {
        Args: {
          _commission: number
          _slug: string
          _status?: Database["public"]["Enums"]["affiliate_status"]
          _user_id: string
        }
        Returns: string
      }
      approve_pending_order: {
        Args: { _id: string; _note?: string }
        Returns: string[]
      }
      approve_topup: { Args: { _topup_id: string }; Returns: undefined }
      approve_vendor: { Args: { _app_id: string }; Returns: undefined }
      approve_withdrawal: { Args: { _wd_id: string }; Returns: undefined }
      auto_complete_chat_orders: { Args: never; Returns: number }
      cancel_expired_pending_orders: { Args: never; Returns: number }
      cancel_my_pending_order: { Args: { _id: string }; Returns: undefined }
      detect_contact_info: {
        Args: { _text: string }
        Returns: {
          found: boolean
          reason: string
        }[]
      }
      ensure_order_chat: { Args: { _order_id: string }; Returns: string }
      expire_pending_orders: { Args: never; Returns: number }
      file_complaint: {
        Args: { _details?: string; _order_id: string; _reason: string }
        Returns: string
      }
      flag_repeated_fraud: { Args: { _user_id: string }; Returns: undefined }
      gen_referral_code: { Args: { _seed: string }; Returns: string }
      get_platform_min_price: {
        Args: { _duration_label: string; _platform_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_seller_verified: { Args: { _seller_id: string }; Returns: boolean }
      is_user_online: { Args: { _user_id: string }; Returns: boolean }
      issue_refund: {
        Args: { _order_id: string; _reason?: string }
        Returns: string
      }
      log_device_session: {
        Args: {
          _device_fp: string
          _event?: string
          _ip: string
          _user_agent: string
        }
        Returns: string
      }
      mark_chat_read: { Args: { _chat_id: string }; Returns: undefined }
      mark_order_received: { Args: { _order_id: string }; Returns: undefined }
      notify_admins: {
        Args: {
          _body: string
          _data: Json
          _link: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      process_refund: {
        Args: { _order_id: string; _reason?: string }
        Returns: string
      }
      purchase_chat_product: {
        Args: {
          _affiliate_slug?: string
          _coupon_code?: string
          _product_id: string
          _tier_label: string
          _tier_price: number
        }
        Returns: string
      }
      purchase_product: {
        Args: {
          _affiliate_slug?: string
          _coupon_code?: string
          _product_id: string
        }
        Returns: string
      }
      redact_secret: { Args: { _v: string }; Returns: string }
      reject_pending_order: {
        Args: { _id: string; _note?: string }
        Returns: undefined
      }
      reject_withdrawal: {
        Args: { _note?: string; _wd_id: string }
        Returns: undefined
      }
      release_due_earnings: { Args: never; Returns: number }
      request_withdrawal: {
        Args: { _amount: number; _qr_path: string; _upi_id: string }
        Returns: string
      }
      score_pending_order: {
        Args: { _po: Database["public"]["Tables"]["pending_orders"]["Row"] }
        Returns: {
          score: number
          should_auto_approve: boolean
          tag: string
        }[]
      }
      send_chat_credentials: {
        Args: {
          _chat_id: string
          _email: string
          _notes?: string
          _password: string
        }
        Returns: string
      }
      send_chat_image: {
        Args: {
          _chat_id: string
          _contact_detected: boolean
          _detect_reason: string
          _image_path: string
          _ocr_text: string
        }
        Returns: string
      }
      send_chat_message: {
        Args: { _body: string; _chat_id: string }
        Returns: string
      }
      set_user_ban: {
        Args: { _banned: boolean; _reason?: string; _user_id: string }
        Returns: undefined
      }
      submit_pending_order: {
        Args: {
          _affiliate_slug?: string
          _amount: number
          _coupon_code?: string
          _items: Json
          _screenshot_path: string
          _txn_id: string
          _upi_reference?: string
        }
        Returns: string
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
      update_my_presence: { Args: never; Returns: undefined }
      user_risk_score: {
        Args: { _user_id: string }
        Returns: {
          level: string
          reasons: Json
          score: number
        }[]
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
      account_type: "private" | "shared"
      affiliate_status: "pending" | "approved" | "suspended"
      app_role: "admin" | "seller" | "buyer"
      application_status: "pending" | "approved" | "rejected"
      credential_status: "available" | "assigned"
      delivery_mode: "instant" | "chat"
      discount_type: "percent" | "fixed"
      order_status: "completed" | "refunded" | "pending"
      product_category: "OTT" | "AI Tools" | "VPN" | "SMM" | "Other" | "Bundles"
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
      account_type: ["private", "shared"],
      affiliate_status: ["pending", "approved", "suspended"],
      app_role: ["admin", "seller", "buyer"],
      application_status: ["pending", "approved", "rejected"],
      credential_status: ["available", "assigned"],
      delivery_mode: ["instant", "chat"],
      discount_type: ["percent", "fixed"],
      order_status: ["completed", "refunded", "pending"],
      product_category: ["OTT", "AI Tools", "VPN", "SMM", "Other", "Bundles"],
      product_status: ["hidden", "approved", "rejected"],
      refund_status: ["pending", "processed", "rejected"],
      ticket_status: ["open", "pending_user", "closed"],
      topup_status: ["pending", "approved", "rejected"],
      withdrawal_status: ["pending", "approved", "rejected"],
    },
  },
} as const

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
      account_change_audit: {
        Row: {
          action: string
          created_at: string
          id: number
          new_value: string | null
          old_value: string | null
          request_id: string | null
          request_ip: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          new_value?: string | null
          old_value?: string | null
          request_id?: string | null
          request_ip?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          new_value?: string | null
          old_value?: string | null
          request_id?: string | null
          request_ip?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_change_audit_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "account_change_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      account_change_requests: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          purpose: string
          request_ip: string | null
          token_hash: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          request_ip?: string | null
          token_hash: string
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          request_ip?: string | null
          token_hash?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_dashboard_config: {
        Row: {
          admin_id: string
          id: string
          layout: Json
          updated_at: string
        }
        Insert: {
          admin_id: string
          id?: string
          layout?: Json
          updated_at?: string
        }
        Update: {
          admin_id?: string
          id?: string
          layout?: Json
          updated_at?: string
        }
        Relationships: []
      }
      admin_device_tokens: {
        Row: {
          admin_user_id: string | null
          apns_environment: string
          created_at: string
          device_token: string
          id: string
          last_seen_at: string
          platform: string
        }
        Insert: {
          admin_user_id?: string | null
          apns_environment?: string
          created_at?: string
          device_token: string
          id?: string
          last_seen_at?: string
          platform?: string
        }
        Update: {
          admin_user_id?: string | null
          apns_environment?: string
          created_at?: string
          device_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_device_tokens_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          invite_expires_at: string | null
          invite_status: string
          invite_token: string | null
          invited_by: string | null
          is_active: boolean | null
          role: string | null
          theme_preference: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_status?: string
          invite_token?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          role?: string | null
          theme_preference?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          invite_expires_at?: string | null
          invite_status?: string
          invite_token?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          role?: string | null
          theme_preference?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_daily_insights: {
        Row: {
          date: string
          generated_at: string
          id: string
          insights: Json
        }
        Insert: {
          date: string
          generated_at?: string
          id?: string
          insights: Json
        }
        Update: {
          date?: string
          generated_at?: string
          id?: string
          insights?: Json
        }
        Relationships: []
      }
      apple_secret_rotation: {
        Row: {
          id: boolean
          last_jwt_exp: string | null
          last_rotated_at: string | null
          last_status: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          last_jwt_exp?: string | null
          last_rotated_at?: string | null
          last_status?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          last_jwt_exp?: string | null
          last_rotated_at?: string | null
          last_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          admin_email: string
          admin_user_id: string | null
          after_value: Json | null
          before_value: Json | null
          created_at: string | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          admin_email: string
          admin_user_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          admin_email?: string
          admin_user_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      auth_identities: {
        Row: {
          created_at: string
          id: string
          identifier: string
          provider: string
          updated_at: string
          user_id: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          provider: string
          updated_at?: string
          user_id: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          provider?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      auth_otp_policy: {
        Row: {
          policy_key: string
          policy_value: number
          updated_at: string
        }
        Insert: {
          policy_key: string
          policy_value: number
          updated_at?: string
        }
        Update: {
          policy_key?: string
          policy_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      auth_signup_attempts: {
        Row: {
          completed_at: string | null
          created_at: string
          display_name: string
          email: string
          email_attempts: number
          email_code_expires_at: string | null
          email_code_hash: string | null
          email_verified_at: string | null
          expires_at: string
          id: string
          method: string
          phone: string
          phone_verified_at: string | null
          sms_message_id: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          display_name: string
          email: string
          email_attempts?: number
          email_code_expires_at?: string | null
          email_code_hash?: string | null
          email_verified_at?: string | null
          expires_at?: string
          id?: string
          method?: string
          phone: string
          phone_verified_at?: string | null
          sms_message_id?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          display_name?: string
          email?: string
          email_attempts?: number
          email_code_expires_at?: string | null
          email_code_hash?: string | null
          email_verified_at?: string | null
          expires_at?: string
          id?: string
          method?: string
          phone?: string
          phone_verified_at?: string | null
          sms_message_id?: string | null
          status?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          ai_generated: boolean | null
          author: string | null
          category: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          locale: string
          og_image_url: string | null
          published_at: string | null
          reading_time: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          title: string
          views: number | null
        }
        Insert: {
          ai_generated?: boolean | null
          author?: string | null
          category?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          locale?: string
          og_image_url?: string | null
          published_at?: string | null
          reading_time?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          title: string
          views?: number | null
        }
        Update: {
          ai_generated?: boolean | null
          author?: string | null
          category?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          locale?: string
          og_image_url?: string | null
          published_at?: string | null
          reading_time?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          title?: string
          views?: number | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          admin_note: string | null
          base_price: number | null
          booking_reference: string | null
          cancellation_reason: string | null
          confirmation_email_sent_at: string | null
          created_at: string | null
          credit_discount: number
          date: string
          discount_snapshot: Json | null
          duration_hours: number
          end_time: string
          human_code: string | null
          id: string
          is_free_booking: boolean | null
          is_test: boolean
          member_code: string | null
          order_group_id: string | null
          overstay_charged: number | null
          payment_method: string | null
          payment_provider: string | null
          period: string
          points_discount: number
          points_redeemed: number
          promo_code: string | null
          promo_code_id: string | null
          promo_discount: number
          provider_order_no: string | null
          qr_code: string | null
          refund_amount: number | null
          refund_fee: number | null
          refunded_at: string | null
          reminder_email_sent_at: string | null
          reschedule_count: number
          rescheduled_at: string | null
          slot_id: string | null
          start_time: string
          status: string | null
          stripe_capture_id: string | null
          stripe_payment_intent: string | null
          subtotal: number | null
          table_number: number | null
          total_price: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          base_price?: number | null
          booking_reference?: string | null
          cancellation_reason?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string | null
          credit_discount?: number
          date: string
          discount_snapshot?: Json | null
          duration_hours: number
          end_time: string
          human_code?: string | null
          id?: string
          is_free_booking?: boolean | null
          is_test?: boolean
          member_code?: string | null
          order_group_id?: string | null
          overstay_charged?: number | null
          payment_method?: string | null
          payment_provider?: string | null
          period: string
          points_discount?: number
          points_redeemed?: number
          promo_code?: string | null
          promo_code_id?: string | null
          promo_discount?: number
          provider_order_no?: string | null
          qr_code?: string | null
          refund_amount?: number | null
          refund_fee?: number | null
          refunded_at?: string | null
          reminder_email_sent_at?: string | null
          reschedule_count?: number
          rescheduled_at?: string | null
          slot_id?: string | null
          start_time: string
          status?: string | null
          stripe_capture_id?: string | null
          stripe_payment_intent?: string | null
          subtotal?: number | null
          table_number?: number | null
          total_price: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          base_price?: number | null
          booking_reference?: string | null
          cancellation_reason?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string | null
          credit_discount?: number
          date?: string
          discount_snapshot?: Json | null
          duration_hours?: number
          end_time?: string
          human_code?: string | null
          id?: string
          is_free_booking?: boolean | null
          is_test?: boolean
          member_code?: string | null
          order_group_id?: string | null
          overstay_charged?: number | null
          payment_method?: string | null
          payment_provider?: string | null
          period?: string
          points_discount?: number
          points_redeemed?: number
          promo_code?: string | null
          promo_code_id?: string | null
          promo_discount?: number
          provider_order_no?: string | null
          qr_code?: string | null
          refund_amount?: number | null
          refund_fee?: number | null
          refunded_at?: string | null
          reminder_email_sent_at?: string | null
          reschedule_count?: number
          rescheduled_at?: string | null
          slot_id?: string | null
          start_time?: string
          status?: string | null
          stripe_capture_id?: string | null
          stripe_payment_intent?: string | null
          subtotal?: number | null
          table_number?: number | null
          total_price?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_claims: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_claims_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          ends_at: string
          id: string
          name: string
          starts_at: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          ends_at: string
          id?: string
          name: string
          starts_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string
          id?: string
          name?: string
          starts_at?: string
          status?: string
        }
        Relationships: []
      }
      cancellation_log: {
        Row: {
          admin_id: string
          booking_id: string
          compensation_type: string
          compensation_value: number
          created_at: string
          id: string
          reason: string
        }
        Insert: {
          admin_id: string
          booking_id: string
          compensation_type?: string
          compensation_value?: number
          created_at?: string
          id?: string
          reason: string
        }
        Update: {
          admin_id?: string
          booking_id?: string
          compensation_type?: string
          compensation_value?: number
          created_at?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cancellation_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "door_bookings_sync_v"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "cancellation_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "door_bookings_v"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      contact_change_requests: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          current_code_expires_at: string | null
          current_code_hash: string | null
          current_message_id: string | null
          current_method: string
          current_value: string
          current_verified_at: string | null
          expires_at: string
          id: string
          kind: string
          new_code_expires_at: string | null
          new_code_hash: string | null
          new_message_id: string | null
          new_value: string
          new_verified_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          current_code_expires_at?: string | null
          current_code_hash?: string | null
          current_message_id?: string | null
          current_method: string
          current_value: string
          current_verified_at?: string | null
          expires_at?: string
          id?: string
          kind: string
          new_code_expires_at?: string | null
          new_code_hash?: string | null
          new_message_id?: string | null
          new_value: string
          new_verified_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          current_code_expires_at?: string | null
          current_code_hash?: string | null
          current_message_id?: string | null
          current_method?: string
          current_value?: string
          current_verified_at?: string | null
          expires_at?: string
          id?: string
          kind?: string
          new_code_expires_at?: string | null
          new_code_hash?: string | null
          new_message_id?: string | null
          new_value?: string
          new_verified_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      coupon_templates: {
        Row: {
          created_at: string
          created_by: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          name: string
          used_count: number
          valid_from: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          created_by: string
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name: string
          used_count?: number
          valid_from?: string
          valid_until: string
        }
        Update: {
          created_at?: string
          created_by?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          name?: string
          used_count?: number
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      credit_holds: {
        Row: {
          booking_id: string | null
          checkout_key: string
          created_at: string
          credits: number
          held_at: string
          id: string
          order_group_id: string | null
          redeemed_at: string | null
          released_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          checkout_key: string
          created_at?: string
          credits: number
          held_at?: string
          id?: string
          order_group_id?: string | null
          redeemed_at?: string | null
          released_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          checkout_key?: string
          created_at?: string
          credits?: number
          held_at?: string
          id?: string
          order_group_id?: string | null
          redeemed_at?: string | null
          released_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      credits_ledger: {
        Row: {
          actor_id: string | null
          amount: number
          balance_after: number
          created_at: string
          id: string
          note: string | null
          reference_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          note?: string | null
          reference_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          note?: string | null
          reference_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          error: string | null
          id: string
          metadata: Json | null
          method: string | null
          processed_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          error?: string | null
          id?: string
          metadata?: Json | null
          method?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          error?: string | null
          id?: string
          metadata?: Json | null
          method?: string | null
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      deleted_account_identities: {
        Row: {
          deleted_at: string
          id: string
          identifier_hash: string
          kind: string
          purge_after: string
        }
        Insert: {
          deleted_at?: string
          id?: string
          identifier_hash: string
          kind: string
          purge_after?: string
        }
        Update: {
          deleted_at?: string
          id?: string
          identifier_hash?: string
          kind?: string
          purge_after?: string
        }
        Relationships: []
      }
      door_access_logs: {
        Row: {
          allowed: boolean
          booking_id: string | null
          device_id: string
          id: number
          member_code: string | null
          method: string
          reason: string
          table_number: number | null
          ts: string
        }
        Insert: {
          allowed: boolean
          booking_id?: string | null
          device_id: string
          id?: never
          member_code?: string | null
          method?: string
          reason: string
          table_number?: number | null
          ts?: string
        }
        Update: {
          allowed?: boolean
          booking_id?: string | null
          device_id?: string
          id?: never
          member_code?: string | null
          method?: string
          reason?: string
          table_number?: number | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "door_access_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "door_access_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "door_bookings_sync_v"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "door_access_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "door_bookings_v"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      door_devices: {
        Row: {
          api_key_hash: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          last_seen_at: string | null
          scopes: string[]
        }
        Insert: {
          api_key_hash?: string | null
          created_at?: string
          id: string
          is_active?: boolean
          label?: string | null
          last_seen_at?: string | null
          scopes?: string[]
        }
        Update: {
          api_key_hash?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          last_seen_at?: string | null
          scopes?: string[]
        }
        Relationships: []
      }
      help_feedback: {
        Row: {
          article_slug: string
          created_at: string
          helpful: boolean
          id: string
          locale: string
          user_id: string | null
        }
        Insert: {
          article_slug: string
          created_at?: string
          helpful: boolean
          id?: string
          locale?: string
          user_id?: string | null
        }
        Update: {
          article_slug?: string
          created_at?: string
          helpful?: boolean
          id?: string
          locale?: string
          user_id?: string | null
        }
        Relationships: []
      }
      locker_bookings: {
        Row: {
          booking_id: string | null
          created_at: string
          end_time: string
          id: string
          locker_id: string
          start_time: string
          status: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          end_time: string
          id?: string
          locker_id: string
          start_time: string
          status?: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          locker_id?: string
          start_time?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locker_bookings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_bookings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "door_bookings_sync_v"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "locker_bookings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "door_bookings_v"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "locker_bookings_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
        ]
      }
      lockers: {
        Row: {
          id: string
          label: string | null
          number: number
          status: string
        }
        Insert: {
          id?: string
          label?: string | null
          number: number
          status?: string
        }
        Update: {
          id?: string
          label?: string | null
          number?: number
          status?: string
        }
        Relationships: []
      }
      maintenance_log: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          end_time: string | null
          id: string
          reason: string | null
          start_time: string | null
          table_number: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          end_time?: string | null
          id?: string
          reason?: string | null
          start_time?: string | null
          table_number?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          start_time?: string | null
          table_number?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          booking_id: string | null
          channel: string | null
          device_token: string | null
          error_message: string | null
          id: string
          sent_at: string | null
          status: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          channel?: string | null
          device_token?: string | null
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          channel?: string | null
          device_token?: string | null
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "door_bookings_sync_v"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "notification_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "door_bookings_v"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      otp_phone_locks: {
        Row: {
          created_at: string
          locked_until: string
          phone: string
          reason: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          locked_until: string
          phone: string
          reason: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          locked_until?: string
          phone?: string
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      otp_rate_limit_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          otp_id: string | null
          phone: string
          purpose: string
          reason: string | null
          request_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          otp_id?: string | null
          phone: string
          purpose: string
          reason?: string | null
          request_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          otp_id?: string | null
          phone?: string
          purpose?: string
          reason?: string | null
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otp_rate_limit_events_otp_id_fkey"
            columns: ["otp_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_otps"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          booking_id: string
          completed_at: string | null
          created_at: string
          failure_code: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string
          order_group_id: string | null
          provider: string
          provider_order_no: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id: string
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          order_group_id?: string | null
          provider: string
          provider_order_no?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          completed_at?: string | null
          created_at?: string
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          order_group_id?: string | null
          provider?: string
          provider_order_no?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "door_bookings_sync_v"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "payment_attempts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "door_bookings_v"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          enabled: boolean
          method: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          method: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          method?: string
          updated_at?: string
        }
        Relationships: []
      }
      phone_binding_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          phone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_binding_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          created_at: string | null
          id: string
          note: string | null
          points: number
          reference_id: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          note?: string | null
          points: number
          reference_id?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string | null
          points?: number
          reference_id?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      promo_code_usages: {
        Row: {
          booking_id: string
          checkout_key: string
          created_at: string
          discount_amount: number
          held_at: string
          id: string
          order_group_id: string | null
          promo_code_id: string
          redeemed_at: string | null
          released_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          booking_id: string
          checkout_key: string
          created_at?: string
          discount_amount: number
          held_at?: string
          id?: string
          order_group_id?: string | null
          promo_code_id: string
          redeemed_at?: string | null
          released_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          booking_id?: string
          checkout_key?: string
          created_at?: string
          discount_amount?: number
          held_at?: string
          id?: string
          order_group_id?: string | null
          promo_code_id?: string
          redeemed_at?: string | null
          released_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_usages_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promotion_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_codes: {
        Row: {
          audience: string
          audience_threshold: number | null
          code: string
          created_at: string
          created_by: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          listed_in_wallet: boolean
          max_discount: number | null
          max_uses: number | null
          min_cart_amount: number | null
          name: string | null
          per_user_limit: number | null
          stackable_with_credits: boolean
          stackable_with_other_codes: boolean
          status: string
          time_windows: Json | null
          used_count: number
          valid_from: string
          valid_until: string | null
          weekdays: number[] | null
        }
        Insert: {
          audience?: string
          audience_threshold?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          listed_in_wallet?: boolean
          max_discount?: number | null
          max_uses?: number | null
          min_cart_amount?: number | null
          name?: string | null
          per_user_limit?: number | null
          stackable_with_credits?: boolean
          stackable_with_other_codes?: boolean
          status?: string
          time_windows?: Json | null
          used_count?: number
          valid_from?: string
          valid_until?: string | null
          weekdays?: number[] | null
        }
        Update: {
          audience?: string
          audience_threshold?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          listed_in_wallet?: boolean
          max_discount?: number | null
          max_uses?: number | null
          min_cart_amount?: number | null
          name?: string | null
          per_user_limit?: number | null
          stackable_with_credits?: boolean
          stackable_with_other_codes?: boolean
          status?: string
          time_windows?: Json | null
          used_count?: number
          valid_from?: string
          valid_until?: string | null
          weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number | null
          id: string
          identifier: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number | null
          id?: string
          identifier: string
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number | null
          id?: string
          identifier?: string
          window_start?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          coupon_template_id: string | null
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          coupon_template_id?: string | null
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          coupon_template_id?: string | null
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_coupon_template_id_fkey"
            columns: ["coupon_template_id"]
            isOneToOne: false
            referencedRelation: "coupon_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      site_error_log: {
        Row: {
          created_at: string | null
          detail: Json | null
          id: string
          message: string | null
          resolved: boolean | null
          severity: string | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          detail?: Json | null
          id?: string
          message?: string | null
          resolved?: boolean | null
          severity?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          detail?: Json | null
          id?: string
          message?: string | null
          resolved?: boolean | null
          severity?: string | null
          source?: string | null
        }
        Relationships: []
      }
      site_gate_access_log: {
        Row: {
          attempted_at: string
          id: string
          ip_address: string | null
          method: string
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_address?: string | null
          method: string
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_address?: string | null
          method?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      site_gate_config: {
        Row: {
          enabled: boolean
          id: string
          password_hash: string | null
          password_salt: string | null
          password_version: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: string
          password_hash?: string | null
          password_salt?: string | null
          password_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: string
          password_hash?: string | null
          password_salt?: string | null
          password_version?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_gate_ip_whitelist: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          label?: string | null
        }
        Relationships: []
      }
      slots: {
        Row: {
          created_at: string | null
          date: string
          duration_hours: number
          end_time: string
          id: string
          is_test: boolean
          locked_by: string | null
          locked_until: string | null
          price: number
          start_time: string
          status: string | null
          table_number: number
        }
        Insert: {
          created_at?: string | null
          date: string
          duration_hours: number
          end_time: string
          id?: string
          is_test?: boolean
          locked_by?: string | null
          locked_until?: string | null
          price: number
          start_time: string
          status?: string | null
          table_number?: number
        }
        Update: {
          created_at?: string | null
          date?: string
          duration_hours?: number
          end_time?: string
          id?: string
          is_test?: boolean
          locked_by?: string | null
          locked_until?: string | null
          price?: number
          start_time?: string
          status?: string | null
          table_number?: number
        }
        Relationships: []
      }
      spark_conversations: {
        Row: {
          created_at: string
          id: string
          locale: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          locale?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          locale?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      spark_feedback: {
        Row: {
          comment: string | null
          conversation_id: string
          created_at: string
          id: string
          locale: string | null
          rating: number | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          locale?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          locale?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spark_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "spark_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      spark_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          model: string | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          model?: string | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "spark_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "spark_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_groups: {
        Row: {
          created_at: string
          ended_at: string | null
          format: string
          game_type: string
          id: string
          scoring_mode: string | null
          started_at: string | null
          status: string
          table_numbers: number[]
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          format: string
          game_type: string
          id?: string
          scoring_mode?: string | null
          started_at?: string | null
          status?: string
          table_numbers: number[]
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          format?: string
          game_type?: string
          id?: string
          scoring_mode?: string | null
          started_at?: string | null
          status?: string
          table_numbers?: number[]
        }
        Relationships: []
      }
      user_coupons: {
        Row: {
          code: string
          coupon_template_id: string
          created_at: string
          id: string
          is_used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          coupon_template_id: string
          created_at?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          coupon_template_id?: string
          created_at?: string
          id?: string
          is_used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_coupons_coupon_template_id_fkey"
            columns: ["coupon_template_id"]
            isOneToOne: false
            referencedRelation: "coupon_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_password_status: {
        Row: {
          created_at: string
          password_set: boolean
          password_set_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          password_set?: boolean
          password_set_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          password_set?: boolean
          password_set_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          birthday_set: boolean
          created_at: string | null
          credits: number
          date_of_birth: string | null
          display_name: string | null
          email: string | null
          email_verified_at: string | null
          gender: string | null
          id: string
          is_blacklisted: boolean
          member_code: string | null
          member_qr_jwt: string | null
          member_since: string | null
          needs_manual_phone_reverify: boolean
          onboarding_status: string
          phone: string | null
          phone_verified: boolean | null
          phone_verified_at: string | null
          points: number | null
          points_converted: number
          profile_complete: boolean | null
          tier: string | null
          updated_at: string | null
          wallet_notify_opt_in: boolean | null
          wallet_pass_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          birthday_set?: boolean
          created_at?: string | null
          credits?: number
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          gender?: string | null
          id: string
          is_blacklisted?: boolean
          member_code?: string | null
          member_qr_jwt?: string | null
          member_since?: string | null
          needs_manual_phone_reverify?: boolean
          onboarding_status?: string
          phone?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          points?: number | null
          points_converted?: number
          profile_complete?: boolean | null
          tier?: string | null
          updated_at?: string | null
          wallet_notify_opt_in?: boolean | null
          wallet_pass_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          birthday_set?: boolean
          created_at?: string | null
          credits?: number
          date_of_birth?: string | null
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          gender?: string | null
          id?: string
          is_blacklisted?: boolean
          member_code?: string | null
          member_qr_jwt?: string | null
          member_since?: string | null
          needs_manual_phone_reverify?: boolean
          onboarding_status?: string
          phone?: string | null
          phone_verified?: boolean | null
          phone_verified_at?: string | null
          points?: number | null
          points_converted?: number
          profile_complete?: boolean | null
          tier?: string | null
          updated_at?: string | null
          wallet_notify_opt_in?: boolean | null
          wallet_pass_id?: string | null
        }
        Relationships: []
      }
      waitlist_emails: {
        Row: {
          email: string
          id: string
          subscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          subscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          subscribed_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          provider: string | null
          received_at: string
          status: string
          type: string
        }
        Insert: {
          error?: string | null
          id: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string | null
          received_at?: string
          status?: string
          type: string
        }
        Update: {
          error?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string | null
          received_at?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      whatsapp_otps: {
        Row: {
          attempts: number
          code_hash: string | null
          created_at: string
          expires_at: string
          id: string
          max_attempts: number
          phone: string
          provider_channel: string | null
          provider_message_id: string | null
          purpose: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash?: string | null
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number
          phone: string
          provider_channel?: string | null
          provider_message_id?: string | null
          purpose: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          phone?: string
          provider_channel?: string | null
          provider_message_id?: string | null
          purpose?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      admin_revenue_daily: {
        Row: {
          bookings: number | null
          day: string | null
          revenue: number | null
        }
        Relationships: []
      }
      door_bookings_sync_v: {
        Row: {
          booking_id: string | null
          date: string | null
          duration_hours: number | null
          end_at: string | null
          end_time: string | null
          human_code: string | null
          member_code: string | null
          start_at: string | null
          start_time: string | null
          status: string | null
          table_number: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Relationships: []
      }
      door_bookings_v: {
        Row: {
          booking_id: string | null
          date: string | null
          duration_hours: number | null
          end_at: string | null
          end_time: string | null
          human_code: string | null
          is_test: boolean | null
          member_code: string | null
          start_at: string | null
          start_time: string | null
          status: string | null
          table_number: number | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_change_user_identity: {
        Args: {
          p_admin_user_id: string
          p_new_email: string | null
          p_new_phone: string | null
          p_override?: boolean
          p_reason: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_unlock_phone: {
        Args: { p_phone: string }
        Returns: {
          ok: boolean
          phone: string
          unlocked_events: number
        }[]
      }
      admin_waive_booking: {
        Args: {
          p_admin_id: string
          p_booking_id: string
          p_compensation_type?: string
          p_compensation_value?: number
          p_reason: string
        }
        Returns: Json
      }
      apply_verified_contact_change: {
        Args: { p_request_id: string; p_user_id: string; p_verified_at: string }
        Returns: Json
      }
      award_booking_points: {
        Args: {
          p_note: string
          p_paid: number
          p_reference: string
          p_user_id: string
        }
        Returns: Json
      }
      backfill_password_status: { Args: never; Returns: undefined }
      cancel_payment_attempt: { Args: { p_booking_id: string }; Returns: Json }
      cancel_pending_booking: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: boolean
      }
      checkout_hold_expiry: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: Json
      }
      claim_payment_attempt: {
        Args: {
          p_booking_id: string
          p_idempotency_key: string
          p_provider: string
          p_user_id: string
        }
        Returns: Json
      }
      cleanup_expired_change_requests: { Args: never; Returns: number }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      cleanup_failed_bookings: {
        Args: never
        Returns: {
          deleted_count: number
        }[]
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      cleanup_security_tables: { Args: never; Returns: undefined }
      cleanup_site_gate_access_log: { Args: never; Returns: undefined }
      complete_login_otp: {
        Args: { p_channel: string; p_message_id: string; p_request_id: string }
        Returns: {
          expires_at: string
          ok: boolean
          otp_id: string
          reason: string
        }[]
      }
      complete_payment_attempt: {
        Args: { p_provider: string; p_provider_order_no: string }
        Returns: Json
      }
      confirm_booking: {
        Args: {
          p_booking_id: string
          p_event_id?: string
          p_payment_intent_id: string
          p_payment_method: string
          p_qr_code: string
        }
        Returns: Json
      }
      confirm_booking_group: {
        Args: {
          p_event_id?: string
          p_order_group_id: string
          p_payment_intent_id: string
          p_payment_method: string
          p_qr_codes: Json
        }
        Returns: Json
      }
      consume_checkout_discount: {
        Args: {
          p_booking_id: string
          p_order_group_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      convert_points_to_credits: {
        Args: { p_notify?: boolean; p_reference?: string; p_user_id: string }
        Returns: number
      }
      create_tournament_group: {
        Args: {
          p_format: string
          p_game_type: string
          p_player_ids: string[]
          p_scoring_mode: string
          p_table_numbers: number[]
        }
        Returns: Json
      }
      door_access_check: {
        Args: {
          p_at?: string
          p_device_id: string
          p_include_test?: boolean
          p_member_code: string
        }
        Returns: Json
      }
      door_bookings_active: {
        Args: { p_from?: string; p_include_test?: boolean; p_to?: string }
        Returns: Json
      }
      door_cfg: { Args: { p_default: number; p_key: string }; Returns: number }
      door_member_bookings: {
        Args: {
          p_date?: string
          p_include_test?: boolean
          p_member_code: string
        }
        Returns: Json
      }
      door_row: {
        Args: { v: Database["public"]["Views"]["door_bookings_v"]["Row"] }
        Returns: Json
      }
      door_set_settings: {
        Args: { p_actor?: string; p_early?: number; p_late?: number }
        Returns: Json
      }
      door_settings: { Args: never; Returns: Json }
      door_sync: {
        Args: { p_include_test?: boolean; p_since?: string }
        Returns: Json
      }
      door_ts: { Args: { t: string }; Returns: string }
      expire_login_otp: { Args: { p_request_id: string }; Returns: undefined }
      expire_stale_bookings: {
        Args: never
        Returns: {
          expired_count: number
          freed_slots: number
        }[]
      }
      expire_stale_pending_bookings: { Args: never; Returns: undefined }
      fail_payment_attempt: {
        Args: {
          p_attempt_id: string
          p_failure_code?: string
          p_failure_reason?: string
        }
        Returns: Json
      }
      finalize_payment_attempt: {
        Args: { p_attempt_id: string; p_provider_order_no: string }
        Returns: Json
      }
      find_or_lock_slot: {
        Args: {
          p_date: string
          p_duration_hours: number
          p_is_test?: boolean
          p_lock_minutes?: number
          p_price: number
          p_start_time: string
          p_table_number: number
          p_user_id: string
        }
        Returns: Json
      }
      find_or_lock_slots: {
        Args: { p_lock_minutes?: number; p_slots: Json; p_user_id: string }
        Returns: Json
      }
      generate_admin_qr: { Args: never; Returns: Json }
      generate_ai_daily_insights: { Args: never; Returns: undefined }
      generate_booking_human_code: {
        Args: { p_booking_id: string; p_salt?: number }
        Returns: string
      }
      generate_member_code: { Args: { p_tier?: string }; Returns: string }
      get_fully_booked_dates: { Args: { p_month: string }; Returns: string[] }
      grant_signup_bonus: { Args: { p_user_id: string }; Returns: undefined }
      hash_identity: {
        Args: { p_kind: string; p_value: string }
        Returns: string
      }
      invite_admin: {
        Args: { p_email: string; p_invited_by: string; p_role: string }
        Returns: Json
      }
      is_active_admin: { Args: never; Returns: boolean }
      is_identity_deleted: {
        Args: { p_identifier: string; p_provider: string }
        Returns: boolean
      }
      is_identity_reserved: {
        Args: { p_kind: string; p_value: string }
        Returns: boolean
      }
      mark_kpay_payment_failed: {
        Args: { p_booking_id: string; p_event_id?: string }
        Returns: Json
      }
      notify_member: {
        Args: {
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
      otp_policy_value: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      otp_record_provider_verification: {
        Args: {
          p_message_id: string
          p_phone: string
          p_purpose: string
          p_verified: boolean
        }
        Returns: {
          attempts: number
          expires_at: string
          locked_until: string
          ok: boolean
          otp_id: string
          reason: string
          remaining_attempts: number
          status: string
        }[]
      }
      prepare_checkout: {
        Args: {
          p_booking_id: string
          p_credits?: number
          p_points?: number
          p_promo_code?: string
          p_user_id: string
        }
        Returns: Json
      }
      purge_deleted_account_identities: { Args: never; Returns: number }
      record_deleted_identities: {
        Args: { p_user_id: string }
        Returns: number
      }
      refund_booking: {
        Args: { p_event_id?: string; p_payment_intent_id: string }
        Returns: Json
      }
      refund_group: {
        Args: { p_event_id?: string; p_order_group_id: string }
        Returns: Json
      }
      refund_rate_limit: {
        Args: {
          p_bucket: string
          p_identifier: string
          p_window_seconds: number
        }
        Returns: undefined
      }
      release_checkout_holds: {
        Args: { p_booking_id: string; p_order_group_id?: string }
        Returns: Json
      }
      release_expired_slot_locks: { Args: never; Returns: undefined }
      release_group_locks: {
        Args: { p_event_id?: string; p_order_group_id: string }
        Returns: Json
      }
      release_my_locks: { Args: { p_user_id: string }; Returns: Json }
      release_slot_lock: {
        Args: { p_event_id?: string; p_slot_id: string }
        Returns: Json
      }
      request_booking_refund: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: Json
      }
      request_member_data_deletion: {
        Args: { p_forfeit_wallet?: boolean }
        Returns: Json
      }
      reschedule_booking: {
        Args: {
          p_booking_id: string
          p_new_end: string
          p_new_start: string
          p_new_table_number: number
        }
        Returns: Json
      }
      reserve_login_otp: {
        Args: {
          p_captcha_verified?: boolean
          p_phone: string
          p_purpose?: string
        }
        Returns: {
          channel: string
          expires_at: string
          is_owner: boolean
          locked_until: string
          message_id: string
          ok: boolean
          otp_id: string
          phone_status: string
          purpose: string
          reason: string
          request_id: string
          requires_captcha: boolean
          retry_after_seconds: number
        }[]
      }
      retry_payment_failed_booking: {
        Args: { p_booking_id: string; p_user_id: string }
        Returns: Json
      }
      reverse_booking_points: {
        Args: {
          p_earned: number
          p_note: string
          p_reference: string
          p_user_id: string
        }
        Returns: undefined
      }
      trigger_apple_secret_rotation: { Args: never; Returns: undefined }
      try_lock_slot:
        | {
            Args: {
              p_lock_minutes?: number
              p_slot_id: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_date: string
              p_duration_hours: number
              p_start_time: string
              p_table_number?: number
              p_user_id: string
            }
            Returns: Json
          }
      update_user_tier: { Args: { p_user_id: string }; Returns: undefined }
      use_promotion_code: { Args: { p_code: string }; Returns: boolean }
      validate_member_code: { Args: { code: string }; Returns: boolean }
      validate_promotion_code:
        | { Args: { p_cart_amount?: number; p_code: string }; Returns: Json }
        | {
            Args: { p_cart_amount: number; p_code: string; p_user_id: string }
            Returns: Json
          }
      verify_login_otp: {
        Args: { p_code: string; p_phone: string; p_purpose: string }
        Returns: {
          attempts: number
          expires_at: string
          locked_until: string
          ok: boolean
          otp_id: string
          reason: string
          remaining_attempts: number
          status: string
        }[]
      }
      wallet_apply: {
        Args: {
          p_actor?: string
          p_amount: number
          p_note?: string
          p_reference?: string
          p_type: string
          p_user_id: string
        }
        Returns: number
      }
      wallet_reconcile: {
        Args: never
        Returns: {
          diff: number
          ledger_sum: number
          user_id: string
          wallet_balance: number
        }[]
      }
      wallet_reconcile_alert: { Args: never; Returns: number }
      wallet_topup: {
        Args: {
          p_admin_user_id: string
          p_amount: number
          p_note?: string
          p_user_id: string
        }
        Returns: Json
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
    Enums: {},
  },
} as const

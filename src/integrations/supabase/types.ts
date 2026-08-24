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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          bank_name: string
          created_at: string
          id: string
          ifsc: string
          is_primary: boolean
          updated_at: string
          upi_id: string
        }
        Insert: {
          account_holder?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: string
          ifsc?: string
          is_primary?: boolean
          updated_at?: string
          upi_id?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: string
          ifsc?: string
          is_primary?: boolean
          updated_at?: string
          upi_id?: string
        }
        Relationships: []
      }
      admin_settlements: {
        Row: {
          amount: number
          bank_account_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          note: string | null
          requested_at: string
          status: string
          updated_at: string
          utr: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          utr?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          utr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_settlements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "admin_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          about_text: string | null
          base_delivery_charge: number
          brand_name: string
          commission_pct: number
          created_at: string
          fssai_number: string | null
          id: string
          min_payout_limit: number
          per_km_rate: number
          qr_image_url: string | null
          singleton: boolean
          support_email: string | null
          support_phone: string | null
          tagline: string
          udyam_number: string | null
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          about_text?: string | null
          base_delivery_charge?: number
          brand_name?: string
          commission_pct?: number
          created_at?: string
          fssai_number?: string | null
          id?: string
          min_payout_limit?: number
          per_km_rate?: number
          qr_image_url?: string | null
          singleton?: boolean
          support_email?: string | null
          support_phone?: string | null
          tagline?: string
          udyam_number?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          about_text?: string | null
          base_delivery_charge?: number
          brand_name?: string
          commission_pct?: number
          created_at?: string
          fssai_number?: string | null
          id?: string
          min_payout_limit?: number
          per_km_rate?: number
          qr_image_url?: string | null
          singleton?: boolean
          support_email?: string | null
          support_phone?: string | null
          tagline?: string
          udyam_number?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          allowed_units: Json
          attributes: Json
          commission_pct: number
          created_at: string
          icon: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          allowed_units?: Json
          attributes?: Json
          commission_pct?: number
          created_at?: string
          icon?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          allowed_units?: Json
          attributes?: Json
          commission_pct?: number
          created_at?: string
          icon?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_order: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order?: number
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address_type: string
          created_at: string
          customer_id: string
          house_flat_no: string
          id: string
          is_default: boolean
          landmark: string | null
          latitude: number
          longitude: number
          street_area: string
        }
        Insert: {
          address_type?: string
          created_at?: string
          customer_id: string
          house_flat_no?: string
          id?: string
          is_default?: boolean
          landmark?: string | null
          latitude: number
          longitude: number
          street_area?: string
        }
        Update: {
          address_type?: string
          created_at?: string
          customer_id?: string
          house_flat_no?: string
          id?: string
          is_default?: boolean
          landmark?: string | null
          latitude?: number
          longitude?: number
          street_area?: string
        }
        Relationships: []
      }
      delivery_cash_settlements: {
        Row: {
          amount: number
          created_at: string
          delivery_boy_id: string
          id: string
          note: string | null
          settled_at: string
          transaction_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          delivery_boy_id: string
          id?: string
          note?: string | null
          settled_at?: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_boy_id?: string
          id?: string
          note?: string | null
          settled_at?: string
          transaction_id?: string | null
        }
        Relationships: []
      }
      delivery_incentives: {
        Row: {
          bonus_amount: number
          created_at: string
          id: string
          is_active: boolean
          orders_required: number
          period: string
          title: string
          updated_at: string
        }
        Insert: {
          bonus_amount?: number
          created_at?: string
          id?: string
          is_active?: boolean
          orders_required?: number
          period?: string
          title: string
          updated_at?: string
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          id?: string
          is_active?: boolean
          orders_required?: number
          period?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_location_logs: {
        Row: {
          battery_level: number | null
          delivery_boy_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          order_id: string | null
          recorded_at: string
          speed: number | null
        }
        Insert: {
          battery_level?: number | null
          delivery_boy_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          order_id?: string | null
          recorded_at?: string
          speed?: number | null
        }
        Update: {
          battery_level?: number | null
          delivery_boy_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          order_id?: string | null
          recorded_at?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_location_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_payout_slabs: {
        Row: {
          base_pay: number
          created_at: string
          id: string
          is_active: boolean
          max_km: number
          min_km: number
          per_km: number
          updated_at: string
        }
        Insert: {
          base_pay?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_km: number
          min_km?: number
          per_km?: number
          updated_at?: string
        }
        Update: {
          base_pay?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_km?: number
          min_km?: number
          per_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_profiles: {
        Row: {
          bank_details: Json
          cash_in_hand: number
          current_lat: number | null
          current_lng: number | null
          is_online: boolean
          payout_qr_url: string | null
          payout_upi_id: string | null
          total_earnings: number
          updated_at: string
          user_id: string
          vehicle_number: string | null
        }
        Insert: {
          bank_details?: Json
          cash_in_hand?: number
          current_lat?: number | null
          current_lng?: number | null
          is_online?: boolean
          payout_qr_url?: string | null
          payout_upi_id?: string | null
          total_earnings?: number
          updated_at?: string
          user_id: string
          vehicle_number?: string | null
        }
        Update: {
          bank_details?: Json
          cash_in_hand?: number
          current_lat?: number | null
          current_lng?: number | null
          is_online?: boolean
          payout_qr_url?: string | null
          payout_upi_id?: string | null
          total_earnings?: number
          updated_at?: string
          user_id?: string
          vehicle_number?: string | null
        }
        Relationships: []
      }
      delivery_slabs: {
        Row: {
          charge: number
          created_at: string
          id: string
          is_active: boolean
          max_km: number
          min_km: number
          updated_at: string
        }
        Insert: {
          charge?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_km: number
          min_km?: number
          updated_at?: string
        }
        Update: {
          charge?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_km?: number
          min_km?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_earnings: {
        Row: {
          lifetime_earned: number
          unsettled_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          lifetime_earned?: number
          unsettled_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          lifetime_earned?: number
          unsettled_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_disputes: {
        Row: {
          created_at: string
          customer_id: string
          details: string | null
          id: string
          order_id: string
          reason: string
          refund_amount: number
          refund_mode: string | null
          resolution_note: string | null
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          details?: string | null
          id?: string
          order_id: string
          reason: string
          refund_amount?: number
          refund_mode?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          details?: string | null
          id?: string
          order_id?: string
          reason?: string
          refund_amount?: number
          refund_mode?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          qty: number
          store_id: string
          unit_label: string
          unit_price: number
        }
        Insert: {
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          product_name: string
          qty?: number
          store_id: string
          unit_label?: string
          unit_price?: number
        }
        Update: {
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          store_id?: string
          unit_label?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_number_counters: {
        Row: {
          day: string
          last_no: number
        }
        Insert: {
          day: string
          last_no?: number
        }
        Update: {
          day?: string
          last_no?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          address_id: string | null
          coupon_code: string | null
          customer_id: string
          delivered_at: string | null
          delivery_address: string
          delivery_boy_id: string | null
          delivery_charge: number
          delivery_earning: number
          delivery_lat: number | null
          delivery_lng: number | null
          discount: number
          distance_km: number
          id: string
          is_multi_pickup: boolean
          order_no: string
          otp: string
          payment_mode: string
          placed_at: string
          platform_fee: number
          prep_time_min: number | null
          recipient_name: string | null
          recipient_phone: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
        }
        Insert: {
          address_id?: string | null
          coupon_code?: string | null
          customer_id: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_boy_id?: string | null
          delivery_charge?: number
          delivery_earning?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          discount?: number
          distance_km?: number
          id?: string
          is_multi_pickup?: boolean
          order_no?: string
          otp?: string
          payment_mode?: string
          placed_at?: string
          platform_fee?: number
          prep_time_min?: number | null
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
        }
        Update: {
          address_id?: string | null
          coupon_code?: string | null
          customer_id?: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_boy_id?: string | null
          delivery_charge?: number
          delivery_earning?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          discount?: number
          distance_km?: number
          id?: string
          is_multi_pickup?: boolean
          order_no?: string
          otp?: string
          payment_mode?: string
          placed_at?: string
          platform_fee?: number
          prep_time_min?: number | null
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          label: string
          mrp: number | null
          price: number
          product_id: string
          sort_order: number
          stock_qty: number
          unit_id: string | null
          unit_qty: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          label: string
          mrp?: number | null
          price: number
          product_id: string
          sort_order?: number
          stock_qty?: number
          unit_id?: string | null
          unit_qty?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          label?: string
          mrp?: number | null
          price?: number
          product_id?: string
          sort_order?: number
          stock_qty?: number
          unit_id?: string | null
          unit_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          mrp: number | null
          price: number
          product_name: string
          stock_qty: number
          store_id: string
          unit_id: string | null
          unit_qty: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          mrp?: number | null
          price?: number
          product_name: string
          stock_qty?: number
          store_id: string
          unit_id?: string | null
          unit_qty?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          mrp?: number | null
          price?: number
          product_name?: string
          stock_qty?: number
          store_id?: string
          unit_id?: string | null
          unit_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          created_at: string
          full_name: string
          id: string
          phone: string
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          account_status?: string
          created_at?: string
          full_name?: string
          id: string
          phone: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          account_status?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: []
      }
      role_requests: {
        Row: {
          address_line: string | null
          category_id: string | null
          created_at: string
          fssai_doc_url: string | null
          fssai_number: string | null
          id: string
          id_doc_number: string | null
          id_doc_type: string | null
          latitude: number | null
          longitude: number | null
          note: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          status: Database["public"]["Enums"]["approval_status"]
          store_name: string | null
          user_id: string
          vehicle_number: string | null
        }
        Insert: {
          address_line?: string | null
          category_id?: string | null
          created_at?: string
          fssai_doc_url?: string | null
          fssai_number?: string | null
          id?: string
          id_doc_number?: string | null
          id_doc_type?: string | null
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          store_name?: string | null
          user_id: string
          vehicle_number?: string | null
        }
        Update: {
          address_line?: string | null
          category_id?: string | null
          created_at?: string
          fssai_doc_url?: string | null
          fssai_number?: string | null
          id?: string
          id_doc_number?: string | null
          id_doc_type?: string | null
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          store_name?: string | null
          user_id?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_offers: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          note: string | null
          promo_commission_pct: number
          starts_at: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          promo_commission_pct?: number
          starts_at?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          promo_commission_pct?: number
          starts_at?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_offers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_wallets: {
        Row: {
          lifetime_earned: number
          store_id: string
          unsettled_balance: number
          updated_at: string
        }
        Insert: {
          lifetime_earned?: number
          store_id: string
          unsettled_balance?: number
          updated_at?: string
        }
        Update: {
          lifetime_earned?: number
          store_id?: string
          unsettled_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_wallets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_history: {
        Row: {
          amount: number
          id: string
          method: string | null
          note: string | null
          orders_count: number
          payee_id: string
          payee_name: string
          payee_type: string
          reference: string | null
          settled_at: string
          settled_by: string | null
        }
        Insert: {
          amount: number
          id?: string
          method?: string | null
          note?: string | null
          orders_count?: number
          payee_id: string
          payee_name?: string
          payee_type: string
          reference?: string | null
          settled_at?: string
          settled_by?: string | null
        }
        Update: {
          amount?: number
          id?: string
          method?: string | null
          note?: string | null
          orders_count?: number
          payee_id?: string
          payee_name?: string
          payee_type?: string
          reference?: string | null
          settled_at?: string
          settled_by?: string | null
        }
        Relationships: []
      }
      shop_types: {
        Row: {
          created_at: string
          icon: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      store_contacts: {
        Row: {
          phone: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          phone?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          phone?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_contacts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payouts: {
        Row: {
          amount: number
          commission_amount: number
          created_at: string
          id: string
          note: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
          store_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          commission_amount?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          store_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          commission_amount?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          store_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_relocation_requests: {
        Row: {
          created_at: string
          id: string
          new_address: string
          new_lat: number
          new_lng: number
          old_address: string
          old_lat: number
          old_lng: number
          reason: string | null
          status: Database["public"]["Enums"]["approval_status"]
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_address: string
          new_lat: number
          new_lng: number
          old_address: string
          old_lat: number
          old_lng: number
          reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_address?: string
          new_lat?: number
          new_lng?: number
          old_address?: string
          old_lat?: number
          old_lng?: number
          reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_relocation_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address_line: string
          bank_details: Json
          category_id: string | null
          commission_pct: number | null
          created_at: string
          fssai_doc_url: string | null
          fssai_number: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_verified: boolean
          latitude: number
          longitude: number
          payout_qr_url: string | null
          payout_upi_id: string | null
          rating: number
          seller_id: string | null
          shop_type_id: string | null
          store_name: string
          store_status: string
          udyam_number: string | null
        }
        Insert: {
          address_line?: string
          bank_details?: Json
          category_id?: string | null
          commission_pct?: number | null
          created_at?: string
          fssai_doc_url?: string | null
          fssai_number?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_verified?: boolean
          latitude?: number
          longitude?: number
          payout_qr_url?: string | null
          payout_upi_id?: string | null
          rating?: number
          seller_id?: string | null
          shop_type_id?: string | null
          store_name: string
          store_status?: string
          udyam_number?: string | null
        }
        Update: {
          address_line?: string
          bank_details?: Json
          category_id?: string | null
          commission_pct?: number | null
          created_at?: string
          fssai_doc_url?: string | null
          fssai_number?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_verified?: boolean
          latitude?: number
          longitude?: number
          payout_qr_url?: string | null
          payout_upi_id?: string | null
          rating?: number
          seller_id?: string | null
          shop_type_id?: string | null
          store_name?: string
          store_status?: string
          udyam_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_shop_type_id_fkey"
            columns: ["shop_type_id"]
            isOneToOne: false
            referencedRelation: "shop_types"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          short_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          short_name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          short_name?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string | null
          order_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          order_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_order: { Args: { _order_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "ADMIN" | "CUSTOMER" | "SELLER" | "DELIVERY"
      approval_status: "PENDING" | "APPROVED" | "REJECTED"
      order_status:
        | "PLACED"
        | "ACCEPTED"
        | "PREPARING"
        | "READY"
        | "ASSIGNED"
        | "PICKED_UP"
        | "ON_THE_WAY"
        | "DELIVERED"
        | "CANCELLED"
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
      app_role: ["ADMIN", "CUSTOMER", "SELLER", "DELIVERY"],
      approval_status: ["PENDING", "APPROVED", "REJECTED"],
      order_status: [
        "PLACED",
        "ACCEPTED",
        "PREPARING",
        "READY",
        "ASSIGNED",
        "PICKED_UP",
        "ON_THE_WAY",
        "DELIVERED",
        "CANCELLED",
      ],
    },
  },
} as const

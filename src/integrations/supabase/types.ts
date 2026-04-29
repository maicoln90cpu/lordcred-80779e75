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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_table: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bank_credentials: {
        Row: {
          bank_name: string
          created_at: string
          id: string
          link: string
          password: string
          updated_at: string
          username: string
        }
        Insert: {
          bank_name: string
          created_at?: string
          id?: string
          link?: string
          password?: string
          updated_at?: string
          username?: string
        }
        Update: {
          bank_name?: string
          created_at?: string
          id?: string
          link?: string
          password?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      broadcast_blacklist: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          phone: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          phone: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          phone?: string
          reason?: string | null
        }
        Relationships: []
      }
      broadcast_campaigns: {
        Row: {
          ab_enabled: boolean
          chip_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          failed_count: number
          id: string
          media_filename: string | null
          media_type: string | null
          media_url: string | null
          message_content: string
          message_variant_b: string | null
          name: string
          overflow_chip_ids: string[] | null
          owner_user_id: string | null
          rate_per_minute: number
          scheduled_at: string | null
          scheduled_date: string | null
          sent_count: number
          source_filters: Json | null
          source_type: string
          started_at: string | null
          status: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          ab_enabled?: boolean
          chip_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          failed_count?: number
          id?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          message_content: string
          message_variant_b?: string | null
          name: string
          overflow_chip_ids?: string[] | null
          owner_user_id?: string | null
          rate_per_minute?: number
          scheduled_at?: string | null
          scheduled_date?: string | null
          sent_count?: number
          source_filters?: Json | null
          source_type?: string
          started_at?: string | null
          status?: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          ab_enabled?: boolean
          chip_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          failed_count?: number
          id?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          message_content?: string
          message_variant_b?: string | null
          name?: string
          overflow_chip_ids?: string[] | null
          owner_user_id?: string | null
          rate_per_minute?: number
          scheduled_at?: string | null
          scheduled_date?: string | null
          sent_count?: number
          source_filters?: Json | null
          source_type?: string
          started_at?: string | null
          status?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_campaigns_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          delivery_status: string
          error_message: string | null
          id: string
          lead_id: string | null
          message_id: string | null
          phone: string
          replied: boolean
          replied_at: string | null
          sent_at: string | null
          status: string
          variant: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          phone: string
          replied?: boolean
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          variant?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          phone?: string
          replied?: boolean
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_lifecycle_logs: {
        Row: {
          chip_id: string | null
          created_at: string
          details: string | null
          event: string
          id: string
        }
        Insert: {
          chip_id?: string | null
          created_at?: string
          details?: string | null
          event: string
          id?: string
        }
        Update: {
          chip_id?: string | null
          created_at?: string
          details?: string | null
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chip_lifecycle_logs_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      chips: {
        Row: {
          activated_at: string | null
          broadcast_daily_limit: number
          chip_type: string
          created_at: string
          health_fail_count: number
          id: string
          instance_name: string
          instance_token: string | null
          is_shared: boolean
          last_connection_attempt: string | null
          last_message_at: string | null
          last_sync_at: string | null
          last_sync_cursor: number | null
          last_webhook_at: string | null
          messages_sent_today: number
          meta_phone_number_id: string | null
          meta_waba_id: string | null
          nickname: string | null
          phone_number: string | null
          provider: string
          shared_block_send: boolean
          shared_user_ids: string[] | null
          slot_number: number
          status: string
          updated_at: string
          user_id: string
          warming_phase: string
        }
        Insert: {
          activated_at?: string | null
          broadcast_daily_limit?: number
          chip_type?: string
          created_at?: string
          health_fail_count?: number
          id?: string
          instance_name: string
          instance_token?: string | null
          is_shared?: boolean
          last_connection_attempt?: string | null
          last_message_at?: string | null
          last_sync_at?: string | null
          last_sync_cursor?: number | null
          last_webhook_at?: string | null
          messages_sent_today?: number
          meta_phone_number_id?: string | null
          meta_waba_id?: string | null
          nickname?: string | null
          phone_number?: string | null
          provider?: string
          shared_block_send?: boolean
          shared_user_ids?: string[] | null
          slot_number: number
          status?: string
          updated_at?: string
          user_id: string
          warming_phase?: string
        }
        Update: {
          activated_at?: string | null
          broadcast_daily_limit?: number
          chip_type?: string
          created_at?: string
          health_fail_count?: number
          id?: string
          instance_name?: string
          instance_token?: string | null
          is_shared?: boolean
          last_connection_attempt?: string | null
          last_message_at?: string | null
          last_sync_at?: string | null
          last_sync_cursor?: number | null
          last_webhook_at?: string | null
          messages_sent_today?: number
          meta_phone_number_id?: string | null
          meta_waba_id?: string | null
          nickname?: string | null
          phone_number?: string | null
          provider?: string
          shared_block_send?: boolean
          shared_user_ids?: string[] | null
          slot_number?: number
          status?: string
          updated_at?: string
          user_id?: string
          warming_phase?: string
        }
        Relationships: []
      }
      client_leads: {
        Row: {
          agencia: string | null
          aprovado: string | null
          assigned_at: string | null
          assigned_to: string
          banco_codigo: string | null
          banco_nome: string | null
          banco_simulado: string | null
          batch_name: string | null
          conta: string | null
          contacted_at: string | null
          corban_proposta_id: string | null
          corban_status: string | null
          cpf: string | null
          created_at: string
          created_by: string
          data_nasc: string | null
          data_ref: string | null
          id: string
          nome: string
          nome_mae: string | null
          notes: string | null
          perfil: string | null
          prazo: number | null
          reprovado: string | null
          status: string | null
          telefone: string | null
          updated_at: string
          valor_lib: number | null
          vlr_parcela: number | null
        }
        Insert: {
          agencia?: string | null
          aprovado?: string | null
          assigned_at?: string | null
          assigned_to: string
          banco_codigo?: string | null
          banco_nome?: string | null
          banco_simulado?: string | null
          batch_name?: string | null
          conta?: string | null
          contacted_at?: string | null
          corban_proposta_id?: string | null
          corban_status?: string | null
          cpf?: string | null
          created_at?: string
          created_by: string
          data_nasc?: string | null
          data_ref?: string | null
          id?: string
          nome: string
          nome_mae?: string | null
          notes?: string | null
          perfil?: string | null
          prazo?: number | null
          reprovado?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
          valor_lib?: number | null
          vlr_parcela?: number | null
        }
        Update: {
          agencia?: string | null
          aprovado?: string | null
          assigned_at?: string | null
          assigned_to?: string
          banco_codigo?: string | null
          banco_nome?: string | null
          banco_simulado?: string | null
          batch_name?: string | null
          conta?: string | null
          contacted_at?: string | null
          corban_proposta_id?: string | null
          corban_status?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string
          data_nasc?: string | null
          data_ref?: string | null
          id?: string
          nome?: string
          nome_mae?: string | null
          notes?: string | null
          perfil?: string | null
          prazo?: number | null
          reprovado?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string
          valor_lib?: number | null
          vlr_parcela?: number | null
        }
        Relationships: []
      }
      commission_annual_rewards: {
        Row: {
          created_at: string
          id: string
          min_contracts: number
          reward_description: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_contracts?: number
          reward_description?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_contracts?: number
          reward_description?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      commission_annual_rewards_v2: {
        Row: {
          created_at: string
          id: string
          min_contracts: number
          reward_description: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_contracts?: number
          reward_description?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_contracts?: number
          reward_description?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      commission_bonus_tiers: {
        Row: {
          bonus_value: number
          created_at: string
          id: string
          min_contracts: number
          updated_at: string
        }
        Insert: {
          bonus_value?: number
          created_at?: string
          id?: string
          min_contracts?: number
          updated_at?: string
        }
        Update: {
          bonus_value?: number
          created_at?: string
          id?: string
          min_contracts?: number
          updated_at?: string
        }
        Relationships: []
      }
      commission_bonus_tiers_v2: {
        Row: {
          bonus_value: number
          created_at: string
          id: string
          min_contracts: number
          updated_at: string
        }
        Insert: {
          bonus_value?: number
          created_at?: string
          id?: string
          min_contracts?: number
          updated_at?: string
        }
        Update: {
          bonus_value?: number
          created_at?: string
          id?: string
          min_contracts?: number
          updated_at?: string
        }
        Relationships: []
      }
      commission_rates_clt: {
        Row: {
          bank: string
          created_at: string
          effective_date: string
          has_insurance: boolean
          id: string
          max_value: number
          min_value: number
          obs: string | null
          rate: number
          table_key: string | null
          term_max: number
          term_min: number
        }
        Insert: {
          bank: string
          created_at?: string
          effective_date: string
          has_insurance?: boolean
          id?: string
          max_value?: number
          min_value?: number
          obs?: string | null
          rate?: number
          table_key?: string | null
          term_max?: number
          term_min?: number
        }
        Update: {
          bank?: string
          created_at?: string
          effective_date?: string
          has_insurance?: boolean
          id?: string
          max_value?: number
          min_value?: number
          obs?: string | null
          rate?: number
          table_key?: string | null
          term_max?: number
          term_min?: number
        }
        Relationships: []
      }
      commission_rates_clt_v2: {
        Row: {
          bank: string
          created_at: string
          effective_date: string
          has_insurance: boolean
          id: string
          max_value: number
          min_value: number
          obs: string | null
          rate: number
          table_key: string | null
          term_max: number
          term_min: number
        }
        Insert: {
          bank: string
          created_at?: string
          effective_date: string
          has_insurance?: boolean
          id?: string
          max_value?: number
          min_value?: number
          obs?: string | null
          rate?: number
          table_key?: string | null
          term_max?: number
          term_min?: number
        }
        Update: {
          bank?: string
          created_at?: string
          effective_date?: string
          has_insurance?: boolean
          id?: string
          max_value?: number
          min_value?: number
          obs?: string | null
          rate?: number
          table_key?: string | null
          term_max?: number
          term_min?: number
        }
        Relationships: []
      }
      commission_rates_clt_v2_backup_20260427: {
        Row: {
          bank: string | null
          created_at: string | null
          effective_date: string | null
          has_insurance: boolean | null
          id: string | null
          obs: string | null
          rate: number | null
          table_key: string | null
          term_max: number | null
          term_min: number | null
        }
        Insert: {
          bank?: string | null
          created_at?: string | null
          effective_date?: string | null
          has_insurance?: boolean | null
          id?: string | null
          obs?: string | null
          rate?: number | null
          table_key?: string | null
          term_max?: number | null
          term_min?: number | null
        }
        Update: {
          bank?: string | null
          created_at?: string | null
          effective_date?: string | null
          has_insurance?: boolean | null
          id?: string | null
          obs?: string | null
          rate?: number | null
          table_key?: string | null
          term_max?: number | null
          term_min?: number | null
        }
        Relationships: []
      }
      commission_rates_clt_v2_backup_20260427b: {
        Row: {
          bank: string | null
          created_at: string | null
          effective_date: string | null
          has_insurance: boolean | null
          id: string | null
          obs: string | null
          rate: number | null
          table_key: string | null
          term_max: number | null
          term_min: number | null
        }
        Insert: {
          bank?: string | null
          created_at?: string | null
          effective_date?: string | null
          has_insurance?: boolean | null
          id?: string | null
          obs?: string | null
          rate?: number | null
          table_key?: string | null
          term_max?: number | null
          term_min?: number | null
        }
        Update: {
          bank?: string | null
          created_at?: string | null
          effective_date?: string | null
          has_insurance?: boolean | null
          id?: string | null
          obs?: string | null
          rate?: number | null
          table_key?: string | null
          term_max?: number | null
          term_min?: number | null
        }
        Relationships: []
      }
      commission_rates_fgts: {
        Row: {
          bank: string
          created_at: string
          effective_date: string
          id: string
          rate_no_insurance: number
          rate_with_insurance: number
        }
        Insert: {
          bank: string
          created_at?: string
          effective_date: string
          id?: string
          rate_no_insurance?: number
          rate_with_insurance?: number
        }
        Update: {
          bank?: string
          created_at?: string
          effective_date?: string
          id?: string
          rate_no_insurance?: number
          rate_with_insurance?: number
        }
        Relationships: []
      }
      commission_rates_fgts_v2: {
        Row: {
          bank: string
          created_at: string
          effective_date: string
          has_insurance: boolean
          id: string
          max_value: number
          min_value: number
          obs: string | null
          rate: number
          table_key: string | null
          term_max: number
          term_min: number
        }
        Insert: {
          bank: string
          created_at?: string
          effective_date: string
          has_insurance?: boolean
          id?: string
          max_value?: number
          min_value?: number
          obs?: string | null
          rate?: number
          table_key?: string | null
          term_max?: number
          term_min?: number
        }
        Update: {
          bank?: string
          created_at?: string
          effective_date?: string
          has_insurance?: boolean
          id?: string
          max_value?: number
          min_value?: number
          obs?: string | null
          rate?: number
          table_key?: string | null
          term_max?: number
          term_min?: number
        }
        Relationships: []
      }
      commission_rates_fgts_v2_backup_20260427: {
        Row: {
          bank: string | null
          created_at: string | null
          effective_date: string | null
          has_insurance: boolean | null
          id: string | null
          max_value: number | null
          min_value: number | null
          obs: string | null
          rate: number | null
          table_key: string | null
          term_max: number | null
          term_min: number | null
        }
        Insert: {
          bank?: string | null
          created_at?: string | null
          effective_date?: string | null
          has_insurance?: boolean | null
          id?: string | null
          max_value?: number | null
          min_value?: number | null
          obs?: string | null
          rate?: number | null
          table_key?: string | null
          term_max?: number | null
          term_min?: number | null
        }
        Update: {
          bank?: string | null
          created_at?: string | null
          effective_date?: string | null
          has_insurance?: boolean | null
          id?: string | null
          max_value?: number | null
          min_value?: number | null
          obs?: string | null
          rate?: number | null
          table_key?: string | null
          term_max?: number | null
          term_min?: number | null
        }
        Relationships: []
      }
      commission_rates_fgts_v2_backup_20260427b: {
        Row: {
          bank: string | null
          created_at: string | null
          effective_date: string | null
          has_insurance: boolean | null
          id: string | null
          max_value: number | null
          min_value: number | null
          obs: string | null
          rate: number | null
          table_key: string | null
          term_max: number | null
          term_min: number | null
        }
        Insert: {
          bank?: string | null
          created_at?: string | null
          effective_date?: string | null
          has_insurance?: boolean | null
          id?: string | null
          max_value?: number | null
          min_value?: number | null
          obs?: string | null
          rate?: number | null
          table_key?: string | null
          term_max?: number | null
          term_min?: number | null
        }
        Update: {
          bank?: string | null
          created_at?: string | null
          effective_date?: string | null
          has_insurance?: boolean | null
          id?: string | null
          max_value?: number | null
          min_value?: number | null
          obs?: string | null
          rate?: number | null
          table_key?: string | null
          term_max?: number | null
          term_min?: number | null
        }
        Relationships: []
      }
      commission_sales: {
        Row: {
          bank: string
          batch_id: string | null
          bonus_value: number | null
          client_birth_date: string | null
          client_cpf: string | null
          client_name: string | null
          client_phone: string | null
          commission_rate: number | null
          commission_value: number | null
          created_at: string
          created_by: string
          external_proposal_id: string | null
          has_insurance: boolean
          id: string
          product: string
          released_value: number
          sale_date: string
          seller_id: string
          table_name: string | null
          term: number | null
          updated_at: string
          week_label: string | null
        }
        Insert: {
          bank: string
          batch_id?: string | null
          bonus_value?: number | null
          client_birth_date?: string | null
          client_cpf?: string | null
          client_name?: string | null
          client_phone?: string | null
          commission_rate?: number | null
          commission_value?: number | null
          created_at?: string
          created_by: string
          external_proposal_id?: string | null
          has_insurance?: boolean
          id?: string
          product: string
          released_value?: number
          sale_date: string
          seller_id: string
          table_name?: string | null
          term?: number | null
          updated_at?: string
          week_label?: string | null
        }
        Update: {
          bank?: string
          batch_id?: string | null
          bonus_value?: number | null
          client_birth_date?: string | null
          client_cpf?: string | null
          client_name?: string | null
          client_phone?: string | null
          commission_rate?: number | null
          commission_value?: number | null
          created_at?: string
          created_by?: string
          external_proposal_id?: string | null
          has_insurance?: boolean
          id?: string
          product?: string
          released_value?: number
          sale_date?: string
          seller_id?: string
          table_name?: string | null
          term?: number | null
          updated_at?: string
          week_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_sales_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_sales_v2: {
        Row: {
          bank: string
          batch_id: string | null
          bonus_value: number | null
          client_birth_date: string | null
          client_cpf: string | null
          client_name: string | null
          client_phone: string | null
          commission_rate: number | null
          commission_value: number | null
          created_at: string
          created_by: string
          external_proposal_id: string | null
          has_insurance: boolean
          id: string
          product: string
          released_value: number
          sale_date: string
          seller_id: string
          table_name: string | null
          term: number | null
          updated_at: string
          week_label: string | null
        }
        Insert: {
          bank: string
          batch_id?: string | null
          bonus_value?: number | null
          client_birth_date?: string | null
          client_cpf?: string | null
          client_name?: string | null
          client_phone?: string | null
          commission_rate?: number | null
          commission_value?: number | null
          created_at?: string
          created_by: string
          external_proposal_id?: string | null
          has_insurance?: boolean
          id?: string
          product: string
          released_value?: number
          sale_date: string
          seller_id: string
          table_name?: string | null
          term?: number | null
          updated_at?: string
          week_label?: string | null
        }
        Update: {
          bank?: string
          batch_id?: string | null
          bonus_value?: number | null
          client_birth_date?: string | null
          client_cpf?: string | null
          client_name?: string | null
          client_phone?: string | null
          commission_rate?: number | null
          commission_value?: number | null
          created_at?: string
          created_by?: string
          external_proposal_id?: string | null
          has_insurance?: boolean
          id?: string
          product?: string
          released_value?: number
          sale_date?: string
          seller_id?: string
          table_name?: string | null
          term?: number | null
          updated_at?: string
          week_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_sales_v2_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settings: {
        Row: {
          bonus_fixed_value: number
          bonus_mode: string
          bonus_rate: number
          bonus_threshold: number | null
          created_at: string
          id: string
          monthly_goal_type: string
          monthly_goal_value: number
          payment_day: number
          updated_at: string
          week_start_day: number
        }
        Insert: {
          bonus_fixed_value?: number
          bonus_mode?: string
          bonus_rate?: number
          bonus_threshold?: number | null
          created_at?: string
          id?: string
          monthly_goal_type?: string
          monthly_goal_value?: number
          payment_day?: number
          updated_at?: string
          week_start_day?: number
        }
        Update: {
          bonus_fixed_value?: number
          bonus_mode?: string
          bonus_rate?: number
          bonus_threshold?: number | null
          created_at?: string
          id?: string
          monthly_goal_type?: string
          monthly_goal_value?: number
          payment_day?: number
          updated_at?: string
          week_start_day?: number
        }
        Relationships: []
      }
      commission_settings_v2: {
        Row: {
          bonus_fixed_value: number
          bonus_mode: string
          bonus_rate: number
          bonus_threshold: number | null
          created_at: string
          id: string
          monthly_goal_type: string
          monthly_goal_value: number
          payment_day: number
          updated_at: string
          week_start_day: number
        }
        Insert: {
          bonus_fixed_value?: number
          bonus_mode?: string
          bonus_rate?: number
          bonus_threshold?: number | null
          created_at?: string
          id?: string
          monthly_goal_type?: string
          monthly_goal_value?: number
          payment_day?: number
          updated_at?: string
          week_start_day?: number
        }
        Update: {
          bonus_fixed_value?: number
          bonus_mode?: string
          bonus_rate?: number
          bonus_threshold?: number | null
          created_at?: string
          id?: string
          monthly_goal_type?: string
          monthly_goal_value?: number
          payment_day?: number
          updated_at?: string
          week_start_day?: number
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_audit_log: {
        Row: {
          action: string
          conversation_id: string
          created_at: string
          details: Json | null
          id: string
          message_preview: string | null
          user_id: string
        }
        Insert: {
          action: string
          conversation_id: string
          created_at?: string
          details?: Json | null
          id?: string
          message_preview?: string | null
          user_id: string
        }
        Update: {
          action?: string
          conversation_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          message_preview?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_audit_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_notes: {
        Row: {
          chip_id: string
          content: string
          created_at: string | null
          id: string
          remote_jid: string
          user_id: string
        }
        Insert: {
          chip_id: string
          content: string
          created_at?: string | null
          id?: string
          remote_jid: string
          user_id: string
        }
        Update: {
          chip_id?: string
          content?: string
          created_at?: string | null
          id?: string
          remote_jid?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_notes_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_user_id: string | null
          chip_id: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          custom_status: string | null
          id: string
          is_archived: boolean | null
          is_blocked: boolean | null
          is_group: boolean | null
          is_muted: boolean | null
          is_pinned: boolean | null
          is_starred: boolean | null
          label_ids: string[] | null
          last_message_at: string | null
          last_message_text: string | null
          profile_pic_url: string | null
          remote_jid: string
          unread_count: number | null
          updated_at: string | null
          wa_name: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          chip_id: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          custom_status?: string | null
          id?: string
          is_archived?: boolean | null
          is_blocked?: boolean | null
          is_group?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          is_starred?: boolean | null
          label_ids?: string[] | null
          last_message_at?: string | null
          last_message_text?: string | null
          profile_pic_url?: string | null
          remote_jid: string
          unread_count?: number | null
          updated_at?: string | null
          wa_name?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          chip_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          custom_status?: string | null
          id?: string
          is_archived?: boolean | null
          is_blocked?: boolean | null
          is_group?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          is_starred?: boolean | null
          label_ids?: string[] | null
          last_message_at?: string | null
          last_message_text?: string | null
          profile_pic_url?: string | null
          remote_jid?: string
          unread_count?: number | null
          updated_at?: string | null
          wa_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      corban_assets_cache: {
        Row: {
          asset_id: string
          asset_label: string
          asset_type: string
          id: string
          raw_data: Json | null
          synced_at: string | null
        }
        Insert: {
          asset_id: string
          asset_label: string
          asset_type: string
          id?: string
          raw_data?: Json | null
          synced_at?: string | null
        }
        Update: {
          asset_id?: string
          asset_label?: string
          asset_type?: string
          id?: string
          raw_data?: Json | null
          synced_at?: string | null
        }
        Relationships: []
      }
      corban_feature_config: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          feature_key: string
          feature_label: string
          id: string
          sort_order: number | null
          updated_at: string | null
          visible_to_sellers: boolean | null
          visible_to_support: boolean | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          feature_key: string
          feature_label: string
          id?: string
          sort_order?: number | null
          updated_at?: string | null
          visible_to_sellers?: boolean | null
          visible_to_support?: boolean | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          feature_key?: string
          feature_label?: string
          id?: string
          sort_order?: number | null
          updated_at?: string | null
          visible_to_sellers?: boolean | null
          visible_to_support?: boolean | null
        }
        Relationships: []
      }
      corban_notifications: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          proposta_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          proposta_id?: string | null
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          proposta_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      corban_propostas_snapshot: {
        Row: {
          banco: string | null
          convenio: string | null
          cpf: string | null
          created_by: string | null
          data_cadastro: string | null
          id: string
          nome: string | null
          prazo: string | null
          produto: string | null
          proposta_id: string | null
          raw_data: Json | null
          snapshot_date: string
          snapshot_history: Json | null
          status: string | null
          updated_at: string | null
          valor_liberado: number | null
          valor_parcela: number | null
          vendedor_nome: string | null
        }
        Insert: {
          banco?: string | null
          convenio?: string | null
          cpf?: string | null
          created_by?: string | null
          data_cadastro?: string | null
          id?: string
          nome?: string | null
          prazo?: string | null
          produto?: string | null
          proposta_id?: string | null
          raw_data?: Json | null
          snapshot_date?: string
          snapshot_history?: Json | null
          status?: string | null
          updated_at?: string | null
          valor_liberado?: number | null
          valor_parcela?: number | null
          vendedor_nome?: string | null
        }
        Update: {
          banco?: string | null
          convenio?: string | null
          cpf?: string | null
          created_by?: string | null
          data_cadastro?: string | null
          id?: string
          nome?: string | null
          prazo?: string | null
          produto?: string | null
          proposta_id?: string | null
          raw_data?: Json | null
          snapshot_date?: string
          snapshot_history?: Json | null
          status?: string | null
          updated_at?: string | null
          valor_liberado?: number | null
          valor_parcela?: number | null
          vendedor_nome?: string | null
        }
        Relationships: []
      }
      corban_seller_mapping: {
        Row: {
          corban_name: string
          created_at: string
          id: string
          similarity_score: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          corban_name: string
          created_at?: string
          id?: string
          similarity_score?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          corban_name?: string
          created_at?: string
          id?: string
          similarity_score?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corban_seller_mapping_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cr_geral: {
        Row: {
          ade: string | null
          banco: string | null
          batch_id: string | null
          cms_rep: number | null
          cod_contrato: string | null
          convenio: string | null
          cpf: string | null
          created_at: string
          data_digitacao: string | null
          data_pgt_cliente: string | null
          id: string
          idade: string | null
          nome_cliente: string | null
          pct_cms: number | null
          pct_cms_bruta: number | null
          pmts: string | null
          prazo: number | null
          prod_bruta: number | null
          prod_liq: number | null
          tipo_operacao: string | null
        }
        Insert: {
          ade?: string | null
          banco?: string | null
          batch_id?: string | null
          cms_rep?: number | null
          cod_contrato?: string | null
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          data_digitacao?: string | null
          data_pgt_cliente?: string | null
          id?: string
          idade?: string | null
          nome_cliente?: string | null
          pct_cms?: number | null
          pct_cms_bruta?: number | null
          pmts?: string | null
          prazo?: number | null
          prod_bruta?: number | null
          prod_liq?: number | null
          tipo_operacao?: string | null
        }
        Update: {
          ade?: string | null
          banco?: string | null
          batch_id?: string | null
          cms_rep?: number | null
          cod_contrato?: string | null
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          data_digitacao?: string | null
          data_pgt_cliente?: string | null
          id?: string
          idade?: string | null
          nome_cliente?: string | null
          pct_cms?: number | null
          pct_cms_bruta?: number | null
          pmts?: string | null
          prazo?: number | null
          prod_bruta?: number | null
          prod_liq?: number | null
          tipo_operacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cr_geral_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      cr_historico_detalhado: {
        Row: {
          banco: string | null
          comissao_esperada: number | null
          comissao_recebida: number | null
          created_at: string
          data_pago: string | null
          diferenca: number | null
          gestao_id: string
          id: string
          nome: string | null
          num_contrato: string | null
          produto: string | null
          valor_assegurado: number | null
          valor_liberado: number | null
        }
        Insert: {
          banco?: string | null
          comissao_esperada?: number | null
          comissao_recebida?: number | null
          created_at?: string
          data_pago?: string | null
          diferenca?: number | null
          gestao_id: string
          id?: string
          nome?: string | null
          num_contrato?: string | null
          produto?: string | null
          valor_assegurado?: number | null
          valor_liberado?: number | null
        }
        Update: {
          banco?: string | null
          comissao_esperada?: number | null
          comissao_recebida?: number | null
          created_at?: string
          data_pago?: string | null
          diferenca?: number | null
          gestao_id?: string
          id?: string
          nome?: string | null
          num_contrato?: string | null
          produto?: string | null
          valor_assegurado?: number | null
          valor_liberado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cr_historico_detalhado_gestao_id_fkey"
            columns: ["gestao_id"]
            isOneToOne: false
            referencedRelation: "cr_historico_gestao"
            referencedColumns: ["id"]
          },
        ]
      }
      cr_historico_gestao: {
        Row: {
          comissao_esperada: number | null
          comissao_recebida: number | null
          created_at: string
          created_by: string
          data_fim: string | null
          data_inicio: string | null
          diferenca: number | null
          id: string
          nome: string
          qtd_propostas: number | null
          valor_liberado: number | null
        }
        Insert: {
          comissao_esperada?: number | null
          comissao_recebida?: number | null
          created_at?: string
          created_by: string
          data_fim?: string | null
          data_inicio?: string | null
          diferenca?: number | null
          id?: string
          nome: string
          qtd_propostas?: number | null
          valor_liberado?: number | null
        }
        Update: {
          comissao_esperada?: number | null
          comissao_recebida?: number | null
          created_at?: string
          created_by?: string
          data_fim?: string | null
          data_inicio?: string | null
          diferenca?: number | null
          id?: string
          nome?: string
          qtd_propostas?: number | null
          valor_liberado?: number | null
        }
        Relationships: []
      }
      cr_relatorio: {
        Row: {
          banco: string | null
          batch_id: string | null
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          data_pago: string | null
          id: string
          id_contrato: string | null
          nome: string | null
          num_contrato: string | null
          prazo: number | null
          produto: string | null
          seguro: string | null
          tabela: string | null
          telefone: string | null
          valor_liberado: number | null
          vendedor: string | null
        }
        Insert: {
          banco?: string | null
          batch_id?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          data_pago?: string | null
          id?: string
          id_contrato?: string | null
          nome?: string | null
          num_contrato?: string | null
          prazo?: number | null
          produto?: string | null
          seguro?: string | null
          tabela?: string | null
          telefone?: string | null
          valor_liberado?: number | null
          vendedor?: string | null
        }
        Update: {
          banco?: string | null
          batch_id?: string | null
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          data_pago?: string | null
          id?: string
          id_contrato?: string | null
          nome?: string | null
          num_contrato?: string | null
          prazo?: number | null
          produto?: string | null
          seguro?: string | null
          tabela?: string | null
          telefone?: string | null
          valor_liberado?: number | null
          vendedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cr_relatorio_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      cr_repasse: {
        Row: {
          ade: string | null
          banco: string | null
          batch_id: string | null
          cms_rep: number | null
          cms_rep_favorecido: number | null
          cod_contrato: string | null
          convenio: string | null
          cpf: string | null
          created_at: string
          data_digitacao: string | null
          data_pgt_cliente: string | null
          favorecido: string | null
          id: string
          idade: string | null
          nome_cliente: string | null
          pct_cms: number | null
          pct_cms_bruta: number | null
          pct_rateio: number | null
          pct_rateio_fixo: number | null
          pmts: string | null
          prazo: number | null
          prod_bruta: number | null
          prod_liq: number | null
          tipo_operacao: string | null
        }
        Insert: {
          ade?: string | null
          banco?: string | null
          batch_id?: string | null
          cms_rep?: number | null
          cms_rep_favorecido?: number | null
          cod_contrato?: string | null
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          data_digitacao?: string | null
          data_pgt_cliente?: string | null
          favorecido?: string | null
          id?: string
          idade?: string | null
          nome_cliente?: string | null
          pct_cms?: number | null
          pct_cms_bruta?: number | null
          pct_rateio?: number | null
          pct_rateio_fixo?: number | null
          pmts?: string | null
          prazo?: number | null
          prod_bruta?: number | null
          prod_liq?: number | null
          tipo_operacao?: string | null
        }
        Update: {
          ade?: string | null
          banco?: string | null
          batch_id?: string | null
          cms_rep?: number | null
          cms_rep_favorecido?: number | null
          cod_contrato?: string | null
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          data_digitacao?: string | null
          data_pgt_cliente?: string | null
          favorecido?: string | null
          id?: string
          idade?: string | null
          nome_cliente?: string | null
          pct_cms?: number | null
          pct_cms_bruta?: number | null
          pct_rateio?: number | null
          pct_rateio_fixo?: number | null
          pmts?: string | null
          prazo?: number | null
          prod_bruta?: number | null
          prod_liq?: number | null
          tipo_operacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cr_repasse_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      cr_rules_clt: {
        Row: {
          banco: string
          created_at: string
          data_vigencia: string
          id: string
          prazo_max: number
          prazo_min: number
          seguro: string
          tabela_chave: string
          taxa: number
          valor_max: number
          valor_min: number
        }
        Insert: {
          banco: string
          created_at?: string
          data_vigencia: string
          id?: string
          prazo_max?: number
          prazo_min?: number
          seguro?: string
          tabela_chave?: string
          taxa?: number
          valor_max?: number
          valor_min?: number
        }
        Update: {
          banco?: string
          created_at?: string
          data_vigencia?: string
          id?: string
          prazo_max?: number
          prazo_min?: number
          seguro?: string
          tabela_chave?: string
          taxa?: number
          valor_max?: number
          valor_min?: number
        }
        Relationships: []
      }
      cr_rules_fgts: {
        Row: {
          banco: string
          created_at: string
          data_vigencia: string
          id: string
          max_valor: number
          min_valor: number
          seguro: string
          tabela_chave: string
          taxa: number
        }
        Insert: {
          banco: string
          created_at?: string
          data_vigencia: string
          id?: string
          max_valor?: number
          min_valor?: number
          seguro?: string
          tabela_chave?: string
          taxa?: number
        }
        Update: {
          banco?: string
          created_at?: string
          data_vigencia?: string
          id?: string
          max_valor?: number
          min_valor?: number
          seguro?: string
          tabela_chave?: string
          taxa?: number
        }
        Relationships: []
      }
      cr_seguros: {
        Row: {
          batch_id: string | null
          created_at: string
          data_registro: string | null
          descricao: string | null
          id: string
          id_seguro: string | null
          tipo_comissao: string | null
          valor_comissao: number | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          data_registro?: string | null
          descricao?: string | null
          id?: string
          id_seguro?: string | null
          tipo_comissao?: string | null
          valor_comissao?: number | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          data_registro?: string | null
          descricao?: string | null
          id?: string
          id_seguro?: string | null
          tipo_comissao?: string | null
          valor_comissao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cr_seguros_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      external_numbers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          phone_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          phone_number: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          phone_number?: string
        }
        Relationships: []
      }
      feature_permissions: {
        Row: {
          allowed_roles: string[]
          allowed_user_ids: string[]
          created_at: string
          feature_group: string
          feature_key: string
          feature_label: string
          id: string
          updated_at: string
        }
        Insert: {
          allowed_roles?: string[]
          allowed_user_ids?: string[]
          created_at?: string
          feature_group: string
          feature_key: string
          feature_label: string
          id?: string
          updated_at?: string
        }
        Update: {
          allowed_roles?: string[]
          allowed_user_ids?: string[]
          created_at?: string
          feature_group?: string
          feature_key?: string
          feature_label?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_candidates: {
        Row: {
          age: number | null
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          kanban_status: string
          notes: string | null
          phone: string
          phone_normalized: string | null
          photo_url: string | null
          resume_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          cpf?: string | null
          created_at?: string
          full_name: string
          id?: string
          kanban_status?: string
          notes?: string | null
          phone: string
          phone_normalized?: string | null
          photo_url?: string | null
          resume_url?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          kanban_status?: string
          notes?: string | null
          phone?: string
          phone_normalized?: string | null
          photo_url?: string | null
          resume_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_interview_answers: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          interview_id: string
          question_id: string
          question_text_snapshot: string | null
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          interview_id: string
          question_id: string
          question_text_snapshot?: string | null
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          interview_id?: string
          question_id?: string
          question_text_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_interview_answers_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "hr_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_interview_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "hr_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_interview_tokens: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          interview_id: string
          is_active: boolean
          stage: number
          token: string
          used_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          interview_id: string
          is_active?: boolean
          stage: number
          token: string
          used_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          interview_id?: string
          is_active?: boolean
          stage?: number
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_interview_tokens_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "hr_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_interview_tokens_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "hr_interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_interviews: {
        Row: {
          attended: boolean | null
          candidate_id: string
          created_at: string
          id: string
          interviewer_id: string | null
          observations: string | null
          result: string | null
          scheduled_at: string | null
          score_cultura: number | null
          score_energia: number | null
          score_tecnica: number | null
          stage: number
          updated_at: string
        }
        Insert: {
          attended?: boolean | null
          candidate_id: string
          created_at?: string
          id?: string
          interviewer_id?: string | null
          observations?: string | null
          result?: string | null
          scheduled_at?: string | null
          score_cultura?: number | null
          score_energia?: number | null
          score_tecnica?: number | null
          stage: number
          updated_at?: string
        }
        Update: {
          attended?: boolean | null
          candidate_id?: string
          created_at?: string
          id?: string
          interviewer_id?: string | null
          observations?: string | null
          result?: string | null
          scheduled_at?: string | null
          score_cultura?: number | null
          score_energia?: number | null
          score_tecnica?: number | null
          stage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "hr_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_notification_settings: {
        Row: {
          id: string
          offset_1_minutes: number
          offset_2_minutes: number
          template_1_text: string
          template_2_text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          offset_1_minutes?: number
          offset_2_minutes?: number
          template_1_text?: string
          template_2_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          offset_1_minutes?: number
          offset_2_minutes?: number
          template_1_text?: string
          template_2_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      hr_notifications: {
        Row: {
          chip_instance_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          message_template: string
          offset_minutes: number
          phone_candidate: string | null
          phone_interviewer: string | null
          recipient_type: string
          send_at: string
          sent_at: string | null
          status: string
        }
        Insert: {
          chip_instance_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          message_template: string
          offset_minutes: number
          phone_candidate?: string | null
          phone_interviewer?: string | null
          recipient_type: string
          send_at: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          chip_instance_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          message_template?: string
          offset_minutes?: number
          phone_candidate?: string | null
          phone_interviewer?: string | null
          recipient_type?: string
          send_at?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_notifications_chip_instance_id_fkey"
            columns: ["chip_instance_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_partner_leads: {
        Row: {
          accepted: boolean | null
          acquisition_source: string | null
          age: number | null
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          interview_date: string | null
          meeting_date: string | null
          meeting_status: string | null
          mei_created: string | null
          mei_informed: boolean | null
          observations: string | null
          phone: string
          phone_normalized: string | null
          referred_by: string | null
          sent_link: boolean | null
          updated_at: string
        }
        Insert: {
          accepted?: boolean | null
          acquisition_source?: string | null
          age?: number | null
          cpf?: string | null
          created_at?: string
          full_name: string
          id?: string
          interview_date?: string | null
          meeting_date?: string | null
          meeting_status?: string | null
          mei_created?: string | null
          mei_informed?: boolean | null
          observations?: string | null
          phone: string
          phone_normalized?: string | null
          referred_by?: string | null
          sent_link?: boolean | null
          updated_at?: string
        }
        Update: {
          accepted?: boolean | null
          acquisition_source?: string | null
          age?: number | null
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          interview_date?: string | null
          meeting_date?: string | null
          meeting_status?: string | null
          mei_created?: string | null
          mei_informed?: boolean | null
          observations?: string | null
          phone?: string
          phone_normalized?: string | null
          referred_by?: string | null
          sent_link?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      hr_questions: {
        Row: {
          id: string
          order_num: number
          stage: number
          text: string
        }
        Insert: {
          id?: string
          order_num: number
          stage: number
          text: string
        }
        Update: {
          id?: string
          order_num?: number
          stage?: number
          text?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          file_name: string
          file_path: string | null
          id: string
          imported_by: string
          module: string
          row_count: number
          sheet_name: string
          status: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          file_name: string
          file_path?: string | null
          id?: string
          imported_by: string
          module: string
          row_count?: number
          sheet_name: string
          status?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          imported_by?: string
          module?: string
          row_count?: number
          sheet_name?: string
          status?: string
        }
        Relationships: []
      }
      internal_channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "internal_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_channels: {
        Row: {
          admin_only_messages: boolean | null
          avatar_url: string | null
          config_allowed_users: string[] | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_group: boolean
          name: string
          updated_at: string
        }
        Insert: {
          admin_only_messages?: boolean | null
          avatar_url?: string | null
          config_allowed_users?: string[] | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_group?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          admin_only_messages?: boolean | null
          avatar_url?: string | null
          config_allowed_users?: string[] | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_group?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          id: string
          media_name: string | null
          media_type: string | null
          media_url: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          id?: string
          media_name?: string | null
          media_type?: string | null
          media_url?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          media_name?: string | null
          media_type?: string | null
          media_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "internal_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_cards: {
        Row: {
          column_id: string
          conversation_id: string
          created_at: string | null
          id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          column_id: string
          conversation_id: string
          created_at?: string | null
          id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          column_id?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          auto_archive_days: number | null
          color_hex: string | null
          created_at: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          auto_archive_days?: number | null
          color_hex?: string | null
          created_at?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          auto_archive_days?: number | null
          color_hex?: string | null
          created_at?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      labels: {
        Row: {
          chip_id: string
          color_hex: string | null
          created_at: string | null
          id: string
          label_id: string
          name: string
        }
        Insert: {
          chip_id: string
          color_hex?: string | null
          created_at?: string | null
          id?: string
          label_id: string
          name?: string
        }
        Update: {
          chip_id?: string
          color_hex?: string | null
          created_at?: string | null
          id?: string
          label_id?: string
          name?: string
        }
        Relationships: []
      }
      master_feature_toggles: {
        Row: {
          feature_group: string
          feature_key: string
          feature_label: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          feature_group?: string
          feature_key: string
          feature_label: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          feature_group?: string
          feature_key?: string
          feature_label?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      message_favorites: {
        Row: {
          chip_id: string
          created_at: string
          id: string
          message_id: string
          message_text: string | null
          remote_jid: string
          user_id: string
        }
        Insert: {
          chip_id: string
          created_at?: string
          id?: string
          message_id: string
          message_text?: string | null
          remote_jid: string
          user_id: string
        }
        Update: {
          chip_id?: string
          created_at?: string
          id?: string
          message_id?: string
          message_text?: string | null
          remote_jid?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_favorites_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      message_history: {
        Row: {
          chip_id: string
          created_at: string
          direction: string
          id: string
          media_filename: string | null
          media_mimetype: string | null
          media_type: string | null
          media_url: string | null
          message_content: string
          message_id: string | null
          quoted_message_id: string | null
          recipient_phone: string | null
          remote_jid: string | null
          sender_name: string | null
          sent_by_user_id: string | null
          status: string
        }
        Insert: {
          chip_id: string
          created_at?: string
          direction: string
          id?: string
          media_filename?: string | null
          media_mimetype?: string | null
          media_type?: string | null
          media_url?: string | null
          message_content: string
          message_id?: string | null
          quoted_message_id?: string | null
          recipient_phone?: string | null
          remote_jid?: string | null
          sender_name?: string | null
          sent_by_user_id?: string | null
          status?: string
        }
        Update: {
          chip_id?: string
          created_at?: string
          direction?: string
          id?: string
          media_filename?: string | null
          media_mimetype?: string | null
          media_type?: string | null
          media_url?: string | null
          message_content?: string
          message_id?: string | null
          quoted_message_id?: string | null
          recipient_phone?: string | null
          remote_jid?: string | null
          sender_name?: string | null
          sent_by_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_history_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          attempts: number
          chip_id: string
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          message_content: string
          priority: number
          processed_at: string | null
          recipient_phone: string
          scheduled_at: string
          status: string
        }
        Insert: {
          attempts?: number
          chip_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          message_content: string
          priority?: number
          processed_at?: string | null
          recipient_phone: string
          scheduled_at: string
          status?: string
        }
        Update: {
          attempts?: number
          chip_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          message_content?: string
          priority?: number
          processed_at?: string | null
          recipient_phone?: string
          scheduled_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      message_shortcuts: {
        Row: {
          chip_id: string | null
          created_at: string
          id: string
          is_active: boolean
          media_filename: string | null
          media_type: string | null
          media_url: string | null
          response_text: string
          trigger_word: string
          updated_at: string
          user_id: string
          visible_to_list: string[] | null
        }
        Insert: {
          chip_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          response_text: string
          trigger_word: string
          updated_at?: string
          user_id: string
          visible_to_list?: string[] | null
        }
        Update: {
          chip_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          response_text?: string
          trigger_word?: string
          updated_at?: string
          user_id?: string
          visible_to_list?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "message_shortcuts_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          media_filename: string | null
          media_type: string | null
          media_url: string | null
          sort_order: number | null
          title: string
          trigger_word: string | null
          updated_at: string
          visible_to: string | null
          visible_to_list: string[] | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          sort_order?: number | null
          title: string
          trigger_word?: string | null
          updated_at?: string
          visible_to?: string | null
          visible_to_list?: string[] | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          sort_order?: number | null
          title?: string
          trigger_word?: string | null
          updated_at?: string
          visible_to?: string | null
          visible_to_list?: string[] | null
        }
        Relationships: []
      }
      meta_message_templates: {
        Row: {
          category: string
          components: Json
          created_at: string
          id: string
          language: string
          status: string
          synced_at: string
          template_name: string
          updated_at: string
          waba_id: string
        }
        Insert: {
          category?: string
          components?: Json
          created_at?: string
          id?: string
          language?: string
          status?: string
          synced_at?: string
          template_name: string
          updated_at?: string
          waba_id: string
        }
        Update: {
          category?: string
          components?: Json
          created_at?: string
          id?: string
          language?: string
          status?: string
          synced_at?: string
          template_name?: string
          updated_at?: string
          waba_id?: string
        }
        Relationships: []
      }
      partner_history: {
        Row: {
          action: string
          created_at: string
          created_by: string
          details: Json | null
          id: string
          partner_id: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by: string
          details?: Json | null
          id?: string
          partner_id: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string
          details?: Json | null
          id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_history_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          aceitou: string | null
          auto_user_id: string | null
          aviso_previo_dias: number | null
          captacao_parceiro: string | null
          captacao_tipo: string | null
          cnpj: string | null
          contrato_assinado_em: string | null
          contrato_signed_url: string | null
          contrato_status: string | null
          contrato_url: string | null
          cpf: string | null
          created_at: string
          criou_mei: string | null
          data_contato: string | null
          dia_pagamento: number | null
          document_key: string | null
          email: string | null
          endereco: string | null
          endereco_pj: string | null
          endereco_pj_bairro: string | null
          endereco_pj_cep: string | null
          endereco_pj_municipio: string | null
          endereco_pj_numero: string | null
          endereco_pj_rua: string | null
          endereco_pj_uf: string | null
          endereco_rep_bairro: string | null
          endereco_rep_cep: string | null
          endereco_rep_complemento: string | null
          endereco_rep_municipio: string | null
          endereco_rep_numero: string | null
          endereco_rep_rua: string | null
          endereco_rep_uf: string | null
          envelope_id: string | null
          enviou_link: boolean | null
          estado_civil: string | null
          id: string
          idade: number | null
          indicado_por: string | null
          info_mei: string | null
          nacionalidade: string | null
          nome: string
          obs: string | null
          pipeline_status: string
          pix_pj: string | null
          razao_social: string | null
          reuniao: string | null
          reuniao_marcada: string | null
          telefone: string | null
          treinamento_status: string | null
          updated_at: string
          vigencia_meses: number | null
        }
        Insert: {
          aceitou?: string | null
          auto_user_id?: string | null
          aviso_previo_dias?: number | null
          captacao_parceiro?: string | null
          captacao_tipo?: string | null
          cnpj?: string | null
          contrato_assinado_em?: string | null
          contrato_signed_url?: string | null
          contrato_status?: string | null
          contrato_url?: string | null
          cpf?: string | null
          created_at?: string
          criou_mei?: string | null
          data_contato?: string | null
          dia_pagamento?: number | null
          document_key?: string | null
          email?: string | null
          endereco?: string | null
          endereco_pj?: string | null
          endereco_pj_bairro?: string | null
          endereco_pj_cep?: string | null
          endereco_pj_municipio?: string | null
          endereco_pj_numero?: string | null
          endereco_pj_rua?: string | null
          endereco_pj_uf?: string | null
          endereco_rep_bairro?: string | null
          endereco_rep_cep?: string | null
          endereco_rep_complemento?: string | null
          endereco_rep_municipio?: string | null
          endereco_rep_numero?: string | null
          endereco_rep_rua?: string | null
          endereco_rep_uf?: string | null
          envelope_id?: string | null
          enviou_link?: boolean | null
          estado_civil?: string | null
          id?: string
          idade?: number | null
          indicado_por?: string | null
          info_mei?: string | null
          nacionalidade?: string | null
          nome: string
          obs?: string | null
          pipeline_status?: string
          pix_pj?: string | null
          razao_social?: string | null
          reuniao?: string | null
          reuniao_marcada?: string | null
          telefone?: string | null
          treinamento_status?: string | null
          updated_at?: string
          vigencia_meses?: number | null
        }
        Update: {
          aceitou?: string | null
          auto_user_id?: string | null
          aviso_previo_dias?: number | null
          captacao_parceiro?: string | null
          captacao_tipo?: string | null
          cnpj?: string | null
          contrato_assinado_em?: string | null
          contrato_signed_url?: string | null
          contrato_status?: string | null
          contrato_url?: string | null
          cpf?: string | null
          created_at?: string
          criou_mei?: string | null
          data_contato?: string | null
          dia_pagamento?: number | null
          document_key?: string | null
          email?: string | null
          endereco?: string | null
          endereco_pj?: string | null
          endereco_pj_bairro?: string | null
          endereco_pj_cep?: string | null
          endereco_pj_municipio?: string | null
          endereco_pj_numero?: string | null
          endereco_pj_rua?: string | null
          endereco_pj_uf?: string | null
          endereco_rep_bairro?: string | null
          endereco_rep_cep?: string | null
          endereco_rep_complemento?: string | null
          endereco_rep_municipio?: string | null
          endereco_rep_numero?: string | null
          endereco_rep_rua?: string | null
          endereco_rep_uf?: string | null
          envelope_id?: string | null
          enviou_link?: boolean | null
          estado_civil?: string | null
          id?: string
          idade?: number | null
          indicado_por?: string | null
          info_mei?: string | null
          nacionalidade?: string | null
          nome?: string
          obs?: string | null
          pipeline_status?: string
          pix_pj?: string | null
          razao_social?: string | null
          reuniao?: string | null
          reuniao_marcada?: string | null
          telefone?: string | null
          treinamento_status?: string | null
          updated_at?: string
          vigencia_meses?: number | null
        }
        Relationships: []
      }
      product_info_cells: {
        Row: {
          column_id: string
          content: string
          id: string
          row_id: string
          updated_at: string
        }
        Insert: {
          column_id: string
          content?: string
          id?: string
          row_id: string
          updated_at?: string
        }
        Update: {
          column_id?: string
          content?: string
          id?: string
          row_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_info_cells_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "product_info_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_info_cells_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "product_info_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      product_info_columns: {
        Row: {
          column_name: string
          created_at: string
          id: string
          sort_order: number
          tab_id: string
        }
        Insert: {
          column_name: string
          created_at?: string
          id?: string
          sort_order?: number
          tab_id: string
        }
        Update: {
          column_name?: string
          created_at?: string
          id?: string
          sort_order?: number
          tab_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_info_columns_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "product_info_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_info_rows: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          tab_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          tab_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          tab_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_info_rows_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "product_info_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_info_tabs: {
        Row: {
          created_at: string
          id: string
          sort_order: number
          tab_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number
          tab_name: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number
          tab_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_blocked: boolean
          max_chips: number
          must_change_password: boolean
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_blocked?: boolean
          max_chips?: number
          must_change_password?: boolean
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_blocked?: boolean
          max_chips?: number
          must_change_password?: boolean
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_pix: {
        Row: {
          created_at: string
          id: string
          pix_key: string
          pix_type: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pix_key: string
          pix_type?: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pix_key?: string
          pix_type?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_pix_v2: {
        Row: {
          created_at: string
          id: string
          pix_key: string
          pix_type: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pix_key: string
          pix_type?: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pix_key?: string
          pix_type?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      shared_queue_agents: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_concurrent: number
          queue_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_concurrent?: number
          queue_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_concurrent?: number
          queue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_queue_agents_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "shared_queue_config"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_queue_assignments: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          conversation_id: string
          created_at: string
          id: string
          queue_id: string
          released_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          queue_id: string
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          queue_id?: string
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_queue_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_queue_assignments_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "shared_queue_config"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_queue_config: {
        Row: {
          chip_id: string
          created_at: string
          id: string
          is_active: boolean
          max_wait_minutes: number
          name: string
          updated_at: string
        }
        Insert: {
          chip_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_wait_minutes?: number
          name: string
          updated_at?: string
        }
        Update: {
          chip_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_wait_minutes?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_queue_config_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          attachment_name: string | null
          attachment_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          auto_phase_progression: boolean
          batch_pause_seconds: number
          batch_size: number
          commission_name_match_threshold: number
          consecutive_message_limit: number
          contract_template: string | null
          cooldown_after_error: number
          created_at: string
          days_phase_aquecido: number
          days_phase_crescimento: number
          days_phase_iniciante: number
          days_phase_novo: number
          end_hour: number
          evolution_api_key: string | null
          evolution_api_url: string | null
          global_message_cursor: number | null
          human_pattern_mode: boolean
          id: string
          is_warming_active: boolean
          lead_column_aliases: Json | null
          lead_profile_options: Json | null
          lead_status_options: Json | null
          lead_table_columns: Json | null
          max_interval_seconds: number
          max_messages_per_hour: number
          messages_day_1_3: number
          messages_day_4_7: number
          messages_day_8_plus: number
          messages_day_aquecido: number
          messages_day_novo: number
          meta_access_token: string | null
          meta_allowed_user_ids: string[]
          meta_app_id: string | null
          meta_app_secret: string | null
          meta_verify_token: string | null
          meta_webhook_secret: string | null
          min_interval_seconds: number
          night_mode_reduction: number
          online_offline_simulation: boolean
          provider_api_key: string | null
          provider_api_url: string | null
          random_delay_variation: number
          read_delay_seconds: number
          seller_leads_columns: Json | null
          start_hour: number
          support_chat_user_id: string | null
          timezone: string | null
          typing_simulation: boolean
          typing_speed_chars_sec: number
          uazapi_api_key: string | null
          uazapi_api_url: string | null
          updated_at: string
          warming_mode: string
          weekend_reduction_percent: number
          whatsapp_provider: string
        }
        Insert: {
          auto_phase_progression?: boolean
          batch_pause_seconds?: number
          batch_size?: number
          commission_name_match_threshold?: number
          consecutive_message_limit?: number
          contract_template?: string | null
          cooldown_after_error?: number
          created_at?: string
          days_phase_aquecido?: number
          days_phase_crescimento?: number
          days_phase_iniciante?: number
          days_phase_novo?: number
          end_hour?: number
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          global_message_cursor?: number | null
          human_pattern_mode?: boolean
          id?: string
          is_warming_active?: boolean
          lead_column_aliases?: Json | null
          lead_profile_options?: Json | null
          lead_status_options?: Json | null
          lead_table_columns?: Json | null
          max_interval_seconds?: number
          max_messages_per_hour?: number
          messages_day_1_3?: number
          messages_day_4_7?: number
          messages_day_8_plus?: number
          messages_day_aquecido?: number
          messages_day_novo?: number
          meta_access_token?: string | null
          meta_allowed_user_ids?: string[]
          meta_app_id?: string | null
          meta_app_secret?: string | null
          meta_verify_token?: string | null
          meta_webhook_secret?: string | null
          min_interval_seconds?: number
          night_mode_reduction?: number
          online_offline_simulation?: boolean
          provider_api_key?: string | null
          provider_api_url?: string | null
          random_delay_variation?: number
          read_delay_seconds?: number
          seller_leads_columns?: Json | null
          start_hour?: number
          support_chat_user_id?: string | null
          timezone?: string | null
          typing_simulation?: boolean
          typing_speed_chars_sec?: number
          uazapi_api_key?: string | null
          uazapi_api_url?: string | null
          updated_at?: string
          warming_mode?: string
          weekend_reduction_percent?: number
          whatsapp_provider?: string
        }
        Update: {
          auto_phase_progression?: boolean
          batch_pause_seconds?: number
          batch_size?: number
          commission_name_match_threshold?: number
          consecutive_message_limit?: number
          contract_template?: string | null
          cooldown_after_error?: number
          created_at?: string
          days_phase_aquecido?: number
          days_phase_crescimento?: number
          days_phase_iniciante?: number
          days_phase_novo?: number
          end_hour?: number
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          global_message_cursor?: number | null
          human_pattern_mode?: boolean
          id?: string
          is_warming_active?: boolean
          lead_column_aliases?: Json | null
          lead_profile_options?: Json | null
          lead_status_options?: Json | null
          lead_table_columns?: Json | null
          max_interval_seconds?: number
          max_messages_per_hour?: number
          messages_day_1_3?: number
          messages_day_4_7?: number
          messages_day_8_plus?: number
          messages_day_aquecido?: number
          messages_day_novo?: number
          meta_access_token?: string | null
          meta_allowed_user_ids?: string[]
          meta_app_id?: string | null
          meta_app_secret?: string | null
          meta_verify_token?: string | null
          meta_webhook_secret?: string | null
          min_interval_seconds?: number
          night_mode_reduction?: number
          online_offline_simulation?: boolean
          provider_api_key?: string | null
          provider_api_url?: string | null
          random_delay_variation?: number
          read_delay_seconds?: number
          seller_leads_columns?: Json | null
          start_hour?: number
          support_chat_user_id?: string | null
          timezone?: string | null
          typing_simulation?: boolean
          typing_speed_chars_sec?: number
          uazapi_api_key?: string | null
          uazapi_api_url?: string | null
          updated_at?: string
          warming_mode?: string
          weekend_reduction_percent?: number
          whatsapp_provider?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          added_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          ticket_id?: string
          user_id?: string
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
      useful_links: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          sort_order: number | null
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          sort_order?: number | null
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
          url?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      v8_batches: {
        Row: {
          canceled_at: string | null
          canceled_by: string | null
          completed_at: string | null
          config_id: string | null
          config_name: string | null
          created_at: string
          created_by: string
          failure_count: number
          id: string
          installments: number | null
          name: string
          pending_count: number
          status: string
          success_count: number
          total_count: number
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          canceled_by?: string | null
          completed_at?: string | null
          config_id?: string | null
          config_name?: string | null
          created_at?: string
          created_by: string
          failure_count?: number
          id?: string
          installments?: number | null
          name: string
          pending_count?: number
          status?: string
          success_count?: number
          total_count?: number
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          canceled_by?: string | null
          completed_at?: string | null
          config_id?: string | null
          config_name?: string | null
          created_at?: string
          created_by?: string
          failure_count?: number
          id?: string
          installments?: number | null
          name?: string
          pending_count?: number
          status?: string
          success_count?: number
          total_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      v8_configs_cache: {
        Row: {
          bank_name: string | null
          config_id: string
          created_at: string
          id: string
          is_active: boolean
          max_term: number | null
          max_value: number | null
          min_term: number | null
          min_value: number | null
          name: string
          product_type: string | null
          raw_data: Json | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          config_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_term?: number | null
          max_value?: number | null
          min_term?: number | null
          min_value?: number | null
          name: string
          product_type?: string | null
          raw_data?: Json | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          config_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_term?: number | null
          max_value?: number | null
          min_term?: number | null
          min_value?: number | null
          name?: string
          product_type?: string | null
          raw_data?: Json | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      v8_margin_config: {
        Row: {
          created_at: string
          id: string
          margin_percent: number
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          margin_percent?: number
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          margin_percent?: number
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      v8_operation_drafts: {
        Row: {
          borrower_name: string | null
          cpf: string | null
          created_at: string
          form_data: Json
          id: string
          is_submitted: boolean
          last_error: string | null
          last_step: string | null
          origin_id: string | null
          origin_type: string
          submitted_at: string | null
          submitted_operation_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          borrower_name?: string | null
          cpf?: string | null
          created_at?: string
          form_data?: Json
          id?: string
          is_submitted?: boolean
          last_error?: string | null
          last_step?: string | null
          origin_id?: string | null
          origin_type: string
          submitted_at?: string | null
          submitted_operation_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          borrower_name?: string | null
          cpf?: string | null
          created_at?: string
          form_data?: Json
          id?: string
          is_submitted?: boolean
          last_error?: string | null
          last_step?: string | null
          origin_id?: string | null
          origin_type?: string
          submitted_at?: string | null
          submitted_operation_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      v8_operations_local: {
        Row: {
          borrower_cpf: string | null
          borrower_email: string | null
          borrower_name: string | null
          borrower_phone: string | null
          consult_id: string | null
          contract_number: string | null
          contract_url: string | null
          disbursed_amount: number | null
          first_due_date: string | null
          first_seen_at: string
          formalization_url: string | null
          id: string
          installment_value: number | null
          last_status_change_at: string | null
          last_updated_at: string
          monthly_interest_rate: number | null
          number_of_installments: number | null
          operation_id: string
          paid_at: string | null
          raw_payload: Json | null
          status: string | null
          v8_created_at: string | null
          v8_simulation_id: string | null
        }
        Insert: {
          borrower_cpf?: string | null
          borrower_email?: string | null
          borrower_name?: string | null
          borrower_phone?: string | null
          consult_id?: string | null
          contract_number?: string | null
          contract_url?: string | null
          disbursed_amount?: number | null
          first_due_date?: string | null
          first_seen_at?: string
          formalization_url?: string | null
          id?: string
          installment_value?: number | null
          last_status_change_at?: string | null
          last_updated_at?: string
          monthly_interest_rate?: number | null
          number_of_installments?: number | null
          operation_id: string
          paid_at?: string | null
          raw_payload?: Json | null
          status?: string | null
          v8_created_at?: string | null
          v8_simulation_id?: string | null
        }
        Update: {
          borrower_cpf?: string | null
          borrower_email?: string | null
          borrower_name?: string | null
          borrower_phone?: string | null
          consult_id?: string | null
          contract_number?: string | null
          contract_url?: string | null
          disbursed_amount?: number | null
          first_due_date?: string | null
          first_seen_at?: string
          formalization_url?: string | null
          id?: string
          installment_value?: number | null
          last_status_change_at?: string | null
          last_updated_at?: string
          monthly_interest_rate?: number | null
          number_of_installments?: number | null
          operation_id?: string
          paid_at?: string | null
          raw_payload?: Json | null
          status?: string | null
          v8_created_at?: string | null
          v8_simulation_id?: string | null
        }
        Relationships: []
      }
      v8_settings: {
        Row: {
          auto_simulate_after_consult: boolean | null
          background_retry_enabled: boolean
          consult_throttle_ms: number | null
          created_at: string
          id: string
          max_auto_retry_attempts: number
          require_documents_on_create: boolean
          retry_batch_size: number
          retry_max_backoff_seconds: number
          retry_min_backoff_seconds: number
          simulate_throttle_ms: number | null
          simulation_strategy: string | null
          singleton: boolean
          sound_on_complete: boolean
          updated_at: string
          updated_by: string | null
          webhook_wait_timeout_min: number | null
        }
        Insert: {
          auto_simulate_after_consult?: boolean | null
          background_retry_enabled?: boolean
          consult_throttle_ms?: number | null
          created_at?: string
          id?: string
          max_auto_retry_attempts?: number
          require_documents_on_create?: boolean
          retry_batch_size?: number
          retry_max_backoff_seconds?: number
          retry_min_backoff_seconds?: number
          simulate_throttle_ms?: number | null
          simulation_strategy?: string | null
          singleton?: boolean
          sound_on_complete?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_wait_timeout_min?: number | null
        }
        Update: {
          auto_simulate_after_consult?: boolean | null
          background_retry_enabled?: boolean
          consult_throttle_ms?: number | null
          created_at?: string
          id?: string
          max_auto_retry_attempts?: number
          require_documents_on_create?: boolean
          retry_batch_size?: number
          retry_max_backoff_seconds?: number
          retry_min_backoff_seconds?: number
          simulate_throttle_ms?: number | null
          simulation_strategy?: string | null
          singleton?: boolean
          sound_on_complete?: boolean
          updated_at?: string
          updated_by?: string | null
          webhook_wait_timeout_min?: number | null
        }
        Relationships: []
      }
      v8_simulation_attempts: {
        Row: {
          attempt_number: number
          batch_id: string | null
          created_at: string
          duration_ms: number | null
          error_kind: string | null
          error_message: string | null
          http_status: number | null
          id: string
          request_payload: Json | null
          response_body: Json | null
          simulation_id: string
          status: string | null
          triggered_by: string
          triggered_by_user: string | null
        }
        Insert: {
          attempt_number: number
          batch_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_kind?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          request_payload?: Json | null
          response_body?: Json | null
          simulation_id: string
          status?: string | null
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Update: {
          attempt_number?: number
          batch_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_kind?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          request_payload?: Json | null
          response_body?: Json | null
          simulation_id?: string
          status?: string | null
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v8_simulation_attempts_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "v8_simulations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v8_simulation_attempts_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "v8_simulations_audit"
            referencedColumns: ["simulation_id"]
          },
        ]
      }
      v8_simulations: {
        Row: {
          admission_months_diff: number | null
          amount_to_charge: number | null
          attempt_count: number
          batch_id: string | null
          birth_date: string | null
          company_margin: number | null
          config_id: string | null
          config_name: string | null
          consult_id: string | null
          cpf: string
          created_at: string
          created_by: string | null
          error_kind: string | null
          error_message: string | null
          id: string
          installment_value: number | null
          installments: number | null
          interest_rate: number | null
          is_orphan: boolean
          last_attempt_at: string | null
          last_step: string | null
          last_webhook_at: string | null
          margem_valor: number | null
          name: string | null
          processed_at: string | null
          raw_response: Json | null
          released_value: number | null
          sim_installments_max: number | null
          sim_installments_min: number | null
          sim_month_max: number | null
          sim_month_min: number | null
          sim_value_max: number | null
          sim_value_min: number | null
          simulate_attempted_at: string | null
          simulate_status: string | null
          simulation_strategy: string | null
          status: string
          total_value: number | null
          updated_at: string
          v8_simulation_id: string | null
          v8_status_snapshot_at: string | null
          webhook_status: string | null
        }
        Insert: {
          admission_months_diff?: number | null
          amount_to_charge?: number | null
          attempt_count?: number
          batch_id?: string | null
          birth_date?: string | null
          company_margin?: number | null
          config_id?: string | null
          config_name?: string | null
          consult_id?: string | null
          cpf: string
          created_at?: string
          created_by?: string | null
          error_kind?: string | null
          error_message?: string | null
          id?: string
          installment_value?: number | null
          installments?: number | null
          interest_rate?: number | null
          is_orphan?: boolean
          last_attempt_at?: string | null
          last_step?: string | null
          last_webhook_at?: string | null
          margem_valor?: number | null
          name?: string | null
          processed_at?: string | null
          raw_response?: Json | null
          released_value?: number | null
          sim_installments_max?: number | null
          sim_installments_min?: number | null
          sim_month_max?: number | null
          sim_month_min?: number | null
          sim_value_max?: number | null
          sim_value_min?: number | null
          simulate_attempted_at?: string | null
          simulate_status?: string | null
          simulation_strategy?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          v8_simulation_id?: string | null
          v8_status_snapshot_at?: string | null
          webhook_status?: string | null
        }
        Update: {
          admission_months_diff?: number | null
          amount_to_charge?: number | null
          attempt_count?: number
          batch_id?: string | null
          birth_date?: string | null
          company_margin?: number | null
          config_id?: string | null
          config_name?: string | null
          consult_id?: string | null
          cpf?: string
          created_at?: string
          created_by?: string | null
          error_kind?: string | null
          error_message?: string | null
          id?: string
          installment_value?: number | null
          installments?: number | null
          interest_rate?: number | null
          is_orphan?: boolean
          last_attempt_at?: string | null
          last_step?: string | null
          last_webhook_at?: string | null
          margem_valor?: number | null
          name?: string | null
          processed_at?: string | null
          raw_response?: Json | null
          released_value?: number | null
          sim_installments_max?: number | null
          sim_installments_min?: number | null
          sim_month_max?: number | null
          sim_month_min?: number | null
          sim_value_max?: number | null
          sim_value_min?: number | null
          simulate_attempted_at?: string | null
          simulate_status?: string | null
          simulation_strategy?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
          v8_simulation_id?: string | null
          v8_status_snapshot_at?: string | null
          webhook_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v8_simulations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v8_batch_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v8_simulations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v8_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      v8_webhook_logs: {
        Row: {
          consult_id: string | null
          cpf: string | null
          event_type: string
          headers: Json | null
          id: string
          operation_id: string | null
          payload: Json
          process_error: string | null
          processed: boolean
          received_at: string
          status: string | null
          v8_simulation_id: string | null
        }
        Insert: {
          consult_id?: string | null
          cpf?: string | null
          event_type: string
          headers?: Json | null
          id?: string
          operation_id?: string | null
          payload: Json
          process_error?: string | null
          processed?: boolean
          received_at?: string
          status?: string | null
          v8_simulation_id?: string | null
        }
        Update: {
          consult_id?: string | null
          cpf?: string | null
          event_type?: string
          headers?: Json | null
          id?: string
          operation_id?: string | null
          payload?: Json
          process_error?: string | null
          processed?: boolean
          received_at?: string
          status?: string | null
          v8_simulation_id?: string | null
        }
        Relationships: []
      }
      v8_webhook_registrations: {
        Row: {
          created_at: string
          id: string
          last_confirm_received_at: string | null
          last_error: string | null
          last_registered_at: string | null
          last_status: string | null
          last_test_received_at: string | null
          registered_url: string
          updated_at: string
          webhook_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_confirm_received_at?: string | null
          last_error?: string | null
          last_registered_at?: string | null
          last_status?: string | null
          last_test_received_at?: string | null
          registered_url: string
          updated_at?: string
          webhook_type: string
        }
        Update: {
          created_at?: string
          id?: string
          last_confirm_received_at?: string | null
          last_error?: string | null
          last_registered_at?: string | null
          last_status?: string | null
          last_test_received_at?: string | null
          registered_url?: string
          updated_at?: string
          webhook_type?: string
        }
        Relationships: []
      }
      warming_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          message_order: number | null
          source_file: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          message_order?: number | null
          source_file?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          message_order?: number | null
          source_file?: string | null
        }
        Relationships: []
      }
      warming_phase_rules: {
        Row: {
          created_at: string
          id: string
          min_avg_messages: number
          min_days: number
          phase_from: string
          phase_to: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_avg_messages?: number
          min_days?: number
          phase_from: string
          phase_to: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_avg_messages?: number
          min_days?: number
          phase_from?: string
          phase_to?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          chip_id: string | null
          created_at: string
          event_type: string
          id: string
          instance_name: string | null
          payload: Json | null
          processing_result: string | null
          status_code: number | null
        }
        Insert: {
          chip_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          instance_name?: string | null
          payload?: Json | null
          processing_result?: string | null
          status_code?: number | null
        }
        Update: {
          chip_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          instance_name?: string | null
          payload?: Json | null
          processing_result?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_cost_log: {
        Row: {
          category: string
          chip_id: string
          conversation_id: string | null
          cost_estimate: number
          created_at: string
          currency: string
          direction: string
          id: string
        }
        Insert: {
          category?: string
          chip_id: string
          conversation_id?: string | null
          cost_estimate?: number
          created_at?: string
          currency?: string
          direction?: string
          id?: string
        }
        Update: {
          category?: string
          chip_id?: string
          conversation_id?: string | null
          cost_estimate?: number
          created_at?: string
          currency?: string
          direction?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_cost_log_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_cost_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v8_batch_summary: {
        Row: {
          avg_released: number | null
          completed_at: string | null
          config_name: string | null
          created_at: string | null
          created_by: string | null
          failure_count: number | null
          id: string | null
          installments: number | null
          name: string | null
          pending_count: number | null
          status: string | null
          success_count: number | null
          success_rate: number | null
          total_count: number | null
          total_margin: number | null
          total_released: number | null
        }
        Relationships: []
      }
      v8_simulations_audit: {
        Row: {
          batch_id: string | null
          cpf: string | null
          created_at: string | null
          current_error_kind: string | null
          current_error_message: string | null
          current_status: string | null
          installment_value: number | null
          installments: number | null
          margem_valor: number | null
          migration_action: string | null
          migration_fixed_at: string | null
          name: string | null
          processed_at: string | null
          released_value: number | null
          simulation_id: string | null
          v8_snapshot_status: string | null
        }
        Insert: {
          batch_id?: string | null
          cpf?: string | null
          created_at?: string | null
          current_error_kind?: string | null
          current_error_message?: string | null
          current_status?: string | null
          installment_value?: number | null
          installments?: number | null
          margem_valor?: number | null
          migration_action?: never
          migration_fixed_at?: never
          name?: string | null
          processed_at?: string | null
          released_value?: number | null
          simulation_id?: string | null
          v8_snapshot_status?: never
        }
        Update: {
          batch_id?: string | null
          cpf?: string | null
          created_at?: string | null
          current_error_kind?: string | null
          current_error_message?: string | null
          current_status?: string | null
          installment_value?: number | null
          installments?: number | null
          margem_valor?: number | null
          migration_action?: never
          migration_fixed_at?: never
          name?: string | null
          processed_at?: string | null
          released_value?: number | null
          simulation_id?: string | null
          v8_snapshot_status?: never
        }
        Relationships: [
          {
            foreignKeyName: "v8_simulations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v8_batch_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v8_simulations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v8_batches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      audit_logs_estimated_count: { Args: never; Returns: number }
      auto_match_corban_sellers: { Args: never; Returns: Json }
      calculate_commission_audit: {
        Args: { _date_from?: string; _date_to?: string }
        Returns: {
          banco: string
          comissao_esperada: number
          comissao_recebida: number
          data_pago: string
          diferenca: number
          nome: string
          num_contrato: string
          prazo: number
          produto: string
          seguro: string
          tabela: string
          valor_assegurado: number
          valor_liberado: number
          vendedor: string
        }[]
      }
      classify_v8_error_kind: {
        Args: { error_message: string; raw_response: Json }
        Returns: string
      }
      cleanup_audit_logs: { Args: never; Returns: undefined }
      cleanup_webhook_logs: { Args: never; Returns: undefined }
      corban_classify_status: { Args: { _status: string }; Returns: string }
      create_direct_channel: {
        Args: { _channel_name: string; _target_user_id: string }
        Returns: string
      }
      get_all_chat_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          name: string
          user_id: string
        }[]
      }
      get_avg_response_time: {
        Args: { _date_from?: string; _date_to?: string }
        Returns: Json
      }
      get_internal_chat_profiles: {
        Args: never
        Returns: {
          email: string
          name: string
          user_id: string
        }[]
      }
      get_internal_chat_profiles_v2: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          name: string
          user_id: string
        }[]
      }
      get_internal_unread_counts: {
        Args: never
        Returns: {
          channel_id: string
          unread_count: number
        }[]
      }
      get_lead_counts: { Args: { _user_id: string }; Returns: Json }
      get_lead_status_distribution: {
        Args: { _date_from?: string; _date_to?: string }
        Returns: Json
      }
      get_lead_status_distribution_v2: {
        Args: { _date_from?: string; _date_to?: string }
        Returns: Json
      }
      get_master_user_ids: { Args: never; Returns: string[] }
      get_non_seller_user_ids: { Args: never; Returns: string[] }
      get_performance_stats: {
        Args: { _date_from?: string; _date_to?: string }
        Returns: Json
      }
      get_performance_stats_v2: {
        Args: { _date_from?: string; _date_to?: string }
        Returns: Json
      }
      get_visible_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          name: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hr_notify_interview_submitted: {
        Args: { _author_id?: string; _candidate_id: string; _stage: number }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_privileged: { Args: { _user_id?: string }; Returns: boolean }
      jsonb_pick_text: {
        Args: { _keys: string[]; _obj: Json }
        Returns: string
      }
      mark_channel_read: { Args: { _channel_id: string }; Returns: undefined }
      match_seller_by_name: {
        Args: { _name: string; _threshold?: number }
        Returns: {
          ambiguous: boolean
          name: string
          score: number
          user_id: string
        }[]
      }
      purge_old_deleted_batches: { Args: never; Returns: number }
      reset_daily_message_count: { Args: never; Returns: undefined }
      restore_import_batch: { Args: { _batch_id: string }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      soft_delete_import_batch: {
        Args: { _batch_id: string; _reason?: string }
        Returns: Json
      }
      update_channel_info: {
        Args: {
          _admin_only?: boolean
          _avatar_url?: string
          _channel_id: string
          _config_allowed?: string[]
          _description?: string
          _name?: string
        }
        Returns: undefined
      }
      update_own_profile: {
        Args: { _avatar_url?: string; _name?: string }
        Returns: undefined
      }
      v8_backfill_operation_fields: {
        Args: { _limit?: number }
        Returns: number
      }
      v8_backfill_simulation_config: {
        Args: { _batch_id?: string }
        Returns: number
      }
      v8_extract_operation_fields: { Args: { _payload: Json }; Returns: Json }
      v8_increment_batch_failure: {
        Args: { _batch_id: string }
        Returns: undefined
      }
      v8_increment_batch_success: {
        Args: { _batch_id: string }
        Returns: undefined
      }
      v8_recalc_batch_counters: {
        Args: { _batch_id: string }
        Returns: undefined
      }
      v8_resolve_webhook_cpf: {
        Args: {
          _consult_id: string
          _operation_id: string
          _payload: Json
          _v8_simulation_id: string
        }
        Returns: string
      }
      v8_webhook_type_counts: {
        Args: never
        Returns: {
          event_type: string
          total: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "seller" | "support" | "master" | "manager"
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
      app_role: ["admin", "user", "seller", "support", "master", "manager"],
    },
  },
} as const

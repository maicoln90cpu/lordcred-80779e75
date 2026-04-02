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
          chip_type: string
          created_at: string
          health_fail_count: number
          id: string
          instance_name: string
          instance_token: string | null
          last_connection_attempt: string | null
          last_message_at: string | null
          last_sync_at: string | null
          last_sync_cursor: number | null
          last_webhook_at: string | null
          messages_sent_today: number
          nickname: string | null
          phone_number: string | null
          slot_number: number
          status: string
          updated_at: string
          user_id: string
          warming_phase: string
        }
        Insert: {
          activated_at?: string | null
          chip_type?: string
          created_at?: string
          health_fail_count?: number
          id?: string
          instance_name: string
          instance_token?: string | null
          last_connection_attempt?: string | null
          last_message_at?: string | null
          last_sync_at?: string | null
          last_sync_cursor?: number | null
          last_webhook_at?: string | null
          messages_sent_today?: number
          nickname?: string | null
          phone_number?: string | null
          slot_number: number
          status?: string
          updated_at?: string
          user_id: string
          warming_phase?: string
        }
        Update: {
          activated_at?: string | null
          chip_type?: string
          created_at?: string
          health_fail_count?: number
          id?: string
          instance_name?: string
          instance_token?: string | null
          last_connection_attempt?: string | null
          last_message_at?: string | null
          last_sync_at?: string | null
          last_sync_cursor?: number | null
          last_webhook_at?: string | null
          messages_sent_today?: number
          nickname?: string | null
          phone_number?: string | null
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
      commission_rates_clt: {
        Row: {
          bank: string
          created_at: string
          effective_date: string
          has_insurance: boolean
          id: string
          obs: string | null
          rate: number
          term_max: number
          term_min: number
        }
        Insert: {
          bank: string
          created_at?: string
          effective_date: string
          has_insurance?: boolean
          id?: string
          obs?: string | null
          rate?: number
          term_max?: number
          term_min?: number
        }
        Update: {
          bank?: string
          created_at?: string
          effective_date?: string
          has_insurance?: boolean
          id?: string
          obs?: string | null
          rate?: number
          term_max?: number
          term_min?: number
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
      commission_sales: {
        Row: {
          bank: string
          batch_id: string | null
          bonus_value: number | null
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
          term: number | null
          updated_at: string
          week_label: string | null
        }
        Insert: {
          bank: string
          batch_id?: string | null
          bonus_value?: number | null
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
          term?: number | null
          updated_at?: string
          week_label?: string | null
        }
        Update: {
          bank?: string
          batch_id?: string | null
          bonus_value?: number | null
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
      commission_settings: {
        Row: {
          bonus_rate: number
          bonus_threshold: number | null
          created_at: string
          id: string
          payment_day: number
          updated_at: string
          week_start_day: number
        }
        Insert: {
          bonus_rate?: number
          bonus_threshold?: number | null
          created_at?: string
          id?: string
          payment_day?: number
          updated_at?: string
          week_start_day?: number
        }
        Update: {
          bonus_rate?: number
          bonus_threshold?: number | null
          created_at?: string
          id?: string
          payment_day?: number
          updated_at?: string
          week_start_day?: number
        }
        Relationships: []
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
      import_batches: {
        Row: {
          created_at: string
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
          name: string | null
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
          name?: string | null
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
          name?: string | null
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
      support_tickets: {
        Row: {
          assigned_to: string | null
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
          consecutive_message_limit: number
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
          consecutive_message_limit?: number
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
          consecutive_message_limit?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_webhook_logs: { Args: never; Returns: undefined }
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
      get_master_user_ids: { Args: never; Returns: string[] }
      get_non_seller_user_ids: { Args: never; Returns: string[] }
      get_performance_stats: {
        Args: { _date_from?: string; _date_to?: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_privileged: { Args: { _user_id?: string }; Returns: boolean }
      mark_channel_read: { Args: { _channel_id: string }; Returns: undefined }
      reset_daily_message_count: { Args: never; Returns: undefined }
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

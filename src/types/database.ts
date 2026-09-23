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
      ai_models: {
        Row: {
          id: string
          provider: string
          name: string
          is_enabled: boolean
          estimated_cost_per_image: number | null
          cost_currency: string
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          provider: string
          name: string
          is_enabled?: boolean
          estimated_cost_per_image?: number | null
          cost_currency?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider?: string
          name?: string
          is_enabled?: boolean
          estimated_cost_per_image?: number | null
          cost_currency?: string
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          id: boolean
          integration_enabled: boolean
          default_max_requests: number
          period_days: number
          allow_restricted_references: boolean
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          integration_enabled?: boolean
          default_max_requests?: number
          period_days?: number
          allow_restricted_references?: boolean
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          integration_enabled?: boolean
          default_max_requests?: number
          period_days?: number
          allow_restricted_references?: boolean
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_user_limits: {
        Row: {
          user_id: string
          max_requests: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          max_requests: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          max_requests?: number
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      approval_events: {
        Row: {
          version_id: string | null
          from_status: string | null
          to_status: string | null
          cycle: number | null
          action: string
          actor_id: string
          comment: string | null
          content_id: string
          created_at: string
          id: string
        }
        Insert: {
          version_id?: string | null
          from_status?: string | null
          to_status?: string | null
          cycle?: number | null
          action: string
          actor_id: string
          comment?: string | null
          content_id: string
          created_at?: string
          id?: string
        }
        Update: {
          version_id?: string | null
          from_status?: string | null
          to_status?: string | null
          cycle?: number | null
          action?: string
          actor_id?: string
          comment?: string | null
          content_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_events_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      brand_settings: {
        Row: {
          accent_color: string
          font_family: string
          footer_text: string
          id: boolean
          logo_url: string
          organization: string
          primary_color: string
          updated_at: string
        }
        Insert: {
          accent_color: string
          font_family?: string
          footer_text?: string
          id?: boolean
          logo_url?: string
          organization: string
          primary_color: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          font_family?: string
          footer_text?: string
          id?: boolean
          logo_url?: string
          organization?: string
          primary_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_versions: {
        Row: {
          content_id: string
          created_at: string
          created_by: string
          id: string
          label: string | null
          snapshot: Json
          updated_at: string
          version_kind: string
          version_number: number
        }
        Insert: {
          content_id: string
          created_at?: string
          created_by: string
          id?: string
          label?: string | null
          snapshot: Json
          updated_at?: string
          version_kind?: string
          version_number: number
        }
        Update: {
          content_id?: string
          created_at?: string
          created_by?: string
          id?: string
          label?: string | null
          snapshot?: Json
          updated_at?: string
          version_kind?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_versions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contents: {
        Row: {
          submitted_version_id: string | null
          approved_version_id: string | null
          assigned_reviewer_id: string | null
          submitted_at: string | null
          approved_at: string | null
          approved_by: string | null
          review_cycle: number
          archived_at: string | null
          archived_by: string | null
          archived_from_status: string | null
          category: string
          collection_name: string
          created_at: string
          created_by: string
          description: string | null
          editorial_details: Json
          id: string
          layout_snapshot: Json
          reference_date: string | null
          source_name: string | null
          source_url: string | null
          status: string
          subtitle: string | null
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          submitted_version_id?: string | null
          approved_version_id?: string | null
          assigned_reviewer_id?: string | null
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          review_cycle?: number
          archived_at?: string | null
          archived_by?: string | null
          archived_from_status?: string | null
          category: string
          collection_name?: string
          created_at?: string
          created_by: string
          description?: string | null
          editorial_details?: Json
          id?: string
          layout_snapshot?: Json
          reference_date?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string
          subtitle?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          submitted_version_id?: string | null
          approved_version_id?: string | null
          assigned_reviewer_id?: string | null
          submitted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          review_cycle?: number
          archived_at?: string | null
          archived_by?: string | null
          archived_from_status?: string | null
          category?: string
          collection_name?: string
          created_at?: string
          created_by?: string
          description?: string | null
          editorial_details?: Json
          id?: string
          layout_snapshot?: Json
          reference_date?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string
          subtitle?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          provider: string
          model: string
          prompt: string
          settings: Json
          external_request_id: string | null
          error_message: string | null
          estimated_cost: number | null
          actual_cost: number | null
          image_count: number
          completed_at: string | null
          finalizing_at: string | null
          parent_job_id: string | null
          content_id: string
          created_at: string
          created_by: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          provider: string
          model: string
          prompt: string
          settings?: Json
          external_request_id?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
          image_count?: number
          completed_at?: string | null
          finalizing_at?: string | null
          parent_job_id?: string | null
          content_id: string
          created_at?: string
          created_by: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          provider?: string
          model?: string
          prompt?: string
          settings?: Json
          external_request_id?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
          image_count?: number
          completed_at?: string | null
          finalizing_at?: string | null
          parent_job_id?: string | null
          content_id?: string
          created_at?: string
          created_by?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          bucket: string
          source: string
          generation_job_id: string | null
          width: number | null
          height: number | null
          size_bytes: number | null
          in_library: boolean
          sensitivity: string
          deleted_at: string | null
          content_id: string | null
          created_at: string
          created_by: string
          file_name: string
          id: string
          mime_type: string | null
          storage_path: string
        }
        Insert: {
          bucket?: string
          source?: string
          generation_job_id?: string | null
          width?: number | null
          height?: number | null
          size_bytes?: number | null
          in_library?: boolean
          sensitivity?: string
          deleted_at?: string | null
          content_id?: string | null
          created_at?: string
          created_by: string
          file_name: string
          id?: string
          mime_type?: string | null
          storage_path: string
        }
        Update: {
          bucket?: string
          source?: string
          generation_job_id?: string | null
          width?: number | null
          height?: number | null
          size_bytes?: number | null
          in_library?: boolean
          sensitivity?: string
          deleted_at?: string | null
          content_id?: string | null
          created_at?: string
          created_by?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          content_id: string | null
          type: string
          title: string
          message: string
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          recipient_id: string
          content_id?: string | null
          type: string
          title: string
          message: string
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          recipient_id?: string
          content_id?: string | null
          type?: string
          title?: string
          message?: string
          created_at?: string
          read_at?: string | null
        }
        Relationships: []
      }
      portal_destinations: {
        Row: {
          id: string
          label: string
          portal_collection: string
          portal_category: string
          enabled: boolean
          notes: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id: string
          label: string
          portal_collection: string
          portal_category: string
          enabled?: boolean
          notes?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          label?: string
          portal_collection?: string
          portal_category?: string
          enabled?: boolean
          notes?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_category_destinations: {
        Row: {
          category: string
          destination_id: string
          is_default: boolean
        }
        Insert: {
          category: string
          destination_id: string
          is_default?: boolean
        }
        Update: {
          category?: string
          destination_id?: string
          is_default?: boolean
        }
        Relationships: []
      }
      portal_integration_settings: {
        Row: {
          id: boolean
          api_enabled: boolean
          require_signature: boolean
          last_sync_at: string | null
          last_error_at: string | null
          last_error: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          api_enabled?: boolean
          require_signature?: boolean
          last_sync_at?: string | null
          last_error_at?: string | null
          last_error?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          api_enabled?: boolean
          require_signature?: boolean
          last_sync_at?: string | null
          last_error_at?: string | null
          last_error?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      integration_clients: {
        Row: {
          id: string
          name: string
          token_hash: string
          token_prefix: string
          scopes: string[]
          enabled: boolean
          last_used_at: string | null
          created_by: string | null
          created_at: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          name: string
          token_hash: string
          token_prefix: string
          scopes?: string[]
          enabled?: boolean
          last_used_at?: string | null
          created_by?: string | null
          created_at?: string
          revoked_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          token_hash?: string
          token_prefix?: string
          scopes?: string[]
          enabled?: boolean
          last_used_at?: string | null
          created_by?: string | null
          created_at?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      publication_events: {
        Row: {
          id: string
          publication_id: string
          content_id: string
          event: string
          from_status: string | null
          to_status: string | null
          actor_id: string | null
          client_id: string | null
          source: string
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          publication_id: string
          content_id: string
          event: string
          from_status?: string | null
          to_status?: string | null
          actor_id?: string | null
          client_id?: string | null
          source: string
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          publication_id?: string
          content_id?: string
          event?: string
          from_status?: string | null
          to_status?: string | null
          actor_id?: string | null
          client_id?: string | null
          source?: string
          details?: Json
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      publication_exports: {
        Row: {
          version_id: string | null
          destination: string | null
          status: string
          manifest: Json | null
          manifest_sha256: string | null
          image_sha256: string | null
          package_sha256: string | null
          image_path: string | null
          signed: boolean
          prepared_at: string | null
          exported_by: string | null
          exported_at: string | null
          received_at: string | null
          external_publication_id: string | null
          external_url: string | null
          published_channel: string | null
          published_at: string | null
          confirmed_by: string | null
          confirmation_source: string | null
          error_message: string | null
          supersedes_id: string | null
          superseded_by_id: string | null
          updated_at: string
          content_id: string
          created_at: string
          created_by: string
          format: string
          id: string
          storage_path: string | null
        }
        Insert: {
          version_id?: string | null
          destination?: string | null
          status?: string
          manifest?: Json | null
          manifest_sha256?: string | null
          image_sha256?: string | null
          package_sha256?: string | null
          image_path?: string | null
          signed?: boolean
          prepared_at?: string | null
          exported_by?: string | null
          exported_at?: string | null
          received_at?: string | null
          external_publication_id?: string | null
          external_url?: string | null
          published_channel?: string | null
          published_at?: string | null
          confirmed_by?: string | null
          confirmation_source?: string | null
          error_message?: string | null
          supersedes_id?: string | null
          superseded_by_id?: string | null
          updated_at?: string
          content_id: string
          created_at?: string
          created_by: string
          format: string
          id?: string
          storage_path?: string | null
        }
        Update: {
          version_id?: string | null
          destination?: string | null
          status?: string
          manifest?: Json | null
          manifest_sha256?: string | null
          image_sha256?: string | null
          package_sha256?: string | null
          image_path?: string | null
          signed?: boolean
          prepared_at?: string | null
          exported_by?: string | null
          exported_at?: string | null
          received_at?: string | null
          external_publication_id?: string | null
          external_url?: string | null
          published_channel?: string | null
          published_at?: string | null
          confirmed_by?: string | null
          confirmation_source?: string | null
          error_message?: string | null
          supersedes_id?: string | null
          superseded_by_id?: string | null
          updated_at?: string
          content_id?: string
          created_at?: string
          created_by?: string
          format?: string
          id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_exports_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_exports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string | null
          configuration: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          configuration?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          configuration?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      publication_latest: {
        Row: {
          id: string
          content_id: string
          format: string
          storage_path: string | null
          created_by: string
          created_at: string
          version_id: string | null
          destination: string | null
          status: string
          manifest: Json | null
          manifest_sha256: string | null
          image_sha256: string | null
          package_sha256: string | null
          image_path: string | null
          signed: boolean
          prepared_at: string | null
          exported_by: string | null
          exported_at: string | null
          received_at: string | null
          external_publication_id: string | null
          external_url: string | null
          published_channel: string | null
          published_at: string | null
          confirmed_by: string | null
          confirmation_source: string | null
          error_message: string | null
          supersedes_id: string | null
          superseded_by_id: string | null
          updated_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      duplicate_content: { Args: { source_id: string }; Returns: string }
      submit_content_for_review: {
        Args: { p_content_id: string; p_reviewer_id?: string | null; p_comment?: string | null; p_expected_working_updated_at?: string | null }
        Returns: string
      }
      decide_content_review: {
        Args: { p_content_id: string; p_version_id: string; p_decision: string; p_comment?: string | null }
        Returns: undefined
      }
      create_new_content_version: { Args: { p_content_id: string }; Returns: undefined }
      archive_content: { Args: { p_content_id: string; p_reason?: string | null }; Returns: undefined }
      claim_generation_finalize: {
        Args: { p_job_id: string; p_stale_seconds?: number }
        Returns: boolean
      }
      list_eligible_reviewers: {
        Args: { p_content_id: string }
        Returns: { id: string; full_name: string; email: string }[]
      }
      register_publication_package: {
        Args: { p_publication_id: string; p_actor: string; p_content_id: string; p_version_id: string; p_destination: string; p_manifest: Json; p_manifest_sha256: string; p_image_sha256: string; p_package_sha256: string; p_package_path: string; p_image_path: string; p_signed: boolean }
        Returns: string
      }
      transition_publication: {
        Args: { p_publication_id: string; p_action: string; p_channel?: string | null; p_published_at?: string | null; p_external_id?: string | null; p_external_url?: string | null; p_message?: string | null }
        Returns: string
      }
      portal_acknowledge_publication: {
        Args: { p_client_id: string; p_publication_id: string; p_content_id: string; p_version_id: string; p_status: string; p_external_id: string | null; p_external_url: string | null; p_published_at: string | null; p_message: string | null }
        Returns: { status: string; duplicate: boolean }[]
      }
      reserve_generation_job: {
        Args: {
          p_user_id: string
          p_content_id: string
          p_provider: string
          p_model: string
          p_prompt: string
          p_settings: Json
          p_image_count: number
          p_estimated_cost: number | null
          p_parent_job_id?: string | null
        }
        Returns: { job_id: string; used: number; quota: number }[]
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

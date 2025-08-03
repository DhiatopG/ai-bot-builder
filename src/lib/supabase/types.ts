export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      bot_knowledge_files: {
        Row: {
          bot_id: string | null
          content: string | null
          created_at: string | null
          file_name: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          bot_id?: string | null
          content?: string | null
          created_at?: string | null
          file_name?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          bot_id?: string | null
          content?: string | null
          created_at?: string | null
          file_name?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_knowledge_files_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          bot_name: string | null
          calendar_url: string | null
          created_at: string
          custom_qa: Json | null
          description: string | null
          document_url: string | null
          id: string
          logo_url: string | null
          nocodb_api_key: string | null
          nocodb_api_url: string | null
          nocodb_table: string | null
          qa: Json | null
          scraped_content: string | null
          tone: string | null
          urls: string | null
          user_id: string | null
        }
        Insert: {
          bot_name?: string | null
          calendar_url?: string | null
          created_at?: string
          custom_qa?: Json | null
          description?: string | null
          document_url?: string | null
          id?: string
          logo_url?: string | null
          nocodb_api_key?: string | null
          nocodb_api_url?: string | null
          nocodb_table?: string | null
          qa?: Json | null
          scraped_content?: string | null
          tone?: string | null
          urls?: string | null
          user_id?: string | null
        }
        Update: {
          bot_name?: string | null
          calendar_url?: string | null
          created_at?: string
          custom_qa?: Json | null
          description?: string | null
          document_url?: string | null
          id?: string
          logo_url?: string | null
          nocodb_api_key?: string | null
          nocodb_api_url?: string | null
          nocodb_table?: string | null
          qa?: Json | null
          scraped_content?: string | null
          tone?: string | null
          urls?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          bot_id: string
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          bot_id: string
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          bot_id?: string
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      chunks: {
        Row: {
          bot_id: string
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string
          index: number
          text: string
          tokens: number
        }
        Insert: {
          bot_id: string
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          index: number
          text: string
          tokens: number
        }
        Update: {
          bot_id?: string
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          index?: number
          text?: string
          tokens?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          answer: string | null
          bot_id: string | null
          created_at: string | null
          id: string
          lead_email: string | null
          lead_name: string | null
          question: string | null
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          bot_id?: string | null
          created_at?: string | null
          id?: string
          lead_email?: string | null
          lead_name?: string | null
          question?: string | null
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          bot_id?: string | null
          created_at?: string | null
          id?: string
          lead_email?: string | null
          lead_name?: string | null
          question?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      daily_summaries: {
        Row: {
          bot_id: string | null
          created_at: string | null
          date: string | null
          id: string
          summary: string | null
        }
        Insert: {
          bot_id?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          summary?: string | null
        }
        Update: {
          bot_id?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          summary?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          created_at: string | null
          event: string
          id: string
          secret_token: string | null
          user_id: string
          webhook_url: string
        }
        Insert: {
          created_at?: string | null
          event: string
          id?: string
          secret_token?: string | null
          user_id: string
          webhook_url: string
        }
        Update: {
          created_at?: string | null
          event?: string
          id?: string
          secret_token?: string | null
          user_id?: string
          webhook_url?: string
        }
        Relationships: []
      }
      integrations_airtable: {
        Row: {
          api_key: string
          base_id: string
          bot_id: string
          created_at: string
          id: string
          table_name: string
          user_id: string
        }
        Insert: {
          api_key: string
          base_id: string
          bot_id: string
          created_at?: string
          id?: string
          table_name: string
          user_id: string
        }
        Update: {
          api_key?: string
          base_id?: string
          bot_id?: string
          created_at?: string
          id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      integrations_make: {
        Row: {
          bot_id: string
          created_at: string | null
          id: string
          make_api_key: string | null
          user_id: string
          webhook_url: string
        }
        Insert: {
          bot_id: string
          created_at?: string | null
          id?: string
          make_api_key?: string | null
          user_id: string
          webhook_url: string
        }
        Update: {
          bot_id?: string
          created_at?: string | null
          id?: string
          make_api_key?: string | null
          user_id?: string
          webhook_url?: string
        }
        Relationships: []
      }
      integrations_zapier: {
        Row: {
          bot_id: string | null
          created_at: string | null
          id: string
          user_id: string | null
          webhook_url: string
        }
        Insert: {
          bot_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
          webhook_url: string
        }
        Update: {
          bot_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_zapier_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          bot_id: string | null
          created_at: string
          email: string | null
          id: string
          message: string | null
          name: string | null
          user_id: string | null
        }
        Insert: {
          bot_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          user_id?: string | null
        }
        Update: {
          bot_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_id: string | null
          email: string
          id: string
          name: string | null
          role: string | null
        }
        Insert: {
          auth_id?: string | null
          email: string
          id?: string
          name?: string | null
          role?: string | null
        }
        Update: {
          auth_id?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      delete_old_chat_messages: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      match_chunks: {
        Args: {
          query_embedding: string
          match_count: number
          input_bot_id: string
        }
        Returns: {
          id: string
          bot_id: string
          text: string
          content: string
          tokens: number
          index: number
          embedding: string
          created_at: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
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
    Enums: {},
  },
} as const
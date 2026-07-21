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
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      chat_members: {
        Row: {
          chat_id: string
          joined_at: string
          muted: boolean
          user_id: string
        }
        Insert: {
          chat_id: string
          joined_at?: string
          muted?: boolean
          user_id: string
        }
        Update: {
          chat_id?: string
          joined_at?: string
          muted?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          assigned_to: string | null
          avatar_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          disappearing_seconds: number | null
          encrypted: boolean
          id: string
          is_public: boolean
          kind: string
          pinned_message_id: string | null
          status: string | null
          store_id: string | null
          title: string | null
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          disappearing_seconds?: number | null
          encrypted?: boolean
          id?: string
          is_public?: boolean
          kind: string
          pinned_message_id?: string | null
          status?: string | null
          store_id?: string | null
          title?: string | null
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          disappearing_seconds?: number | null
          encrypted?: boolean
          id?: string
          is_public?: boolean
          kind?: string
          pinned_message_id?: string | null
          status?: string | null
          store_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_pinned_message_id_fkey"
            columns: ["pinned_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_keys: {
        Row: {
          chat_id: string
          created_at: string
          created_by: string
          key_epoch: number
          user_id: string
          wrapped: Json
        }
        Insert: {
          chat_id: string
          created_at?: string
          created_by?: string
          key_epoch?: number
          user_id: string
          wrapped: Json
        }
        Update: {
          chat_id?: string
          created_at?: string
          created_by?: string
          key_epoch?: number
          user_id?: string
          wrapped?: Json
        }
        Relationships: []
      }
      user_keys: {
        Row: {
          identity_pub: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          identity_pub: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          identity_pub?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      key_backups: {
        Row: {
          backup: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          backup: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          backup?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          contact_id: string
          created_at: string
          owner_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          owner_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          owner_id?: string
        }
        Relationships: []
      }
      customer_chat_sessions: {
        Row: {
          chat_id: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          last_seen_at: string | null
          public_token: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          last_seen_at?: string | null
          public_token: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          last_seen_at?: string | null
          public_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_chat_sessions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_chat_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          name: string | null
          phone: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          phone?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string
          device_label: string
          id: string
          identity_public_key: string
          registration_id: number
          signed_prekey_id: number
          signed_prekey_public: string
          signed_prekey_signature: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label: string
          id?: string
          identity_public_key: string
          registration_id: number
          signed_prekey_id: number
          signed_prekey_public: string
          signed_prekey_signature: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string
          id?: string
          identity_public_key?: string
          registration_id?: number
          signed_prekey_id?: number
          signed_prekey_public?: string
          signed_prekey_signature?: string
          user_id?: string
        }
        Relationships: []
      }
      hidden_messages: {
        Row: {
          chat_id: string
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          chat_id: string
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          ciphertext: string
          content: string | null
          created_at: string
          delivery_status: string | null
          edited_at: string | null
          expires_at: string | null
          id: string
          message_type: string
          nonce: string
          read: boolean | null
          sender_device_id: string | null
          sender_id: string | null
          sender_type: string | null
        }
        Insert: {
          chat_id: string
          ciphertext: string
          content?: string | null
          created_at?: string
          delivery_status?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          message_type: string
          nonce?: string
          read?: boolean | null
          sender_device_id?: string | null
          sender_id?: string | null
          sender_type?: string | null
        }
        Update: {
          chat_id?: string
          ciphertext?: string
          content?: string | null
          created_at?: string
          delivery_status?: string | null
          edited_at?: string | null
          expires_at?: string | null
          id?: string
          message_type?: string
          nonce?: string
          read?: boolean | null
          sender_device_id?: string | null
          sender_id?: string | null
          sender_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_device_id_fkey"
            columns: ["sender_device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          chat_id: string | null
          created_at: string
          currency: string
          id: string
          provider: string | null
          provider_ref: string | null
          recipient_id: string | null
          sender_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          chat_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          provider?: string | null
          provider_ref?: string | null
          recipient_id?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          chat_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          provider?: string | null
          provider_ref?: string | null
          recipient_id?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          chat_id: string
          created_at: string
          message_id: string
          option_index: number
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          message_id: string
          option_index: number
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          message_id?: string
          option_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_seen: string | null
          role: string | null
          show_online: boolean
          store_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          last_seen?: string | null
          role?: string | null
          show_online?: boolean
          store_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_seen?: string | null
          role?: string | null
          show_online?: boolean
          store_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          answered: boolean
          caller_id: string
          chat_id: string | null
          ended_at: string | null
          id: string
          is_group: boolean
          is_video: boolean
          peer_id: string | null
          started_at: string
        }
        Insert: {
          answered?: boolean
          caller_id: string
          chat_id?: string | null
          ended_at?: string | null
          id?: string
          is_group?: boolean
          is_video?: boolean
          peer_id?: string | null
          started_at?: string
        }
        Update: {
          answered?: boolean
          caller_id?: string
          chat_id?: string | null
          ended_at?: string | null
          id?: string
          is_group?: boolean
          is_video?: boolean
          peer_id?: string | null
          started_at?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          chat_id: string | null
          created_at: string
          details: string | null
          id: string
          message_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          background: string | null
          created_at: string
          expires_at: string
          id: string
          media_path: string | null
          text_content: string | null
          user_id: string
        }
        Insert: {
          background?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_path?: string | null
          text_content?: string | null
          user_id: string
        }
        Update: {
          background?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_path?: string | null
          text_content?: string | null
          user_id?: string
        }
        Relationships: []
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean | null
          country: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          country: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          country?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_direct_chat: { Args: { other_user: string }; Returns: string }
      create_channel: {
        Args: { p_title: string; p_description?: string }
        Returns: string
      }
      create_group_chat: {
        Args: { member_ids: string[]; title: string }
        Returns: string
      }
      is_blocked: { Args: { p_a: string; p_b: string }; Returns: boolean }
      is_chat_member: {
        Args: { p_chat_id: string; p_user_id: string }
        Returns: boolean
      }
      is_store_staff_for_chat: { Args: { p_chat_id: string }; Returns: boolean }
      remove_group_member: {
        Args: { p_chat_id: string; p_member_id: string }
        Returns: undefined
      }
      rename_group_chat: {
        Args: { p_chat_id: string; p_title: string }
        Returns: undefined
      }
      set_chat_muted: {
        Args: { p_chat_id: string; p_muted: boolean }
        Returns: undefined
      }
      set_disappearing_messages: {
        Args: { p_chat_id: string; p_seconds: number }
        Returns: undefined
      }
      touch_last_seen: { Args: never; Returns: undefined }
      update_group_info: {
        Args: { p_chat_id: string; p_description: string; p_title: string }
        Returns: undefined
      }
      username_available: { Args: { candidate: string }; Returns: boolean }
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

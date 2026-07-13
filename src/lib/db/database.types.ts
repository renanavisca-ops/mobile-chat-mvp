export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.1'
  }
  public: {
    Tables: {
      blocks: {
        Row: { blocked_id: string; blocker_id: string; created_at: string }
        Insert: { blocked_id: string; blocker_id: string; created_at?: string }
        Update: { blocked_id?: string; blocker_id?: string; created_at?: string }
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
        Relationships: []
      }
      attachments: {
        Row: {
          cipher_blob_path: string
          created_at: string
          file_size_bytes: number
          id: string
          media_type: string
          message_id: string
        }
        Insert: {
          cipher_blob_path: string
          created_at?: string
          file_size_bytes: number
          id?: string
          media_type: string
          message_id: string
        }
        Update: {
          cipher_blob_path?: string
          created_at?: string
          file_size_bytes?: number
          id?: string
          media_type?: string
          message_id?: string
        }
        Relationships: []
      }
      chat_members: {
        Row: {
          chat_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          pinned_message_id: string | null
          status: string | null
          store_id: string | null
          title: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          pinned_message_id?: string | null
          status?: string | null
          store_id?: string | null
          title?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          pinned_message_id?: string | null
          status?: string | null
          store_id?: string | null
          title?: string | null
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
        Relationships: []
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
      messages: {
        Row: {
          chat_id: string
          ciphertext: string
          content: string | null
          created_at: string
          delivery_status: string | null
          edited_at: string | null
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
          id?: string
          message_type?: string
          nonce?: string
          read?: boolean | null
          sender_device_id?: string | null
          sender_id?: string | null
          sender_type?: string | null
        }
        Relationships: []
      }
      prekeys: {
        Row: {
          consumed_at: string | null
          created_at: string
          device_id: string
          id: number
          prekey_id: number
          public_key: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          device_id: string
          id?: number
          prekey_id: number
          public_key: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          device_id?: string
          id?: number
          prekey_id?: number
          public_key?: string
        }
        Relationships: []
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
        Relationships: []
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
      create_group_chat: {
        Args: { member_ids: string[]; title: string }
        Returns: string
      }
      is_blocked: {
        Args: { p_a: string; p_b: string }
        Returns: boolean
      }
      is_chat_member: {
        Args: { p_chat_id: string; p_user_id: string }
        Returns: boolean
      }
      is_store_staff_for_chat: { Args: { p_chat_id: string }; Returns: boolean }
      touch_last_seen: { Args: Record<string, never>; Returns: undefined }
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

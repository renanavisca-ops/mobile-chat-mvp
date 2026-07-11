export type ChatSummary = {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  created_at: string;
  last_message_at: string | null;
  last_ciphertext: string | null;
  store_id?: string | null;
  assigned_to?: string | null;
  status?: 'open' | 'in_progress' | 'closed';
  /** For direct chats: the other participant's user id (for online status). */
  other_user_id?: string | null;
  /** All member user ids (excluding me). */
  member_ids?: string[];
};

export type ProfileLite = {
  id: string;
  username: string | null;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_device_id?: string | null;
  ciphertext?: string | null;
  nonce?: string | null;
  message_type: 'prekey' | 'whisper' | 'system';
  created_at: string;
  read?: boolean;
  content?: string | null;
  sender_type?: 'agent' | 'customer' | 'system';
  sender_id?: string | null;
  delivery_status?: 'sent' | 'delivered' | 'read' | 'failed';
};

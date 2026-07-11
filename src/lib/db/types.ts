export type ChatSummary = {
  id: string;
  kind: 'direct' | 'group' | 'customer';
  title: string | null;
  created_at: string;
  last_message_at: string | null;
  last_ciphertext: string | null;
  store_id?: string | null;
  assigned_to?: string | null;
  status?: 'open' | 'in_progress' | 'closed';
};

export type ProfileLite = {
  id: string;
  username: string | null;
  email?: string | null;
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

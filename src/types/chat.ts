export type StoreRow = {
  id: string;
  name: string;
  country: 'GT' | 'CR';
  active: boolean;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  username: string | null;
  store_id: string | null;
  role: 'agent' | 'admin' | 'superadmin';
  created_at: string;
};

export type ChatRow = {
  id: string;
  kind: 'direct' | 'group';
  created_by: string | null;
  title: string | null;
  store_id: string | null;
  assigned_to: string | null;
  status: 'open' | 'in_progress' | 'closed' | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_device_id?: string | null;
  ciphertext: string;
  nonce: string;
  message_type: 'prekey' | 'whisper' | 'system';
  read?: boolean | null;
  sender_type?: 'agent' | 'customer' | 'system' | null;
  sender_id?: string | null;
  delivery_status?: 'sent' | 'delivered' | 'read' | 'failed' | null;
  content?: string | null;
  created_at: string;
};

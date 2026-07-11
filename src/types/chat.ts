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
  last_seen: string | null;
  show_online: boolean;
  created_at: string;
};

export type ChatRow = {
  id: string;
  kind: 'direct' | 'group';
  created_by: string;
  title: string | null;
  store_id: string | null;
  assigned_to: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_device_id: string;
  ciphertext: string;
  nonce: string;
  message_type: 'prekey' | 'whisper';
  read: boolean;
  created_at: string;
};


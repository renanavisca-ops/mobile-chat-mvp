export type ChatSummary = {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  created_at: string;
  last_message_at: string | null;
  last_ciphertext: string | null;
};

export type ProfileLite = {
  id: string;
  username: string | null;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_device_id: string;
  ciphertext: string;
  nonce: string;
  message_type: 'prekey' | 'whisper';
  created_at: string;
};

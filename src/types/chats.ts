export type MessageRow = {
  id: string;
  chat_id: string;
  sender_device_id: string;
  ciphertext: string;
  nonce: string;
  message_type: 'prekey' | 'whisper';
  created_at: string;
};

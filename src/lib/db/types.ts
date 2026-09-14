export type ChatSummary = {
  id: string;
  kind: 'direct' | 'group' | 'channel';
  title: string | null;
  is_public?: boolean;
  created_at: string;
  last_message_at: string | null;
  last_ciphertext: string | null;
  last_message_kind?: 'text' | 'photo' | 'video' | 'audio' | 'gif' | 'poll' | 'file' | 'deleted' | null;
  store_id?: string | null;
  assigned_to?: string | null;
  status?: 'open' | 'in_progress' | 'closed';
  pinned_message_id?: string | null;
  created_by?: string | null;
  avatar_url?: string | null;
  description?: string | null;
  /** For direct chats: the other participant's user id (for online status). */
  other_user_id?: string | null;
  /** For direct chats: the other participant's avatar URL. */
  other_user_avatar?: string | null;
  /** All member user ids (excluding me). */
  member_ids?: string[];
  /** Disappearing-messages timer for this chat, in seconds (null/0 = off). */
  disappearing_seconds?: number | null;
  /** Whether this chat is end-to-end encrypted (opt-in). */
  encrypted?: boolean | null;
  /** Whether the current user has archived this chat. */
  archived?: boolean;
  /** Count of incoming messages I haven't read yet in this chat. */
  unread_count?: number;
};

export type ProfileLite = {
  id: string;
  username: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_device_id?: string | null;
  ciphertext?: string | null;
  nonce?: string | null;
  message_type: 'prekey' | 'whisper' | 'system' | 'poll';
  created_at: string;
  read?: boolean;
  content?: string | null;
  sender_type?: 'agent' | 'customer' | 'system';
  sender_id?: string | null;
  delivery_status?: 'sent' | 'delivered' | 'read' | 'failed';
  edited_at?: string | null;
  expires_at?: string | null;
};

export type MessageReaction = {
  id: string;
  message_id: string;
  chat_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type PollVote = {
  message_id: string;
  chat_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
};

export type HiddenMessage = {
  user_id: string;
  message_id: string;
  chat_id: string;
  created_at: string;
};

export type Story = {
  id: string;
  user_id: string;
  media_path: string | null;
  text_content: string | null;
  background: string | null;
  created_at: string;
  expires_at: string;
  /** Whether the current viewer has already seen this story. */
  seen?: boolean;
};

/** A user's stories grouped for the rings strip. */
export type StoryGroup = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  stories: Story[];
  allViewed: boolean;
  isMe: boolean;
};

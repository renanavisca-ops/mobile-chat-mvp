import { ChatConversation } from '@/components/chat-conversation';

// Full-page route (single-pane) used on phones and when opening a chat
// directly. The wide-screen two-pane view (/chats) renders <ChatConversation>
// inline instead.
export default function ChatPage({ params }: { params: { chatId: string } }) {
  // key forces a fresh mount per chat so no state/cache/subscription leaks across
  // chats (see /chats/view and the wide-screen pane, which key the same way).
  return <ChatConversation key={params.chatId} chatId={params.chatId} />;
}

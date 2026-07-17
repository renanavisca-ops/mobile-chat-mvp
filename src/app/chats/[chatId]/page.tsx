import { ChatConversation } from '@/components/chat-conversation';

// Full-page route (single-pane) used on phones and when opening a chat
// directly. The wide-screen two-pane view (/chats) renders <ChatConversation>
// inline instead.
export default function ChatPage({ params }: { params: { chatId: string } }) {
  return <ChatConversation chatId={params.chatId} />;
}

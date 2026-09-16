'use client';

// Web/browser route for shared public-chat links (e.g. /public-chat/<token>).
// Kept so existing browser links and refresh keep working on the hosted site.
// Excluded from the static mobile export (dynamic segment); the bundled app
// uses the query-param route /public-chat?token=<token> instead.
import { PublicChatView } from '@/components/public-chat-view';

export default function PublicChatTokenPage({ params }: { params: { token: string } }) {
  return <PublicChatView token={params.token} />;
}

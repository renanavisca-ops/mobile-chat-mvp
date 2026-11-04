/**
 * Derive a message's content kind from a stored row. The real kind of a
 * message is not a queryable column — regular chats store a JSON envelope in
 * `ciphertext` (plaintext JSON for non-E2EE chats; opaque for E2EE), while the
 * `content` column holds plain text when present. This mirrors the derivation
 * the chat list uses for its last-message preview, extracted so global search
 * can filter results by type without duplicating the logic.
 */

export type MsgKind =
  | 'text'
  | 'photo'
  | 'video'
  | 'audio'
  | 'gif'
  | 'sticker'
  | 'poll'
  | 'file'
  | 'call'
  | 'contact'
  | 'location'
  | 'event'
  | 'deleted'
  | null;

/** Categories offered to the user as search filters (a coarser grouping). */
export type SearchKind = 'photo' | 'video' | 'audio' | 'file' | 'link' | 'location';

const URL_RE = /https?:\/\/|www\./i;

export function messageKind(row: { content?: string | null; ciphertext?: string | null }): MsgKind {
  const content = row.content || '';
  if (content) return 'text';
  if (!row.ciphertext) return null;
  try {
    const parsed = JSON.parse(row.ciphertext);
    if (parsed.e === 1) return 'text'; // encrypted envelope — opaque
    if (parsed.text) return 'text';
    if (parsed.imagePath || (parsed.imagePaths?.length ?? 0) > 0) return 'photo';
    if (parsed.videoPath) return 'video';
    if (parsed.audioPath) return 'audio';
    if (parsed.gifUrl) return 'gif';
    if (parsed.stickerUrl) return 'sticker';
    if (parsed.filePath) return 'file';
    if (parsed.poll) return 'poll';
    if (parsed.call) return 'call';
    if (parsed.contact) return 'contact';
    if (parsed.location) return 'location';
    if (parsed.event) return 'event';
    if (parsed.is_deleted) return 'deleted';
  } catch {
    /* not JSON — treat as unknown */
  }
  return null;
}

/** The plain text of a message (content column, or the text field of a
 *  non-E2EE envelope), for link detection. */
export function messageText(row: { content?: string | null; ciphertext?: string | null }): string {
  if (row.content) return row.content;
  if (!row.ciphertext) return '';
  try {
    const parsed = JSON.parse(row.ciphertext);
    if (parsed.e === 1) return '';
    return typeof parsed.text === 'string' ? parsed.text : '';
  } catch {
    return '';
  }
}

/** Whether a row matches one of the coarse search categories. */
export function matchesSearchKind(row: { content?: string | null; ciphertext?: string | null }, kind: SearchKind): boolean {
  if (kind === 'link') {
    const k = messageKind(row);
    return k === 'text' && URL_RE.test(messageText(row));
  }
  if (kind === 'file') {
    const k = messageKind(row);
    return k === 'file';
  }
  return messageKind(row) === kind;
}

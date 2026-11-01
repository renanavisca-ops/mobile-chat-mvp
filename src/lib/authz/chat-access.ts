// Authorization rules for modifying a SUPPORT (store) chat's status/assignment.
// Extracted as pure functions so the access boundary is unit-tested and cannot
// silently regress (see #187: a null-store match once let any user touch
// non-support chats they didn't belong to).

export type ChatAccessParams = {
  userId: string;
  /** The caller's role: 'superadmin' | 'admin' | 'agent' | anything else. */
  role: string | null;
  /** The caller's store, or null. All regular users default to a null store. */
  userStoreId: string | null;
  /** The chat's store. null means it is NOT a support chat. */
  chatStoreId: string | null;
  /** The chat's current assignee, or null when unassigned. */
  chatAssignedTo: string | null;
};

/**
 * Who may change a support chat's status/assignment:
 *  - only support chats (chatStoreId != null) are eligible;
 *  - superadmin always;
 *  - admin/agent only within their OWN non-null store;
 *  - agent additionally only if the chat is unassigned or already theirs.
 */
export function canModifySupportChat(p: ChatAccessParams): boolean {
  if (!p.chatStoreId) return false; // not a support chat — never here
  if (p.role === 'superadmin') return true;
  if (!p.userStoreId || p.userStoreId !== p.chatStoreId) return false; // other/no store
  if (p.role === 'admin') return true;
  if (p.role === 'agent') return p.chatAssignedTo === p.userId || p.chatAssignedTo == null;
  return false;
}

/** Whether a user may be ASSIGNED a support chat (must be staff of its store). */
export function canBeAssigned(
  targetRole: string | null,
  targetStoreId: string | null,
  chatStoreId: string | null,
): boolean {
  if (!chatStoreId) return false;
  return targetStoreId === chatStoreId && ['agent', 'admin', 'superadmin'].includes(targetRole || '');
}

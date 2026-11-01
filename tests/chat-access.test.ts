import { describe, it, expect } from 'vitest';
import { canModifySupportChat, canBeAssigned } from '../src/lib/authz/chat-access';

const base = {
  userId: 'u1',
  role: 'agent' as string | null,
  userStoreId: 'storeA' as string | null,
  chatStoreId: 'storeA' as string | null,
  chatAssignedTo: null as string | null,
};

describe('canModifySupportChat', () => {
  it('REGRESSION #187: a regular user (agent, no store) cannot touch a non-support chat', () => {
    // All regular accounts default to role 'agent' with a null store. A
    // non-support chat has a null store too — this must NOT be allowed.
    expect(canModifySupportChat({ userId: 'u1', role: 'agent', userStoreId: null, chatStoreId: null, chatAssignedTo: null })).toBe(false);
  });

  it('rejects any non-support chat, even for a store admin/superadmin', () => {
    expect(canModifySupportChat({ ...base, role: 'admin', chatStoreId: null })).toBe(false);
    expect(canModifySupportChat({ ...base, role: 'superadmin', chatStoreId: null })).toBe(false);
  });

  it('allows superadmin on any support chat', () => {
    expect(canModifySupportChat({ ...base, role: 'superadmin', userStoreId: null, chatStoreId: 'storeA' })).toBe(true);
    expect(canModifySupportChat({ ...base, role: 'superadmin', userStoreId: 'storeX', chatStoreId: 'storeB' })).toBe(true);
  });

  it('allows an admin only within their OWN store (account separation)', () => {
    expect(canModifySupportChat({ ...base, role: 'admin' })).toBe(true);
    expect(canModifySupportChat({ ...base, role: 'admin', userStoreId: 'storeB' })).toBe(false); // other store
    expect(canModifySupportChat({ ...base, role: 'admin', userStoreId: null })).toBe(false);      // no store
  });

  it('allows an agent in their store only if unassigned or already theirs', () => {
    expect(canModifySupportChat({ ...base, role: 'agent', chatAssignedTo: null })).toBe(true);     // unassigned → can take
    expect(canModifySupportChat({ ...base, role: 'agent', chatAssignedTo: 'u1' })).toBe(true);      // theirs
    expect(canModifySupportChat({ ...base, role: 'agent', chatAssignedTo: 'other' })).toBe(false);  // someone else's
    expect(canModifySupportChat({ ...base, role: 'agent', userStoreId: 'storeB' })).toBe(false);    // other store
  });

  it('rejects unknown/empty roles', () => {
    expect(canModifySupportChat({ ...base, role: null })).toBe(false);
    expect(canModifySupportChat({ ...base, role: 'customer' })).toBe(false);
  });
});

describe('canBeAssigned', () => {
  it('allows staff of the chat store', () => {
    expect(canBeAssigned('agent', 'storeA', 'storeA')).toBe(true);
    expect(canBeAssigned('admin', 'storeA', 'storeA')).toBe(true);
    expect(canBeAssigned('superadmin', 'storeA', 'storeA')).toBe(true);
  });

  it('rejects a user of a different store (account separation)', () => {
    expect(canBeAssigned('agent', 'storeB', 'storeA')).toBe(false);
    expect(canBeAssigned('agent', null, 'storeA')).toBe(false);
  });

  it('rejects non-staff roles and non-support chats', () => {
    expect(canBeAssigned('customer', 'storeA', 'storeA')).toBe(false);
    expect(canBeAssigned('agent', 'storeA', null)).toBe(false);
  });
});

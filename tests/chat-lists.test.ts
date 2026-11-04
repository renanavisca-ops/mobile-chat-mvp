import { describe, it, expect } from 'vitest';
import { upsertList, removeList, toggleChatInList, normalizeListName, type ChatList } from '../src/lib/chat-lists';

const mk = (id: string, chatIds: string[] = []): ChatList => ({ id, name: id, chatIds, createdAt: 1 });

describe('upsertList', () => {
  it('appends a new list', () => {
    const out = upsertList([mk('a')], mk('b'));
    expect(out.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('replaces an existing list by id without reordering', () => {
    const out = upsertList([mk('a'), mk('b')], { ...mk('a'), name: 'renamed' });
    expect(out.map((l) => l.id)).toEqual(['a', 'b']);
    expect(out[0].name).toBe('renamed');
  });
});

describe('removeList', () => {
  it('drops the matching id and leaves others', () => {
    expect(removeList([mk('a'), mk('b')], 'a').map((l) => l.id)).toEqual(['b']);
  });
  it('is a no-op for an unknown id', () => {
    expect(removeList([mk('a')], 'x').map((l) => l.id)).toEqual(['a']);
  });
});

describe('toggleChatInList', () => {
  it('adds a chat when absent', () => {
    expect(toggleChatInList(mk('a', ['c1']), 'c2').chatIds).toEqual(['c1', 'c2']);
  });
  it('removes a chat when present', () => {
    expect(toggleChatInList(mk('a', ['c1', 'c2']), 'c1').chatIds).toEqual(['c2']);
  });
  it('does not mutate the input list', () => {
    const input = mk('a', ['c1']);
    toggleChatInList(input, 'c2');
    expect(input.chatIds).toEqual(['c1']);
  });
});

describe('normalizeListName', () => {
  it('trims and caps length', () => {
    expect(normalizeListName('  Trabajo  ')).toBe('Trabajo');
    expect(normalizeListName('x'.repeat(60)).length).toBe(40);
  });
  it('falls back when empty', () => {
    expect(normalizeListName('   ')).toBe('Lista');
  });
});

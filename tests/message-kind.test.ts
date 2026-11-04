import { describe, it, expect } from 'vitest';
import { messageKind, messageText, matchesSearchKind } from '../src/lib/messages/kind';

const env = (obj: unknown) => ({ content: null, ciphertext: JSON.stringify(obj) });

describe('messageKind', () => {
  it('returns text when the content column is set', () => {
    expect(messageKind({ content: 'hola', ciphertext: null })).toBe('text');
  });
  it('treats an encrypted envelope as opaque text', () => {
    expect(messageKind(env({ e: 1 }))).toBe('text');
  });
  it('maps media envelopes to their kind', () => {
    expect(messageKind(env({ imagePath: 'x' }))).toBe('photo');
    expect(messageKind(env({ imagePaths: ['a', 'b'] }))).toBe('photo');
    expect(messageKind(env({ videoPath: 'x' }))).toBe('video');
    expect(messageKind(env({ audioPath: 'x' }))).toBe('audio');
    expect(messageKind(env({ filePath: 'x' }))).toBe('file');
    expect(messageKind(env({ gifUrl: 'x' }))).toBe('gif');
    expect(messageKind(env({ location: { lat: 1, lng: 2 } }))).toBe('location');
    expect(messageKind(env({ poll: {} }))).toBe('poll');
  });
  it('returns null for empty or unparseable rows', () => {
    expect(messageKind({ content: null, ciphertext: null })).toBeNull();
    expect(messageKind({ content: null, ciphertext: 'not json' })).toBeNull();
    expect(messageKind(env({}))).toBeNull();
  });
});

describe('messageText', () => {
  it('prefers the content column then the envelope text', () => {
    expect(messageText({ content: 'hi', ciphertext: null })).toBe('hi');
    expect(messageText(env({ text: 'inside' }))).toBe('inside');
    expect(messageText(env({ e: 1 }))).toBe('');
  });
});

describe('matchesSearchKind', () => {
  it('matches photo/video/audio/file/location by derived kind', () => {
    expect(matchesSearchKind(env({ imagePath: 'x' }), 'photo')).toBe(true);
    expect(matchesSearchKind(env({ videoPath: 'x' }), 'photo')).toBe(false);
    expect(matchesSearchKind(env({ filePath: 'x' }), 'file')).toBe(true);
    expect(matchesSearchKind(env({ location: {} }), 'location')).toBe(true);
  });
  it('matches links as text messages containing a URL', () => {
    expect(matchesSearchKind({ content: 'see https://toky.app', ciphertext: null }, 'link')).toBe(true);
    expect(matchesSearchKind({ content: 'visit www.toky.app', ciphertext: null }, 'link')).toBe(true);
    expect(matchesSearchKind({ content: 'just text', ciphertext: null }, 'link')).toBe(false);
    expect(matchesSearchKind(env({ imagePath: 'x' }), 'link')).toBe(false);
  });
});

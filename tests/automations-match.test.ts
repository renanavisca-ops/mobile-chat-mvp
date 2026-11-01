import { describe, it, expect } from 'vitest';
import { ruleMatches, matchingRules } from '../src/lib/automations/match';

describe('ruleMatches', () => {
  it('matches "contains" case-insensitively by default', () => {
    expect(ruleMatches('What is the PRICE?', { matchType: 'contains', keywords: ['price'], caseSensitive: false })).toBe(true);
    expect(ruleMatches('hello there', { matchType: 'contains', keywords: ['price'], caseSensitive: false })).toBe(false);
  });

  it('respects case sensitivity', () => {
    expect(ruleMatches('PRICE', { matchType: 'contains', keywords: ['price'], caseSensitive: true })).toBe(false);
    expect(ruleMatches('price', { matchType: 'contains', keywords: ['price'], caseSensitive: true })).toBe(true);
  });

  it('matches "equals" only on the whole trimmed text', () => {
    expect(ruleMatches('  hi  ', { matchType: 'equals', keywords: ['hi'], caseSensitive: false })).toBe(true);
    expect(ruleMatches('hi there', { matchType: 'equals', keywords: ['hi'], caseSensitive: false })).toBe(false);
  });

  it('matches "starts_with"', () => {
    expect(ruleMatches('stop please', { matchType: 'starts_with', keywords: ['stop'], caseSensitive: false })).toBe(true);
    expect(ruleMatches('please stop', { matchType: 'starts_with', keywords: ['stop'], caseSensitive: false })).toBe(false);
  });

  it('matches when ANY keyword matches, ignoring blanks', () => {
    expect(ruleMatches('I need help', { matchType: 'contains', keywords: ['  ', 'help'], caseSensitive: false })).toBe(true);
  });

  it('never matches empty text or empty keyword set', () => {
    expect(ruleMatches('', { matchType: 'contains', keywords: ['x'], caseSensitive: false })).toBe(false);
    expect(ruleMatches('x', { matchType: 'contains', keywords: [], caseSensitive: false })).toBe(false);
  });
});

describe('matchingRules', () => {
  const rules = [
    { id: 'a', enabled: true, matchType: 'contains' as const, keywords: ['price'], caseSensitive: false },
    { id: 'b', enabled: false, matchType: 'contains' as const, keywords: ['price'], caseSensitive: false },
    { id: 'c', enabled: true, matchType: 'contains' as const, keywords: ['hours'], caseSensitive: false },
  ];

  it('returns only enabled rules that match', () => {
    const got = matchingRules('what is the price', rules).map((r) => r.id);
    expect(got).toEqual(['a']); // 'b' disabled, 'c' no match
  });

  it('returns nothing for blank text', () => {
    expect(matchingRules('   ', rules)).toEqual([]);
  });
});

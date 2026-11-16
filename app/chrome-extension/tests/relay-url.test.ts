import { describe, expect, it } from 'vitest';
import { normalizeRelayUrl } from '@/entrypoints/popup/normalizeRelayUrl';

describe('normalizeRelayUrl', () => {
  it.each([
    ['browser.example.com', 'wss://browser.example.com/ws'],
    ['browser.example.com/', 'wss://browser.example.com/ws'],
    ['https://browser.example.com', 'wss://browser.example.com/ws'],
    ['https://browser.example.com/ws', 'wss://browser.example.com/ws'],
    ['http://localhost:8080', 'ws://localhost:8080/ws'],
    ['http://127.0.0.1:18081/', 'ws://127.0.0.1:18081/ws'],
    ['ws://127.0.0.1:8080', 'ws://127.0.0.1:8080/ws'],
    ['wss://relay.example.com/ws', 'wss://relay.example.com/ws'],
    ['  relay.example.com  ', 'wss://relay.example.com/ws'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeRelayUrl(input)).toBe(expected);
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeRelayUrl('')).toBe('');
    expect(normalizeRelayUrl('   ')).toBe('');
  });

  it('does not double-append the websocket path', () => {
    const once = normalizeRelayUrl('wss://relay.example.com/ws');
    expect(normalizeRelayUrl(once)).toBe(once);
  });
});

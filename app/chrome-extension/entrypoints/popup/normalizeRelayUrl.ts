/**
 * Normalize whatever the user typed into the relay WebSocket endpoint.
 *
 * Accepted:
 * - host[:port]        -> wss://host[:port]/ws   (hostname without scheme is remote)
 * - http://host[:port] -> ws://host[:port]/ws
 * - https://host       -> wss://host/ws
 * - ws:// / wss://     -> kept, "/ws" appended when missing
 */
export function normalizeRelayUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '';

  let url = raw;
  let scheme = '';

  const match = /^([a-z][a-z0-9+.-]*):\/\//i.exec(url);
  if (match) {
    scheme = match[1].toLowerCase();
    url = url.slice(match[0].length);
  }

  url = url.replace(/\/+$/, '');

  if (!scheme) {
    scheme = 'wss';
  } else if (scheme === 'http') {
    scheme = 'ws';
  } else if (scheme === 'https') {
    scheme = 'wss';
  }

  if (!url.endsWith('/ws')) {
    url = `${url}/ws`;
  }

  return `${scheme}://${url}`;
}

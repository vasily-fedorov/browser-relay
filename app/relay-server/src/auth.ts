import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_TOKENS_FILE = 'tokens.json';

interface TokenEntry {
  login: string;
  token: string;
}

const tokensMap = new Map<string, string>();

export function loadTokens(filePath?: string): void {
  try {
    const path = resolve(filePath || process.env.AUTH_TOKENS_FILE || DEFAULT_TOKENS_FILE);
    if (!existsSync(path)) {
      console.warn(`Tokens file not found: ${path}. Starting with empty token list.`);
      return;
    }
    const raw = readFileSync(path, 'utf-8');
    const entries: TokenEntry[] = JSON.parse(raw);
    if (!Array.isArray(entries)) {
      throw new Error('Tokens file must contain a JSON array');
    }
    tokensMap.clear();
    for (const entry of entries) {
      if (entry.token && entry.login) {
        tokensMap.set(entry.token, entry.login);
      }
    }
    console.log(`Loaded ${tokensMap.size} tokens from ${path}`);
  } catch (error) {
    console.error('Failed to load tokens:', error);
  }
}

export function validateToken(token: string): { valid: boolean; login?: string } {
  if (tokensMap.size === 0) {
    if (token && token.length > 0) {
      return { valid: true, login: token.substring(0, 8) };
    }
    return { valid: false };
  }
  const login = tokensMap.get(token);
  if (login) {
    return { valid: true, login };
  }
  return { valid: false };
}

export function addToken(login: string, token: string): void {
  tokensMap.set(token, login);
}

export function getTokenCount(): number {
  return tokensMap.size;
}

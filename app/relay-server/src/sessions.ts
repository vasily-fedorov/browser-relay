import type { WebSocket } from 'ws';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

interface PendingEntry {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface Session {
  token: string;
  login: string;
  ws: WebSocket;
  mcpServer: Server | null;
  mcpTransport: StreamableHTTPServerTransport | null;
  connectedAt: number;
  pending: Map<string, PendingEntry>;
}

const sessions = new Map<string, Session>();

export function addSession(session: Session): void {
  sessions.set(session.token, session);
}

export function removeSession(token: string): Session | undefined {
  const session = sessions.get(token);
  if (session) {
    sessions.delete(token);
  }
  return session;
}

export function getSession(token: string): Session | undefined {
  return sessions.get(token);
}

export function getSessionByLogin(login: string): Session | undefined {
  for (const session of sessions.values()) {
    if (session.login === login) {
      return session;
    }
  }
  return undefined;
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values());
}

export function getSessionCount(): number {
  return sessions.size;
}

export function getFirstSession(): Session | undefined {
  return sessions.values().next().value;
}

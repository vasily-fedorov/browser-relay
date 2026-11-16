import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { RelayMessageType } from 'browser-relay-shared';
import { validateToken } from './auth.js';
import { addSession, removeSession, getSession } from './sessions.js';
import { resolvePendingRequest } from './mcp-manager.js';
import type { Session } from './sessions.js';

export function createWsServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let session: Session | null = null;
    let authTimeout: ReturnType<typeof setTimeout> | null = null;

    function cleanup(s: Session): void {
      if (s.mcpTransport) {
        try {
          s.mcpTransport.close().catch(() => {});
        } catch {}
      }
      if (s.mcpServer) {
        try {
          s.mcpServer.close().catch(() => {});
        } catch {}
      }
      s.pending.forEach((pending) => {
        clearTimeout(pending.timer);
        pending.reject(new Error('Session disconnected'));
      });
      s.pending.clear();
      removeSession(s.token);
      console.log(`Session cleaned up: login=${s.login}`);
    }

    function handleAuth(ws: WebSocket, message: any): void {
      const payload = message.payload;
      if (!payload || !payload.token) {
        ws.send(
          JSON.stringify({
            type: RelayMessageType.AUTH_ERROR,
            error: 'Missing token',
          }),
        );
        ws.close(4002, 'Missing token');
        return;
      }

      const { valid, login } = validateToken(payload.token);
      if (!valid) {
        ws.send(
          JSON.stringify({
            type: RelayMessageType.AUTH_ERROR,
            error: 'Invalid token',
          }),
        );
        ws.close(4003, 'Invalid token');
        return;
      }

      const existingLogin = login || payload.login || 'unknown';

      const existing = getSession(payload.token);
      if (existing) {
        try {
          existing.ws.close(4000, 'Replaced by new connection');
        } catch {}
        cleanup(existing);
      }

      const newSession: Session = {
        token: payload.token,
        login: existingLogin,
        ws,
        mcpServer: null,
        mcpTransport: null,
        connectedAt: Date.now(),
        pending: new Map(),
      };

      addSession(newSession);
      session = newSession;

      ws.send(
        JSON.stringify({
          type: RelayMessageType.AUTH_OK,
          payload: { login: existingLogin },
        }),
      );

      console.log(`Extension authenticated: login=${existingLogin}`);
    }

    authTimeout = setTimeout(() => {
      if (!session) {
        ws.send(
          JSON.stringify({
            type: RelayMessageType.AUTH_ERROR,
            error: 'Authentication timeout',
          }),
        );
        ws.close(4001, 'Auth timeout');
      }
    }, 15000);

    ws.on('message', (raw: Buffer) => {
      let message: any;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        ws.send(
          JSON.stringify({
            type: RelayMessageType.ERROR,
            error: 'Invalid JSON',
          }),
        );
        return;
      }

      if (message.type === RelayMessageType.AUTH) {
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }
        handleAuth(ws, message);
        return;
      }

      if (!session) {
        ws.send(
          JSON.stringify({
            type: RelayMessageType.ERROR,
            error: 'Not authenticated',
          }),
        );
        return;
      }

      if (message.type === RelayMessageType.PING) {
        ws.send(JSON.stringify({ type: RelayMessageType.PONG }));
        return;
      }

      if (message.type === RelayMessageType.TOOL_RESULT && message.responseToRequestId) {
        resolvePendingRequest(session, message.responseToRequestId, message.payload);
        return;
      }

      if (message.type === RelayMessageType.TOOLS_LIST && message.responseToRequestId) {
        resolvePendingRequest(session, message.responseToRequestId, message.payload);
        return;
      }

      if (message.type === RelayMessageType.PROCESS_RESULT && message.responseToRequestId) {
        resolvePendingRequest(session, message.responseToRequestId, message.payload);
        return;
      }
    });

    ws.on('close', () => {
      if (authTimeout) clearTimeout(authTimeout);
      if (session) {
        cleanup(session);
        session = null;
      }
    });

    ws.on('error', () => {
      if (session) {
        cleanup(session);
        session = null;
      }
    });
  });

  return wss;
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
import { createWsServer } from './ws-server.js';
import { getSession, getSessionCount } from './sessions.js';
import { loadTokens, validateToken } from './auth.js';
import { createMcpServer } from './mcp-manager.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const PORT = parseInt(process.env.RELAY_PORT || '8080', 10);
const HOST = process.env.RELAY_HOST || '0.0.0.0';

async function main() {
  loadTokens();

  const fastify = Fastify({ logger: false });

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      return cb(null, true);
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  fastify.get('/health', async () => ({
    status: 'ok',
    sessions: getSessionCount(),
    uptime: process.uptime(),
  }));

  function resetMcpTransport(session: NonNullable<ReturnType<typeof getSession>>): void {
    if (session.mcpTransport) {
      try {
        session.mcpTransport.close().catch(() => {});
      } catch {}
    }
    if (session.mcpServer) {
      try {
        session.mcpServer.close().catch(() => {});
      } catch {}
    }

    const mcpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => `${session.login}-${Date.now()}`,
    });

    mcpTransport.onclose = () => {
      session.mcpTransport = null;
      session.mcpServer = null;
      console.log(`MCP transport closed for ${session.login}, will recreate on next request`);
    };

    const mcpServer = createMcpServer(session);
    session.mcpServer = mcpServer;
    session.mcpTransport = mcpTransport;

    mcpServer.connect(mcpTransport).catch((err) => {
      console.error(`MCP connect error for ${session.login}:`, err);
    });

    console.log(`MCP transport (re)created for ${session.login}`);
  }

  function mcpSession(
    token: string,
    reply: { code: (c: number) => { send: (b: unknown) => void } },
    notConnected: string,
  ): NonNullable<ReturnType<typeof getSession>> | undefined {
    if (!validateToken(token).valid) {
      reply.code(401).send({ error: 'Invalid or unknown token' });
      return undefined;
    }
    const session = getSession(token);
    if (!session) {
      reply.code(503).send({ error: notConnected });
      return undefined;
    }
    return session;
  }

  fastify.post('/mcp', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
    const session = mcpSession(token, reply, 'No browser extension connected for this token.');
    if (!session) {
      return;
    }

    if (!session.mcpTransport) {
      resetMcpTransport(session);
    }

    try {
      await session.mcpTransport!.handleRequest(request.raw, reply.raw, request.body);
    } catch (error) {
      if (!reply.sent) {
        reply.code(500).send({ error: 'MCP request processing error' });
      }
    }
  });

  fastify.get('/mcp', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
    const session = mcpSession(token, reply, 'No browser extension connected for this token');
    if (!session) {
      return;
    }

    if (!session.mcpTransport) {
      resetMcpTransport(session);
    }

    try {
      await session.mcpTransport!.handleRequest(request.raw, reply.raw);
      if (!reply.sent) {
        reply.hijack();
      }
    } catch (error) {
      if (!reply.sent) {
        reply.code(500).send({ error: 'MCP SSE error' });
      }
    }
  });

  fastify.delete('/mcp', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
    const session = mcpSession(token, reply, 'No browser extension connected for this token');
    if (!session) {
      return;
    }

    if (session.mcpTransport) {
      try {
        await session.mcpTransport.handleRequest(request.raw, reply.raw);
        if (!reply.sent) {
          reply.code(204).send();
        }
      } catch (error) {
        if (!reply.sent) {
          reply.code(500).send({ error: 'MCP session deletion error' });
        }
      }
    } else {
      reply.code(204).send();
    }
  });

  await fastify.listen({ port: PORT, host: HOST });

  const wss = createWsServer(fastify.server);

  console.log(`Relay server running on http://${HOST}:${PORT}`);
  console.log(`  WebSocket: ws://${HOST}:${PORT}/ws`);
  console.log(`  MCP endpoint: http://${HOST}:${PORT}/mcp`);
  console.log(`  Health: http://${HOST}:${PORT}/health`);

  const shutdown = () => {
    console.log('\nShutting down...');
    wss.close(() => {
      fastify.close().then(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start relay server:', err);
  process.exit(1);
});

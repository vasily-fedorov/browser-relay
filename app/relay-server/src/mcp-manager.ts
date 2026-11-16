import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { RelayMessageType, RelayCallToolPayload } from 'browser-relay-shared';
import type { Session } from './sessions.js';
import { getToolSchemas } from './tool-registry.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function createMcpServer(session: Session): Server {
  const mcpServer = new Server(
    {
      name: 'ChromeMcpRelay',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    if (session.ws.readyState !== session.ws.OPEN) {
      return { tools: [] };
    }
    try {
      const tools = await sendToExtensionAndWait(session, {
        type: RelayMessageType.LIST_TOOLS,
        requestId: generateRequestId(),
      });
      return { tools: (tools as any)?.tools || getToolSchemas() };
    } catch {
      console.warn(`Failed to get tools from extension ${session.login}, using fallback schemas`);
      return { tools: getToolSchemas() };
    }
  });

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (session.ws.readyState !== session.ws.OPEN) {
      return {
        content: [{ type: 'text', text: 'Browser extension is not connected' }],
        isError: true,
      } satisfies CallToolResult;
    }
    try {
      const result = await sendToExtensionAndWait(session, {
        type: RelayMessageType.CALL_TOOL,
        requestId: generateRequestId(),
        payload: { name, args: args || {} } satisfies RelayCallToolPayload,
      });
      const payload = result as any;
      if (payload?.status === 'error') {
        return {
          content: [{ type: 'text', text: payload?.message || 'Tool execution error' }],
          isError: true,
        } satisfies CallToolResult;
      }
      const data = payload?.data;
      if (Array.isArray(data?.content)) {
        return data as CallToolResult;
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      } satisfies CallToolResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Tool call failed: ${message}` }],
        isError: true,
      } satisfies CallToolResult;
    }
  });

  return mcpServer;
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

function sendToExtensionAndWait(
  session: Session,
  message: Record<string, unknown>,
  timeoutMs: number = 60000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const requestId = message.requestId as string;
    const pending: PendingRequest = {
      resolve,
      reject,
      timer: setTimeout(() => {
        session.pending.delete(requestId);
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs),
    };
    session.pending.set(requestId, pending);
    session.ws.send(JSON.stringify(message));
  });
}

export function resolvePendingRequest(
  session: Session,
  responseToRequestId: string,
  payload: unknown,
  error?: string,
): void {
  const pending = session.pending.get(responseToRequestId);
  if (!pending) return;
  clearTimeout(pending.timer);
  session.pending.delete(responseToRequestId);
  if (error) {
    pending.reject(new Error(error));
  } else {
    pending.resolve(payload);
  }
}

export { createMcpServer };

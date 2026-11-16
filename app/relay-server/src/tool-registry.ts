import { TOOL_SCHEMAS } from 'browser-relay-shared';

export function getToolSchemas() {
  return TOOL_SCHEMAS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

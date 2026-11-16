export interface AdvertisedTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

type SchemaLike = {
  name?: unknown;
  description?: unknown;
  inputSchema?: unknown;
};

/**
 * Advertise only tools this build can actually execute: the relay is the single
 * source of truth for both lists, so a schema without an executor (or vice
 * versa) must never reach the agent.
 */
export function selectAdvertisedTools(
  schemas: readonly SchemaLike[],
  executable: ReadonlySet<string>,
): AdvertisedTool[] {
  const tools: AdvertisedTool[] = [];
  for (const schema of schemas) {
    if (typeof schema?.name !== 'string' || !executable.has(schema.name)) continue;
    tools.push({
      name: schema.name,
      description: typeof schema.description === 'string' ? schema.description : '',
      inputSchema: (schema.inputSchema as Record<string, unknown>) || {
        type: 'object',
        properties: {},
      },
    });
  }
  return tools;
}

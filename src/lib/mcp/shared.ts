// Small response helpers shared by every tool-registration module under
// src/lib/mcp/. Kept in one place so every tool returns MCP content blocks
// the same shape, instead of each module reinventing textResult/errorResult.

export function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

export function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

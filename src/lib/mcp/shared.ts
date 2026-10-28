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

/**
 * Recursively drops `userId` keys (redundant — every response is already
 * scoped to the caller's own token) and null/undefined values from a tool's
 * response data, to cut tokens on verbose Prisma payloads (GitHub issue #96).
 * Dates are left as Date objects — textResult's JSON.stringify serializes
 * them the same way either way.
 */
export function compact<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => compact(v)) as unknown as T;
  }
  if (value instanceof Date || value === null || typeof value !== "object") {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (key === "userId" || v === null || v === undefined) continue;
    result[key] = compact(v);
  }
  return result as T;
}

/**
 * Text formatting utilities for MCP tool output.
 *
 * All MCP tool responses are plain text (not JSON) because LLMs process
 * natural-language output more efficiently than raw JSON. The formatting
 * prioritises readability for both the LLM and the human reviewing output.
 */

/**
 * Builds an MCP-compliant error response from any caught error.
 *
 * Returns a structured object that the MCP SDK accepts as a tool error,
 * preserving the original error message when available.
 */
export function formatToolError(error: unknown) {
  const text =
    error instanceof Error
      ? `Error: ${error.message}`
      : `Error: ${String(error)}`

  return {
    isError: true as const,
    content: [{ type: "text" as const, text }],
  }
}

/**
 * Formats hours worked versus expected hours.
 *
 * Returns a compact string such as `6/8h (2h mancanti)` when hours are
 * below the target, or `8/8h OK` when the target is met.
 */
export function formatHours(hours: number, expected: number): string {
  if (hours >= expected) return `${hours}/${expected}h OK`
  return `${hours}/${expected}h (${expected - hours}h mancanti)`
}

/**
 * Formats an ISO date string into a compact Italian weekday prefix.
 *
 * Example: `"2025-01-06"` -> `"lun 2025-01-06"`
 */
export function formatDate(date: string): string {
  const d = new Date(date)
  const days = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"]
  return `${days[d.getDay()]} ${date}`
}

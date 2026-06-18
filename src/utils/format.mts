/**
 * Text formatting utilities for MCP tool output.
 *
 * All MCP tool responses are plain text (not JSON) because LLMs process
 * natural-language output more efficiently than raw JSON. The formatting
 * prioritises readability for both the LLM and the human reviewing output.
 */

/**
 * Wraps text in the MCP success envelope every tool returns.
 *
 * Every tool produces a single plain-text content block; this is the one
 * place that shape is spelled out, so call sites stay free of the repeated
 * `{ content: [{ type: "text" as const, text }] }` boilerplate.
 */
export function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  }
}

/**
 * Wraps text in the MCP error envelope (`isError: true`).
 *
 * Use for in-handler validation failures (e.g. an unconfirmed write) where a
 * thrown error is not appropriate; for caught exceptions use `formatToolError`.
 */
export function errorText(text: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text }],
  }
}

/**
 * Confirm-gate for write/delete tools.
 *
 * Returns `null` when the caller confirmed (proceed), or the canonical
 * not-confirmed error envelope otherwise. Usage:
 *
 * ```ts
 * const gate = requireConfirm(params.confirm)
 * if (gate) return gate
 * ```
 */
export function requireConfirm(confirm: boolean) {
  return confirm
    ? null
    : errorText(
        "Operation not confirmed. You must show a recap to the user and get confirmation before setting confirm=true.",
      )
}

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

  return errorText(text)
}

/**
 * Formats hours worked versus expected hours.
 *
 * Returns a compact string such as `6/8h (2h missing)` when hours are
 * below the target, or `8/8h OK` when the target is met.
 */
export function formatHours(hours: number, expected: number): string {
  if (hours >= expected) return `${hours}/${expected}h OK`
  return `${hours}/${expected}h (${expected - hours}h missing)`
}

/**
 * Formats an ISO date string into a compact English weekday prefix.
 *
 * Example: `"2025-01-06"` -> `"Mon 2025-01-06"`
 */
export function formatDate(date: string): string {
  const d = new Date(date)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return `${days[d.getDay()]} ${date}`
}

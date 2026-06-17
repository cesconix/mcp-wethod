/**
 * Minimal MCP server harness for tool output (golden) tests.
 *
 * Tools register via `server.registerTool(name, config, handler)`. The tool
 * suite is otherwise smoke-only (asserts `register*` is a function), so this
 * harness captures the actual handler and lets a test invoke it and assert on
 * the exact text envelope a tool returns — guarding against output drift when
 * the shared envelope/validation helpers are refactored.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

/** The text-content envelope every tool returns. */
export type ToolResult = {
  isError?: boolean
  content: { type: string; text: string }[]
}

type ToolHandler = (params: Record<string, unknown>) => Promise<ToolResult>

export type ToolHarness = {
  /** Pass this where a tool expects an McpServer. */
  server: McpServer
  /** Invoke a registered tool's handler and return its raw result. */
  invoke: (
    name: string,
    params?: Record<string, unknown>,
  ) => Promise<ToolResult>
  /** Invoke a tool and return only its single text payload. */
  text: (name: string, params?: Record<string, unknown>) => Promise<string>
}

/**
 * Creates a fake McpServer that records each registered tool's handler so a
 * test can invoke it directly.
 */
export function createToolHarness(): ToolHarness {
  const handlers = new Map<string, ToolHandler>()

  const server = {
    registerTool(name: string, _config: unknown, handler: ToolHandler) {
      handlers.set(name, handler)
    },
  } as unknown as McpServer

  async function invoke(name: string, params: Record<string, unknown> = {}) {
    const handler = handlers.get(name)
    if (!handler) throw new Error(`tool "${name}" was not registered`)
    return handler(params)
  }

  async function text(name: string, params: Record<string, unknown> = {}) {
    const result = await invoke(name, params)
    return result.content.map((c) => c.text).join("")
  }

  return { server, invoke, text }
}

/**
 * HTTP client for the Wethod REST API.
 *
 * Wraps `fetch` with the headers Wethod requires (Bearer auth, company,
 * API version) and provides typed JSON parsing with error handling.
 */

import { API_VERSION, DEFAULT_BASE_URL } from "./constants.mjs"

export interface WethodClientOptions {
  /** Wethod company slug (sent via Wethod-Company header). */
  company: string
  /** Bearer token for Wethod API authentication. */
  apiToken: string
  /** Override the default base URL (useful for testing). */
  baseUrl?: string
}

export interface RequestOptions {
  /** JSON-serializable request body. */
  body?: unknown
  /** Query string parameters (undefined values are skipped). */
  params?: Record<string, string | number | boolean | undefined>
}

/**
 * Typed HTTP client for the Wethod API.
 *
 * Usage:
 * ```ts
 * const client = new WethodClient({ company: "acme", apiToken: "tok_..." })
 * const projects = await client.request<Project[]>("GET", "/api/projects")
 * ```
 */
export class WethodClient {
  private readonly company: string
  private readonly apiToken: string
  private readonly baseUrl: string

  constructor(options: WethodClientOptions) {
    this.company = options.company
    this.apiToken = options.apiToken
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  }

  /**
   * Sends an HTTP request to the Wethod API.
   *
   * - Builds the full URL and appends query params.
   * - Sets required Wethod headers (Content-Type, Authorization, Company, Version).
   * - Returns `{} as T` for 204 responses and successful DELETE requests.
   * - Parses JSON and returns the typed result on success.
   * - Throws an Error with the JSON error body on non-ok responses.
   */
  async request<T>(
    method: string,
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`)

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.append(key, String(value))
        }
      }
    }

    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiToken}`,
        "Wethod-Company": this.company,
        "Wethod-Version": API_VERSION,
      },
    }

    if (options?.body) {
      init.body = JSON.stringify(options.body)
    }

    const response = await fetch(url.toString(), init)

    // 204 No Content or successful DELETE — no body to parse.
    if (response.status === 204 || (method === "DELETE" && response.ok)) {
      return {} as T
    }

    const json = await response.json()

    if (!response.ok) {
      throw new Error(JSON.stringify(json))
    }

    return json as T
  }
}

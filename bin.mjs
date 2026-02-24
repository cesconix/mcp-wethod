#!/usr/bin/env node

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createMcpServer } from "./dist/index.mjs"

const company = process.env.WETHOD_COMPANY
const apiToken = process.env.WETHOD_API_TOKEN

if (!company || !apiToken) {
  console.error("Required env vars: WETHOD_COMPANY, WETHOD_API_TOKEN")
  process.exit(1)
}

// data/ lives at the monorepo root (two levels up from packages/mcp-wethod/)
const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, "..", "..", "data")

createMcpServer({ company, apiToken, dataDir })

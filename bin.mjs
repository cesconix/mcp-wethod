#!/usr/bin/env node

import { join } from "node:path"
import { homedir } from "node:os"
import { createMcpServer } from "./dist/index.mjs"

const company = process.env.WETHOD_COMPANY
const apiToken = process.env.WETHOD_API_TOKEN

if (!company || !apiToken) {
  console.error("Required env vars: WETHOD_COMPANY, WETHOD_API_TOKEN")
  process.exit(1)
}

const dataDir = join(homedir(), ".mcp-wethod", company)

createMcpServer({ company, apiToken, dataDir })

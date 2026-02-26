#!/usr/bin/env node

import { createMcpServer } from "./dist/index.mjs"

const server = await createMcpServer()

process.on("SIGINT", async () => {
  await server.close()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  await server.close()
  process.exit(0)
})

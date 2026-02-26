/**
 * Configuration management for mcp-wethod.
 *
 * Reads and writes `~/.mcp-wethod/config.json`. Supports env var overrides
 * for CI/testing. The config file stores a single company's credentials
 * and the current user's person ID.
 *
 * Data files (persons.json, projects.json, etc.) live directly in
 * `~/.mcp-wethod/` alongside the config.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export type WethodConfig = {
  company: string
  apiToken: string
  personId: number
}

export const CONFIG_DIR = join(homedir(), ".mcp-wethod")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")

/**
 * Reads the config from disk or env vars.
 *
 * Priority: env vars override config file values.
 * Returns null if no valid config is found.
 */
export function readConfig(): WethodConfig | null {
  const envCompany = process.env.WETHOD_COMPANY
  const envToken = process.env.WETHOD_API_TOKEN
  const envPersonId = process.env.WETHOD_PERSON_ID

  // Full env var override
  if (envCompany && envToken && envPersonId) {
    return {
      company: envCompany,
      apiToken: envToken,
      personId: Number(envPersonId),
    }
  }

  // Read from config file
  if (!existsSync(CONFIG_FILE)) return null

  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"))
    if (!raw.company || !raw.apiToken || !raw.personId) return null
    return {
      company: String(raw.company),
      apiToken: String(raw.apiToken),
      personId: Number(raw.personId),
    }
  } catch {
    return null
  }
}

/** Writes the config to disk. */
export function writeConfig(config: WethodConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")
}

/**
 * Removes all data files from the config directory.
 * Called before re-setup to ensure clean state.
 * Preserves config.json itself.
 */
export function clearData(): void {
  if (!existsSync(CONFIG_DIR)) return

  const dataFiles = [
    "persons.json",
    "projects.json",
    "clients.json",
    "project-types.json",
    ".last-sync",
    ".setup-pending.json",
  ]

  for (const file of dataFiles) {
    const filePath = join(CONFIG_DIR, file)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }
}

/**
 * Removes all data files AND config.json from the config directory.
 * Called by the reset tool to fully wipe state.
 */
export function clearAll(): void {
  clearData()
  const configFile = join(CONFIG_DIR, "config.json")
  if (existsSync(configFile)) {
    unlinkSync(configFile)
  }
}

import type { MiddlewareHandler } from "hono"
import { getClientIp } from "../client-ip"

interface Window {
  count: number
  resetAt: number
}

/**
 * Fixed-window, in-memory, per-client-IP rate limiter for the public MCP route.
 * Limits are read per request so they can be tuned via env without a code change:
 * PUBLIC_MCP_RATE_LIMIT (requests per window, default 600) and
 * PUBLIC_MCP_RATE_WINDOW_MS (window length, default 60000).
 */
export const publicRateLimit: MiddlewareHandler = async (c, next) => {
  const limit = Number(process.env.PUBLIC_MCP_RATE_LIMIT) || 600
  const windowMs = Number(process.env.PUBLIC_MCP_RATE_WINDOW_MS) || 60_000
  const now = Date.now()

  sweep(now)

  const key = getClientIp(c.req.raw) ?? "unknown"
  let entry = windows.get(key)
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs }
    windows.set(key, entry)
  }
  entry.count++

  if (entry.count > limit) {
    c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)))
    return c.json({ error: "Rate limit exceeded" }, 429)
  }

  await next()
}

const windows = new Map<string, Window>()
let nextSweepAt = 0

/** Drop expired windows at most once a minute so the map stays bounded. */
function sweep(now: number) {
  if (now < nextSweepAt) return
  nextSweepAt = now + 60_000
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key)
  }
}

/** Test helper: forget all counters. */
export function resetRateLimit() {
  windows.clear()
  nextSweepAt = 0
}

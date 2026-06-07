import type { Context, Next } from "hono"

/**
 * API key authentication middleware
 * Checks for X-API-Key header and validates against API_KEY env var
 */
export async function apiKeyAuth(c: Context, next: Next) {
  const apiKey = c.req.header("X-API-Key")
  const validApiKey = process.env.API_KEY

  if (!validApiKey) {
    console.error("[auth] API_KEY environment variable not set")
    return c.json({ error: "Server configuration error" }, 500)
  }

  if (!apiKey) {
    return c.json({ error: "Missing X-API-Key header" }, 401)
  }

  if (apiKey !== validApiKey) {
    return c.json({ error: "Invalid API key" }, 403)
  }

  await next()
}

import { Hono } from "hono"
import { prettyJSON } from 'hono/pretty-json'
import { name, version } from "../package.json"
import { getGeoLocation } from "./geo"
import { apiKeyAuth } from "./middleware/auth"
import { queue } from "./queue"
import { GeoLocationSchema } from "./schema"

const app = new Hono()
app.use(prettyJSON({ force: true }))

// Track server start time for uptime calculation
const startTime = Date.now()

// Robots.txt - disallow all crawlers
app.get("/robots.txt", c => {
  return c.text("User-agent: *\nDisallow: /")
})

// Homepage with service metadata (no auth required)
app.get("/", async c => {
  const uptime = Math.floor((Date.now() - startTime) / 1000) // seconds

  // Get GeoIP database info
  const mmdbPath = process.env.GEOIP_DB_PATH || "/usr/share/GeoIP/GeoLite2-City.mmdb"
  let dbLastModified: string | null = null

  try {
    const file = Bun.file(mmdbPath)
    if (await file.exists()) {
      dbLastModified = new Date(file.lastModified).toISOString()
    }
  } catch (err) {
    console.error("Error accessing GeoIP database:", err)
  }

  return c.json({
    status: "ok",
    service: name,
    version,
    uptime,
    timestamp: new Date().toISOString(),
    database: {
      path: mmdbPath,
      lastModified: dbLastModified
    },
    queue: {
      pending: queue.pending,
      size: queue.size,
      isPaused: queue.isPaused
    },
    endpoints: {
      health: "GET /",
      lookup: "GET /lookup/:ip (requires X-API-Key header)"
    },
    documentation: "https://github.com/SubZtep/geo-service"
  })
})

// Geo lookup endpoint (requires API key)
app.get("/lookup/:ip", apiKeyAuth, async c => {
  const ip = c.req.param("ip")

  if (!ip) {
    return c.json({ error: "IP address is required" }, 400)
  }

  // Basic IP validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

  if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
    return c.json({ error: "Invalid IP address format" }, 400)
  }

  // Queue the MaxMind lookup to control concurrency
  const geoData = await queue.add(async () => {
    console.log("[queue] Processing IP lookup:", ip)
    return await getGeoLocation(ip)
  })

  if (!geoData) {
    return c.json({ error: "Location not found for IP" }, 404)
  }

  // Validate response with Zod schema
  const result = GeoLocationSchema.safeParse(geoData)
  if (!result.success) {
    console.error("[api] Invalid geo data:", result.error)
    return c.json({ error: "Invalid geo data" }, 500)
  }

  return c.json(result.data)
})

const port = Number(process.env.PORT || 3000)

// Export app for testing
export { app }

export default {
  port,
  fetch: app.fetch
}

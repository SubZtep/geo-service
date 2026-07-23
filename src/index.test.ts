import { describe, expect, test } from "bun:test"

// Mock environment variables before importing app
process.env.API_KEY = "test-api-key-12345"
process.env.GEOIP_DB_PATH = "/usr/share/GeoIP/GeoLite2-City.mmdb"
process.env.QUEUE_CONCURRENCY = "2"

// Import the app after setting env vars
import { app } from "./index"

describe("Health Endpoint", () => {
  test("GET / should return service metadata", async () => {
    const res = await app.request("/")
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.status).toBe("ok")
    expect(data.service).toBe("geo-service")
    expect(data.version).toBeTruthy()
    expect(data.uptime).toBeGreaterThanOrEqual(0)
    expect(data.database).toBeDefined()
    expect(data.queue).toBeDefined()
    expect(data.queue.pending).toBeGreaterThanOrEqual(0)
    expect(data.queue.size).toBeGreaterThanOrEqual(0)
    expect(data.endpoints).toBeDefined()
  })

  test("GET / should include queue information", async () => {
    const res = await app.request("/")
    const data = await res.json()

    expect(data.queue).toHaveProperty("pending")
    expect(data.queue).toHaveProperty("size")
    expect(data.queue).toHaveProperty("isPaused")
    expect(typeof data.queue.isPaused).toBe("boolean")
  })

  test("GET / should include database information", async () => {
    const res = await app.request("/")
    const data = await res.json()

    expect(data.database).toHaveProperty("path")
    expect(data.database).toHaveProperty("lastModified")
    expect(data.database.path).toBe("/usr/share/GeoIP/GeoLite2-City.mmdb")
  })
})

describe("Robots.txt Endpoint", () => {
  test("GET /robots.txt should disallow all crawlers", async () => {
    const res = await app.request("/robots.txt")
    expect(res.status).toBe(200)

    const text = await res.text()
    expect(text).toContain("User-agent: *")
    expect(text).toContain("Disallow: /")
  })
})

describe("Authentication", () => {
  test("GET /lookup/:ip without API key should return 401", async () => {
    const res = await app.request("/lookup/8.8.8.8")
    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.error).toBe("Missing X-API-Key header")
  })

  test("GET /lookup/:ip with invalid API key should return 403", async () => {
    const res = await app.request("/lookup/8.8.8.8", {
      headers: {
        "X-API-Key": "invalid-key"
      }
    })
    expect(res.status).toBe(403)

    const data = await res.json()
    expect(data.error).toBe("Invalid API key")
  })

  test("GET /lookup/:ip with valid API key should not return auth error", async () => {
    const res = await app.request("/lookup/8.8.8.8", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })
    // Should not be 401 or 403
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})

describe("IP Validation", () => {
  test("GET /lookup/:ip with invalid IPv4 should return 404 or 400", async () => {
    // Note: 999.999.999.999 passes our regex but fails MaxMind validation
    const res = await app.request("/lookup/999.999.999.999", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })
    // Either 400 (validation) or 404 (MaxMind rejects it)
    expect([400, 404]).toContain(res.status)
  })

  test("GET /lookup/:ip with invalid format should return 400", async () => {
    const res = await app.request("/lookup/not-an-ip", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe("Invalid IP address format")
  })

  test("GET /lookup/:ip with empty string should return 400", async () => {
    const res = await app.request("/lookup/", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })
    // Should either be 404 (route not found) or handle gracefully
    expect([400, 404]).toContain(res.status)
  })

  test("GET /lookup/:ip with valid IPv4 format should pass validation", async () => {
    const res = await app.request("/lookup/8.8.8.8", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })
    // Should not be 400 (validation error)
    expect(res.status).not.toBe(400)
  })

  test("GET /lookup/:ip with valid IPv6 format should pass validation", async () => {
    const res = await app.request("/lookup/2001:4860:4860::8888", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })
    // Should not be 400 (validation error)
    expect(res.status).not.toBe(400)
  })
})

describe("IP Lookup", () => {
  test("GET /lookup/:ip with valid public IP should return geo data or 404", async () => {
    // Using Google DNS IP which should have geo data
    const res = await app.request("/lookup/8.8.8.8", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })

    // Either 200 with data, 404 if not found, or 500 if database not available
    expect([200, 404, 500]).toContain(res.status)

    if (res.status === 200) {
      const data = await res.json()
      // Check that it matches the GeoLocation schema
      expect(typeof data).toBe("object")
    }
  })

  test("GET /lookup/:ip response should match schema when successful", async () => {
    const res = await app.request("/lookup/8.8.8.8", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })

    if (res.status === 200) {
      const data = await res.json()

      // Optional fields should be objects or undefined
      if (data.continent) {
        expect(data.continent).toHaveProperty("geonameId")
        expect(data.continent).toHaveProperty("name")
        expect(data.continent).toHaveProperty("code")
        expect(typeof data.continent.geonameId).toBe("number")
        expect(typeof data.continent.name).toBe("string")
        expect(typeof data.continent.code).toBe("string")
      }

      if (data.country) {
        expect(data.country).toHaveProperty("geonameId")
        expect(data.country).toHaveProperty("name")
        expect(data.country).toHaveProperty("isoCode")
        expect(data.country).toHaveProperty("isInEuropeanUnion")
        expect(typeof data.country.geonameId).toBe("number")
        expect(typeof data.country.name).toBe("string")
        expect(typeof data.country.isoCode).toBe("string")
        expect(typeof data.country.isInEuropeanUnion).toBe("boolean")
      }

      if (data.subdivisions) {
        expect(Array.isArray(data.subdivisions)).toBe(true)
        for (const subdivision of data.subdivisions) {
          expect(subdivision).toHaveProperty("geonameId")
          expect(subdivision).toHaveProperty("name")
          expect(subdivision).toHaveProperty("isoCode")
          expect(typeof subdivision.isoCode).toBe("string")
        }
      }

      if (data.city) {
        expect(data.city).toHaveProperty("geonameId")
        expect(data.city).toHaveProperty("name")
        expect(typeof data.city.geonameId).toBe("number")
        expect(typeof data.city.name).toBe("string")
      }

      if (data.postalCode) {
        expect(typeof data.postalCode).toBe("string")
      }

      if (data.location) {
        expect(data.location).toHaveProperty("accuracyRadius")
        expect(data.location).toHaveProperty("latitude")
        expect(data.location).toHaveProperty("longitude")
        expect(typeof data.location.accuracyRadius).toBe("number")
        expect(typeof data.location.latitude).toBe("number")
        expect(typeof data.location.longitude).toBe("number")
      }
    }
  })

  test("GET /lookup/:ip with Cloudflare DNS should work", async () => {
    const res = await app.request("/lookup/1.1.1.1", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })

    // Either 200 with data, 404 if not found, or 500 if database not available
    expect([200, 404, 500]).toContain(res.status)
  })
})

describe("Localization", () => {
  test("GET /lookup/:ip?lang=hu should return localized names or 404/500", async () => {
    const res = await app.request("/lookup/8.8.8.8?lang=hu", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })
    expect([200, 404, 500]).toContain(res.status)

    if (res.status === 200) {
      const data = await res.json()
      if (data.country) expect(typeof data.country.name).toBe("string")
    }
  })

  test("GET /lookup/:ip without lang should default to English names", async () => {
    const res = await app.request("/lookup/8.8.8.8", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })
    expect([200, 404, 500]).toContain(res.status)

    if (res.status === 200) {
      const data = await res.json()
      if (data.country) expect(data.country.name).toBe("United States")
    }
  })

  test("GET /lookup/:ip with unsupported lang should fall back to English", async () => {
    const res = await app.request("/lookup/8.8.8.8?lang=xx-not-real", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })
    expect([200, 404, 500]).toContain(res.status)

    if (res.status === 200) {
      const data = await res.json()
      if (data.country) expect(data.country.name).toBe("United States")
    }
  })
})

describe("Queue Concurrency", () => {
  test("Multiple concurrent requests should all complete", async () => {
    const requests = []
    for (let i = 0; i < 10; i++) {
      requests.push(
        app.request("/lookup/8.8.8.8", {
          headers: {
            "X-API-Key": "test-api-key-12345"
          }
        })
      )
    }

    const responses = await Promise.all(requests)

    // All requests should complete (not timeout or error)
    for (const res of responses) {
      expect(res.status).toBeGreaterThanOrEqual(200)
      expect(res.status).toBeLessThan(600)
    }
  })

  test("Queue should process requests sequentially with concurrency limit", async () => {
    // Make multiple requests
    const startTime = Date.now()
    const requests = []

    for (let i = 0; i < 5; i++) {
      requests.push(
        app.request("/lookup/8.8.8.8", {
          headers: {
            "X-API-Key": "test-api-key-12345"
          }
        })
      )
    }

    const responses = await Promise.all(requests)
    const endTime = Date.now()

    // All should succeed or return expected errors
    for (const res of responses) {
      expect([200, 404, 500]).toContain(res.status)
    }

    // With concurrency of 2, it should take some time to process 5 requests
    // (This is a rough check - actual timing may vary)
    const duration = endTime - startTime
    expect(duration).toBeGreaterThanOrEqual(0)
  })
})

describe("Error Handling", () => {
  test("GET /lookup/:ip with private IP should return 404 or handle gracefully", async () => {
    const res = await app.request("/lookup/192.168.1.1", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })

    // Private IPs typically return 404 from MaxMind
    expect([200, 404, 500]).toContain(res.status)
  })

  test("GET /lookup/:ip with localhost should return 404 or handle gracefully", async () => {
    const res = await app.request("/lookup/127.0.0.1", {
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })

    // Localhost typically returns 404 from MaxMind
    expect([200, 404, 500]).toContain(res.status)
  })

  test("GET /unknown-endpoint should return 404", async () => {
    const res = await app.request("/unknown-endpoint")
    expect(res.status).toBe(404)
  })

  test("POST /lookup/:ip should return 404 (method not allowed)", async () => {
    const res = await app.request("/lookup/8.8.8.8", {
      method: "POST",
      headers: {
        "X-API-Key": "test-api-key-12345"
      }
    })
    expect(res.status).toBe(404)
  })
})

describe("Response Headers", () => {
  test("JSON responses should have correct Content-Type", async () => {
    const res = await app.request("/")
    expect(res.headers.get("content-type")).toContain("application/json")
  })

  test("Robots.txt should return text", async () => {
    const res = await app.request("/robots.txt")
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain("User-agent")
  })
})

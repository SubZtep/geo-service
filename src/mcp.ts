import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { name, version } from "../package.json"
import { getClientIp } from "./client-ip"
import { getGeoLocation } from "./geo"
import { isValidIp } from "./ip"
import { queue } from "./queue"

type RequestInfo = Parameters<typeof getClientIp>[0] | undefined

async function lookup(
  { ip, lang, summary, validate }: { ip?: string; lang?: string; summary?: boolean; validate?: boolean },
  requestInfo: RequestInfo
) {
  if (validate && ip && !isValidIp(ip)) {
    return { content: [{ type: "text" as const, text: `Invalid IP address format: ${ip}` }], isError: true }
  }

  const callerIp = ip || (requestInfo ? getClientIp(requestInfo) : undefined)

  if (!callerIp) {
    return { content: [{ type: "text" as const, text: "Could not determine caller IP address." }], isError: true }
  }

  const geoData = await queue.add(async () => {
    console.log("[mcp] Processing IP lookup:", callerIp)
    return await getGeoLocation(callerIp, lang || "en", summary)
  })

  if (!geoData) {
    return { content: [{ type: "text" as const, text: `Location not found for IP ${callerIp}` }], isError: true }
  }

  return { content: [{ type: "text" as const, text: JSON.stringify(geoData) }] }
}

// Keyed MCP server (requires Authorization: Bearer header), single tool with a `summary` flag.
export const mcpHandler = createMcpHandler(({ requestInfo }) => {
  const server = new McpServer({ name, version })

  server.registerTool(
    "my-location",
    {
      title: "My Location",
      description: "Geolocate the caller's IP address (continent, country, city, coordinates, etc.)",
      inputSchema: z.object({
        ip: z.string().optional().describe("Override the detected caller IP and look up this IP instead."),
        lang: z.string().optional().describe("Locale for place names, e.g. en, hu, de. Defaults to en."),
        summary: z
          .boolean()
          .optional()
          .describe(
            "Return only continent, country, and timeZone, omitting city/postal/coordinates. Defaults to false."
          )
      })
    },
    ({ ip, lang, summary }) => lookup({ ip, lang, summary }, requestInfo)
  )

  return server
})

const publicInputSchema = z.object({
  ip: z
    .string()
    .optional()
    .describe(
      "IPv4 or IPv6 address to look up, e.g. 8.8.8.8 or 2001:4860:4860::8888. " +
        "Leave out to look up the IP address of the caller (the machine making this request)."
    ),
  lang: z.string().optional().describe("Language code for place names, e.g. en, hu, de, fr, ja. Defaults to en.")
})

// Public MCP server (no key, rate limited), two tools with explicit, self-explanatory descriptions.
export const publicMcpHandler = createMcpHandler(({ requestInfo }) => {
  const server = new McpServer({ name, version })

  server.registerTool(
    "get_my_location_full",
    {
      title: "Get My Location (Full Details)",
      description:
        "Find where an IP address is located, with full details: continent, country, region/state (subdivisions), " +
        "city, postal code, latitude/longitude and time zone. " +
        "Use this when you need the city, region or coordinates, e.g. 'where am I?', 'which city is this IP in?', " +
        "'what are the coordinates of 8.8.8.8?'. " +
        "If you only need the country or time zone, use get_my_location_summary instead (smaller response). " +
        "The location is looked up from the IP address, so it is approximate and not a street address: " +
        "location.accuracyRadius in the response is the radius in kilometers within which the real position likely lies. " +
        "It varies per IP (often tens to hundreds of km), so read that value instead of assuming one. " +
        "Call with no arguments to locate the caller, or pass ip to locate a specific address. " +
        'Example: {"ip": "8.8.8.8", "lang": "en"}. Returns JSON.',
      inputSchema: publicInputSchema
    },
    ({ ip, lang }) => lookup({ ip, lang, validate: true }, requestInfo)
  )

  server.registerTool(
    "get_my_location_summary",
    {
      title: "Get My Location (Summary)",
      description:
        "Find which country and time zone an IP address is in. Short answer, country level only: " +
        "returns just continent, country and timeZone. It does NOT include region, city, postal code or coordinates. " +
        "Use this for quick questions like 'which country is this IP from?' or 'what time zone is the user in?'. " +
        "If you need the city, region or latitude/longitude, use get_my_location_full instead. " +
        "Call with no arguments to locate the caller, or pass ip to locate a specific address. " +
        'Example: {"ip": "8.8.8.8", "lang": "en"}. Returns JSON.',
      inputSchema: publicInputSchema
    },
    ({ ip, lang }) => lookup({ ip, lang, summary: true, validate: true }, requestInfo)
  )

  return server
})

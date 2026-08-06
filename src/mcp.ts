import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { name, version } from "../package.json"
import { getClientIp } from "./client-ip"
import { getGeoLocation } from "./geo"
import { queue } from "./queue"

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
    async ({ ip, lang, summary }) => {
      const callerIp = ip || (requestInfo ? getClientIp(requestInfo) : undefined)

      if (!callerIp) {
        return { content: [{ type: "text", text: "Could not determine caller IP address." }], isError: true }
      }

      const geoData = await queue.add(async () => {
        console.log("[mcp] Processing IP lookup:", callerIp)
        return await getGeoLocation(callerIp, lang || "en", summary)
      })

      if (!geoData) {
        return { content: [{ type: "text", text: `Location not found for IP ${callerIp}` }], isError: true }
      }

      return { content: [{ type: "text", text: JSON.stringify(geoData) }] }
    }
  )

  return server
})

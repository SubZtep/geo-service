import { Reader } from "@maxmind/geoip2-node"
import type { GeoLocation } from "./schema"

let reader: ReturnType<typeof Reader.openBuffer> | undefined
let triedInit = false

async function getReader() {
  if (triedInit) return reader
  triedInit = true

  const mmdbPath = process.env.GEOIP_DB_PATH || "/usr/share/GeoIP/GeoLite2-City.mmdb"

  try {
    const dbBuffer = await Bun.file(mmdbPath).arrayBuffer()
    reader = Reader.openBuffer(Buffer.from(dbBuffer))
    console.log(`[geo] GeoIP database loaded from ${mmdbPath}`)
    return reader
  } catch (err) {
    console.error(`[geo] Failed to load GeoIP database: ${err}`)
    return undefined
  }
}

/**
 * Get the geo location of the given IP address.
 * @param ip - The IP address to get the geo location of.
 * @returns The geo location of the given IP address or undefined if the IP address is not found.
 */
export async function getGeoLocation(ip: string): Promise<GeoLocation | undefined> {
  try {
    const city = (await getReader())?.city(ip)
    if (city) {
      return {
        continent: city.continent
          ? {
              geonameId: city.continent.geonameId,
              name: city.continent.names.en
            }
          : undefined,
        country: city.country
          ? {
              geonameId: city.country.geonameId,
              name: city.country.names.en
            }
          : undefined,
        city: city.city
          ? {
              geonameId: city.city.geonameId,
              name: city.city.names.en
            }
          : undefined,
        location: city.location
          ? {
              accuracyRadius: city.location.accuracyRadius,
              latitude: city.location.latitude,
              longitude: city.location.longitude,
              timeZone: city.location.timeZone
            }
          : undefined
      }
    }
  } catch (error) {
    console.error(`[geo] Error getting geo location: ${error instanceof Error ? error.message : String(error)}`)
  }
  return undefined
}

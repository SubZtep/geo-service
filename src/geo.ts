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
 * Picks a locale name from a MaxMind `names` map, falling back to English
 * (always present) and then to any available name if English is missing.
 * @param names - The `names` map from a MaxMind record (e.g. `city.names`).
 *   Typed generically since @maxmind/geoip2-node's `Names` interface has no
 *   index signature, so this accepts any object with a required `en` string.
 * @param lang - Requested locale code, e.g. "en", "hu", "de".
 */
function localizedName<T extends { en: string }>(names: T, lang: string): string {
  const byLang = (names as unknown as Record<string, string | undefined>)[lang]
  return byLang ?? names.en
}

/**
 * Get the geo location of the given IP address.
 * @param ip - The IP address to get the geo location of.
 * @param lang - Locale for place names (continent/country/city), e.g. "en", "hu", "de".
 *   Defaults to "en". Falls back to English, then any available name, if the
 *   requested locale isn't in the database for a given place.
 * @returns The geo location of the given IP address or undefined if the IP address is not found.
 */
export async function getGeoLocation(ip: string, lang = "en"): Promise<GeoLocation | undefined> {
  try {
    const city = (await getReader())?.city(ip)
    if (city) {
      return {
        continent: city.continent
          ? {
              geonameId: city.continent.geonameId,
              name: localizedName(city.continent.names, lang),
              code: city.continent.code
            }
          : undefined,
        country: city.country
          ? {
              geonameId: city.country.geonameId,
              name: localizedName(city.country.names, lang),
              isoCode: city.country.isoCode,
              isInEuropeanUnion: city.country.isInEuropeanUnion
            }
          : undefined,
        // Ordered most-specific-first by the database (e.g. a US state
        // before a county); most callers just want subdivisions[0].
        subdivisions: city.subdivisions?.length
          ? city.subdivisions.map(subdivision => ({
              geonameId: subdivision.geonameId,
              name: localizedName(subdivision.names, lang),
              isoCode: subdivision.isoCode
            }))
          : undefined,
        city: city.city
          ? {
              geonameId: city.city.geonameId,
              name: localizedName(city.city.names, lang)
            }
          : undefined,
        postalCode: city.postal?.code,
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

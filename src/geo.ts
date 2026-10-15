import { basename, dirname } from "node:path"
import { Reader } from "@maxmind/geoip2-node"
import type { GeoLocation } from "./schema"

export const getDbPath = () => process.env.GEOIP_DB_PATH || "/usr/share/GeoIP/GeoLite2-City.mmdb"

let reader: ReturnType<typeof Reader.openBuffer> | undefined
let loadedMtime: number | undefined
let initPromise: Promise<boolean> | undefined
let updatePromise: Promise<DatabaseUpdateResult> | undefined

async function loadReader() {
  const mmdbPath = getDbPath()

  try {
    const file = Bun.file(mmdbPath)
    const dbBuffer = await file.arrayBuffer()
    reader = Reader.openBuffer(Buffer.from(dbBuffer))
    loadedMtime = file.lastModified
    console.log(`[geo] GeoIP database loaded from ${mmdbPath}`)
    return true
  } catch (err) {
    console.error(`[geo] Failed to load GeoIP database: ${err}`)
    return false
  }
}

async function getReader() {
  initPromise ??= loadReader()
  await initPromise
  return reader
}

/** Whether a GeoIP database is loaded and lookups can be served. */
export async function isDatabaseReady() {
  return (await getReader()) !== undefined
}

export interface DatabaseUpdateResult {
  /** True when a new database file was downloaded and swapped in. */
  reloaded: boolean
  lastModified: string
}

/**
 * Download the latest GeoIP database with geoipupdate and hot-swap the reader
 * if the file changed. Concurrent calls share the same run.
 * The edition and directory are derived from GEOIP_DB_PATH, e.g.
 * `/usr/share/GeoIP/GeoLite2-City.mmdb` → edition `GeoLite2-City`.
 */
export function updateDatabase() {
  updatePromise ??= runDatabaseUpdate().finally(() => {
    updatePromise = undefined
  })
  return updatePromise
}

async function runDatabaseUpdate(): Promise<DatabaseUpdateResult> {
  const accountId = process.env.GEOIP_ACCOUNT_ID
  const licenseKey = process.env.GEOIP_LICENSE_KEY
  if (!accountId || !licenseKey) {
    throw new Error("GEOIP_ACCOUNT_ID and GEOIP_LICENSE_KEY must be set")
  }

  const mmdbPath = getDbPath()
  console.log("[geo] Updating GeoIP database...")

  // `-f /dev/null` skips the placeholder /etc/GeoIP.conf shipped with the
  // package; all settings come from the environment instead.
  const proc = Bun.spawn(["geoipupdate", "-f", "/dev/null", "-v"], {
    env: {
      ...process.env,
      GEOIPUPDATE_ACCOUNT_ID: accountId,
      GEOIPUPDATE_LICENSE_KEY: licenseKey,
      GEOIPUPDATE_EDITION_IDS: basename(mmdbPath, ".mmdb"),
      GEOIPUPDATE_DB_DIR: dirname(mmdbPath)
    },
    stdout: "inherit",
    stderr: "inherit"
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`geoipupdate exited with code ${exitCode}`)
  }

  const mtime = Bun.file(mmdbPath).lastModified
  const reloaded = mtime !== loadedMtime
  if (reloaded && !(await loadReader())) {
    throw new Error(`Failed to load updated GeoIP database from ${mmdbPath}`)
  }

  console.log(`[geo] GeoIP database ${reloaded ? "updated" : "already up to date"}`)
  return { reloaded, lastModified: new Date(mtime).toISOString() }
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
 * @param summary - When true, omits subdivisions/city/postalCode/location and
 *   returns only continent, country, and a top-level timeZone. Defaults to false.
 * @returns The geo location of the given IP address or undefined if the IP address is not found.
 */
export async function getGeoLocation(ip: string, lang = "en", summary = false): Promise<GeoLocation | undefined> {
  try {
    const city = (await getReader())?.city(ip)
    if (city) {
      const continent = city.continent
        ? {
            geonameId: city.continent.geonameId,
            name: localizedName(city.continent.names, lang),
            code: city.continent.code
          }
        : undefined
      const country = city.country
        ? {
            geonameId: city.country.geonameId,
            name: localizedName(city.country.names, lang),
            isoCode: city.country.isoCode,
            // MaxMind's types claim this is always present, but the actual
            // mmdb data omits it for some countries; absence means not in the EU.
            isInEuropeanUnion: city.country.isInEuropeanUnion ?? false
          }
        : undefined

      if (summary) {
        return { continent, country, timeZone: city.location?.timeZone }
      }

      return {
        continent,
        country,
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

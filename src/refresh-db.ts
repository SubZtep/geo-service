/**
 * Scheduled job entrypoint (Disco cron service): asks the web service to
 * download the latest GeoIP database and reload it without a restart.
 */
const url = process.env.REFRESH_DB_URL || `http://web:${process.env.PORT || 3000}/internal/refresh-db`

const res = await fetch(url, {
  method: "POST",
  headers: { "X-API-Key": process.env.API_KEY ?? "" }
})

console.log(`[cron] ${url} → ${res.status} ${await res.text()}`)

if (!res.ok) {
  process.exit(1)
}

export {}

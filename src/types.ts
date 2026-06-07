declare module "bun" {
  interface Env {
    /** @default 3000 */
    PORT?: string

    /** Single key for simple validation. */
    API_KEY: string

    /** GeoIP Database. @default /usr/share/GeoIP/GeoLite2-City.mmdb */
    GEOIP_DB_PATH?: string

    /** MaxMind account number. */
    GEOIP_ACCOUNT_ID: string

    /** MaxMind key (for downloading the database). */
    GEOIP_LICENSE_KEY: string
  }
}

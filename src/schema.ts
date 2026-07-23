import { z } from "zod"

/** Reusable schema for continent, country, and city */
const GeoPlaceSchema = z.object({
  geonameId: z.number(),
  name: z.string()
})

/** Country adds an ISO 3166-1 alpha-2 code and EU membership on top of the base place fields. */
const GeoCountrySchema = GeoPlaceSchema.extend({
  isoCode: z.string(),
  isInEuropeanUnion: z.boolean()
})

/** Continent adds its 2-letter code (AF, AN, AS, EU, NA, OC, SA) on top of the base place fields. */
const GeoContinentSchema = GeoPlaceSchema.extend({
  code: z.string()
})

/** State/province-level subdivision, most specific first (e.g. California before a county). */
const GeoSubdivisionSchema = z.object({
  geonameId: z.number(),
  name: z.string(),
  isoCode: z.string()
})

/** Reusable schema for the location details */
const LocationDetailsSchema = z.object({
  accuracyRadius: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  timeZone: z.string().optional()
})

/** Main GeoLocation schema */
export const GeoLocationSchema = z.object({
  continent: GeoContinentSchema.optional(),
  country: GeoCountrySchema.optional(),
  subdivisions: z.array(GeoSubdivisionSchema).optional(),
  city: GeoPlaceSchema.optional(),
  postalCode: z.string().optional(),
  location: LocationDetailsSchema.optional()
})

export type GeoLocation = z.infer<typeof GeoLocationSchema>


/**
 * Extracts the caller's IP address from the first hop of X-Forwarded-For,
 * as set by the reverse proxy in front of this service.
 */
export function getClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (!forwardedFor) return undefined
  const hops = forwardedFor.split(",").map((h) => h.trim()).filter(Boolean)
  return hops.at(-1)
}

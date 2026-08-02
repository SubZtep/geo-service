/**
 * Extracts the caller's IP address from the first hop of X-Forwarded-For,
 * as set by the reverse proxy in front of this service.
 */
export function getClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers.get("x-forwarded-for")
  return forwardedFor?.split(",")[0]?.trim() || undefined
}

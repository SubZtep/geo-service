const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/

/** Basic IPv4/IPv6 format check (not a full validity check). */
export function isValidIp(ip: string): boolean {
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

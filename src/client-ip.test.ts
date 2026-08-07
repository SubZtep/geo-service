import { describe, expect, test } from "bun:test"
import { getClientIp } from "./client-ip"

function reqWithForwardedFor(value: string | null) {
  const headers = new Headers()
  if (value !== null) headers.set("x-forwarded-for", value)
  return new Request("http://localhost", { headers })
}

describe("getClientIp", () => {
  test("returns undefined when header is missing", () => {
    expect(getClientIp(reqWithForwardedFor(null))).toBeUndefined()
  })

  test("returns the single IP when only one hop is present", () => {
    expect(getClientIp(reqWithForwardedFor("1.1.1.1"))).toBe("1.1.1.1")
  })

  test("returns the last hop, not the client-supplied first hop", () => {
    expect(getClientIp(reqWithForwardedFor("1.1.1.1, 2.2.2.2, 3.3.3.3"))).toBe("3.3.3.3")
  })

  test("trims whitespace around hops", () => {
    expect(getClientIp(reqWithForwardedFor("1.1.1.1 ,  2.2.2.2  "))).toBe("2.2.2.2")
  })

  test("ignores empty hops", () => {
    expect(getClientIp(reqWithForwardedFor("1.1.1.1,,2.2.2.2,"))).toBe("2.2.2.2")
  })

  test("returns undefined when header is empty or only whitespace/commas", () => {
    expect(getClientIp(reqWithForwardedFor(""))).toBeUndefined()
    expect(getClientIp(reqWithForwardedFor(" , , "))).toBeUndefined()
  })
})

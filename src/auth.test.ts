import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test"
import {
  generatePKCE,
  isTokenExpired,
  requestDeviceCode,
  refreshAccessToken,
} from "./auth"
import type { TokenState } from "./types"

describe("generatePKCE", () => {
  test("returns verifier and challenge", async () => {
    const pkce = await generatePKCE()

    expect(pkce.verifier).toBeDefined()
    expect(pkce.challenge).toBeDefined()
    expect(pkce.verifier.length).toBe(43)
    expect(pkce.challenge.length).toBeGreaterThan(0)
  })

  test("generates unique values each time", async () => {
    const pkce1 = await generatePKCE()
    const pkce2 = await generatePKCE()

    expect(pkce1.verifier).not.toBe(pkce2.verifier)
    expect(pkce1.challenge).not.toBe(pkce2.challenge)
  })

  test("verifier contains only URL-safe characters", async () => {
    const pkce = await generatePKCE()
    const urlSafeRegex = /^[A-Za-z0-9_-]+$/

    expect(urlSafeRegex.test(pkce.verifier)).toBe(true)
    expect(urlSafeRegex.test(pkce.challenge)).toBe(true)
  })
})

describe("isTokenExpired", () => {
  test("returns false for valid token", () => {
    const state: TokenState = {
      accessToken: "test",
      refreshToken: "test",
      expiresAt: Date.now() + 120000,
    }

    expect(isTokenExpired(state)).toBe(false)
  })

  test("returns true for expired token", () => {
    const state: TokenState = {
      accessToken: "test",
      refreshToken: "test",
      expiresAt: Date.now() - 1000,
    }

    expect(isTokenExpired(state)).toBe(true)
  })

  test("returns true when token expires within 60 seconds", () => {
    const state: TokenState = {
      accessToken: "test",
      refreshToken: "test",
      expiresAt: Date.now() + 30000,
    }

    expect(isTokenExpired(state)).toBe(true)
  })
})

describe("requestDeviceCode", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("sends correct request and returns device code response", async () => {
    const mockResponse = {
      device_code: "device123",
      user_code: "USER-CODE",
      verification_uri: "https://example.com/verify",
      verification_uri_complete: "https://example.com/verify?code=USER-CODE",
      expires_in: 600,
      interval: 5,
    }

    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))
    ) as unknown as typeof fetch

    const result = await requestDeviceCode("test-challenge")

    expect(result).toEqual(mockResponse)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test("throws error on failed request", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Bad Request", { status: 400 }))
    ) as unknown as typeof fetch

    await expect(requestDeviceCode("test-challenge")).rejects.toThrow(
      "Device code request failed: 400"
    )
  })
})

describe("refreshAccessToken", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("returns new tokens on success", async () => {
    const mockResponse = {
      access_token: "new-access",
      refresh_token: "new-refresh",
      token_type: "Bearer",
      expires_in: 3600,
    }

    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }))
    ) as unknown as typeof fetch

    const result = await refreshAccessToken("old-refresh-token")

    expect(result).toEqual(mockResponse)
  })

  test("throws error on failed refresh", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Unauthorized", { status: 401 }))
    ) as unknown as typeof fetch

    await expect(refreshAccessToken("invalid-token")).rejects.toThrow(
      "Token refresh failed: 401"
    )
  })
})
